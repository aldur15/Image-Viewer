#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use exif::{In, Tag, Value};
use once_cell::sync::OnceCell;
use rayon::prelude::*;
use rusqlite::{params, Connection, Result as SqlResult};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    fs,
    path::Path,
    sync::{
        atomic::{AtomicUsize, Ordering},
        Arc, Mutex,
    },
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{Emitter, Manager};
use walkdir::WalkDir;

// single global DB connection shared across threads
static DB: OnceCell<Mutex<Connection>> = OnceCell::new();

fn db() -> &'static Mutex<Connection> {
    DB.get().expect("DB not initialized")
}

const IMAGE_EXTS: &[&str] = &["jpg", "jpeg", "png", "webp"];
const PHASH_THRESHOLD: u32 = 5; // max hamming distance to consider two images "similar"

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExifData {
    pub date: Option<i64>,
    pub make: Option<String>,
    pub model: Option<String>,
    pub width: Option<u32>,
    pub height: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ImageInfo {
    pub path: String,
    pub name: String,
    pub size: u64,
    pub created_at: i64,
    pub modified_at: i64,
    pub phash: Option<String>,
    pub sha1: Option<String>,
    pub exif: Option<ExifData>,
}

#[derive(Debug, Serialize, Clone)]
struct ScanProgress {
    current: usize,
    total: usize,
}

fn init_db(app_data_dir: &str) -> SqlResult<Connection> {
    let db_path = format!("{}/image_cache.db", app_data_dir);
    let conn = Connection::open(&db_path)?;

    // WAL mode gives much better concurrent read performance
    conn.execute_batch("PRAGMA journal_mode=WAL;")?;
    conn.execute_batch("PRAGMA synchronous=NORMAL;")?;
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS images (
            path        TEXT PRIMARY KEY,
            name        TEXT NOT NULL,
            size        INTEGER NOT NULL,
            created_at  INTEGER NOT NULL,
            modified_at INTEGER NOT NULL,
            phash       TEXT,
            sha1        TEXT,
            exif_json   TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_phash ON images(phash);
        CREATE INDEX IF NOT EXISTS idx_sha1  ON images(sha1);",
    )?;

    println!("DB initialized at: {}", db_path);
    Ok(conn)
}

// cache lookup — validates against mtime and size so stale entries don't get returned
fn cache_get(path: &str, mtime: i64, size: u64) -> Option<ImageInfo> {
    let conn = db().lock().unwrap();
    conn.query_row(
        "SELECT path, name, size, created_at, modified_at, phash, sha1, exif_json
         FROM images WHERE path = ?1 AND modified_at = ?2 AND size = ?3",
        params![path, mtime, size as i64],
        |row| {
            let exif_json: Option<String> = row.get(7)?;
            let exif = exif_json.and_then(|j| serde_json::from_str(&j).ok());
            Ok(ImageInfo {
                path: row.get(0)?,
                name: row.get(1)?,
                size: row.get::<_, i64>(2)? as u64,
                created_at: row.get(3)?,
                modified_at: row.get(4)?,
                phash: row.get(5)?,
                sha1: row.get(6)?,
                exif,
            })
        },
    )
    .ok()
}

fn cache_set(img: &ImageInfo) -> SqlResult<()> {
    let conn = db().lock().unwrap();
    let exif_json = img.exif.as_ref().and_then(|e| serde_json::to_string(e).ok());
    conn.execute(
        "INSERT OR REPLACE INTO images
            (path, name, size, created_at, modified_at, phash, sha1, exif_json)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            img.path,
            img.name,
            img.size as i64,
            img.created_at,
            img.modified_at,
            img.phash,
            img.sha1,
            exif_json,
        ],
    )?;
    Ok(())
}

// removes cache rows for files that no longer exist in the scanned folder
fn cache_prune(valid_paths: &[String]) -> SqlResult<usize> {
    let conn = db().lock().unwrap();
    conn.execute_batch(
        "CREATE TEMP TABLE IF NOT EXISTS valid_paths (path TEXT PRIMARY KEY);
         DELETE FROM valid_paths;",
    )?;
    {
        let mut stmt = conn.prepare("INSERT INTO valid_paths VALUES (?1)")?;
        for path in valid_paths {
            stmt.execute(params![path])?;
        }
    }
    let deleted = conn.execute(
        "DELETE FROM images WHERE path NOT IN (SELECT path FROM valid_paths)",
        [],
    )?;
    Ok(deleted)
}

fn system_time_to_unix(t: SystemTime) -> i64 {
    t.duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

fn compute_exif(bytes: &[u8]) -> Option<ExifData> {
    let mut cursor = std::io::Cursor::new(bytes);
    let exif = exif::Reader::new()
        .read_from_container(&mut cursor)
        .ok()?;

    let get_str = |tag: Tag| -> Option<String> {
        exif.get_field(tag, In::PRIMARY)
            .map(|f: &exif::Field| f.display_value().to_string())
    };

    let get_u32 = |tag: Tag| -> Option<u32> {
        exif.get_field(tag, In::PRIMARY).and_then(|f: &exif::Field| {
            match &f.value {
                Value::Long(v) => v.first().copied(),
                Value::Short(v) => v.first().map(|&x| x as u32),
                _ => None,
            }
        })
    };

    // prefer DateTimeOriginal (when the photo was taken) over DateTime (when it was saved/edited)
    let date = get_str(Tag::DateTimeOriginal)
        .or_else(|| get_str(Tag::DateTime))
        .and_then(|s: String| {
            let s = s.trim_matches('"');
            chrono::NaiveDateTime::parse_from_str(s, "%Y:%m:%d %H:%M:%S")
                .ok()
                .map(|dt| dt.and_utc().timestamp())
        });

    Some(ExifData {
        date,
        make: get_str(Tag::Make).map(|s: String| s.trim_matches('"').to_string()),
        model: get_str(Tag::Model).map(|s: String| s.trim_matches('"').to_string()),
        width: get_u32(Tag::PixelXDimension),
        height: get_u32(Tag::PixelYDimension),
    })
}

fn compute_phash(bytes: &[u8]) -> Option<String> {
    let img = image::load_from_memory(bytes)
        .map_err(|e| eprintln!("image load failed: {e}"))
        .ok()?;

    // dHash: resize to 9x8, compare adjacent pixels row-wise -> 64-bit hash
    let small = img
        .grayscale()
        .resize_exact(9, 8, image::imageops::FilterType::Lanczos3);
    let pixels: Vec<u8> = small.to_luma8().into_raw();

    let mut hash: u64 = 0;
    for row in 0..8 {
        for col in 0..8 {
            let left = pixels[row * 9 + col] as u16;
            let right = pixels[row * 9 + col + 1] as u16;
            hash = (hash << 1) | if left > right { 1 } else { 0 };
        }
    }

    Some(format!("{:016x}", hash))
}

fn compute_sha256(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    hex::encode(hasher.finalize())
}

fn process_image_file(file_path: &Path) -> Option<ImageInfo> {
    let meta = fs::metadata(file_path).ok()?;
    let size = meta.len();
    let mtime = system_time_to_unix(meta.modified().ok()?);
    let created_at = system_time_to_unix(meta.created().unwrap_or(SystemTime::UNIX_EPOCH));
    let path_str = file_path.to_string_lossy().to_string();

    // cache hit — skip all processing
    if let Some(cached) = cache_get(&path_str, mtime, size) {
        return Some(cached);
    }

    // cache miss — read and process the file
    let bytes = fs::read(file_path).ok()?;
    let mut exif = compute_exif(&bytes);
    let phash = compute_phash(&bytes);
    let sha1 = Some(compute_sha256(&bytes));

    // fallback: if EXIF didn't provide dimensions (common for PNG/WebP),
    // read from image headers. image::image_dimensions() only reads the file
    // header so it's very cheap — no full decode.
    let needs_dims = exif.as_ref().map_or(true, |e| e.width.is_none());
    if needs_dims {
        if let Ok((w, h)) = image::image_dimensions(file_path) {
            match exif {
                Some(ref mut e) => {
                    e.width = Some(w);
                    e.height = Some(h);
                }
                None => {
                    exif = Some(ExifData {
                        date: None,
                        make: None,
                        model: None,
                        width: Some(w),
                        height: Some(h),
                    });
                }
            }
        }
    }

    let info = ImageInfo {
        path: path_str,
        name: file_path.file_name()?.to_string_lossy().to_string(),
        size,
        created_at,
        modified_at: mtime,
        phash,
        sha1,
        exif,
    };

    if let Err(e) = cache_set(&info) {
        eprintln!("Cache write error for {:?}: {}", file_path, e);
    }

    Some(info)
}

// hamming distance between two hex-encoded hashes
fn phash_distance(a: &str, b: &str) -> u32 {
    let a_bytes = hex::decode(a).unwrap_or_default();
    let b_bytes = hex::decode(b).unwrap_or_default();
    if a_bytes.len() != b_bytes.len() {
        return u32::MAX;
    }
    a_bytes
        .iter()
        .zip(b_bytes.iter())
        .map(|(x, y)| (x ^ y).count_ones())
        .sum()
}

// tauri commands

#[tauri::command]
fn scan_folder(
    folder_path: String,
    recursive: bool,
    app: tauri::AppHandle,
) -> Result<Vec<ImageInfo>, String> {
    println!("Scanning: {} (recursive: {})", folder_path, recursive);

    let walker = WalkDir::new(&folder_path);
    let walker = if recursive {
        walker
    } else {
        walker.max_depth(1)
    };

    let paths: Vec<std::path::PathBuf> = walker
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
        .filter(|e| {
            e.path()
                .extension()
                .and_then(|ext| ext.to_str())
                .map(|ext| IMAGE_EXTS.contains(&ext.to_lowercase().as_str()))
                .unwrap_or(false)
        })
        .map(|e| e.path().to_path_buf())
        .collect();

    let total = paths.len();
    println!("Found {} image files", total);

    // emit initial event so the frontend knows the total right away
    let _ = app.emit("scan-progress", ScanProgress { current: 0, total });

    let counter = Arc::new(AtomicUsize::new(0));

    let images: Vec<ImageInfo> = paths
        .par_iter()
        .filter_map(|p| {
            let result = process_image_file(p);
            let current = counter.fetch_add(1, Ordering::Relaxed) + 1;
            // throttle events: emit every 10 files and on the last one to avoid flooding the frontend
            if current % 10 == 0 || current == total {
                let _ = app.emit("scan-progress", ScanProgress { current, total });
            }
            result
        })
        .collect();

    // clean up cache rows for files that have been deleted since the last scan
    let valid_paths: Vec<String> = images.iter().map(|i| i.path.clone()).collect();
    if let Err(e) = cache_prune(&valid_paths) {
        eprintln!("Cache prune error: {}", e);
    }

    println!("Scan complete: {} images processed", images.len());
    Ok(images)
}

#[tauri::command]
fn find_similar_duplicates(images: Vec<ImageInfo>) -> Vec<Vec<ImageInfo>> {
    let with_hash: Vec<&ImageInfo> = images.iter().filter(|i| i.phash.is_some()).collect();

    let mut groups: Vec<Vec<ImageInfo>> = Vec::new();
    let mut processed = vec![false; with_hash.len()];

    for i in 0..with_hash.len() {
        if processed[i] {
            continue;
        }

        let mut group = vec![with_hash[i].clone()];

        for j in (i + 1)..with_hash.len() {
            if processed[j] {
                continue;
            }
            let hash_j = with_hash[j].phash.as_ref().unwrap();
            // compare against any existing group member, not just the seed image
            let is_similar = group.iter().any(|g| {
                phash_distance(g.phash.as_ref().unwrap(), hash_j) <= PHASH_THRESHOLD
            });
            if is_similar {
                group.push(with_hash[j].clone());
                processed[j] = true;
            }
        }

        if group.len() > 1 {
            groups.push(group);
            processed[i] = true;
        }
    }

    groups
}

#[tauri::command]
fn find_exact_duplicates(images: Vec<ImageInfo>) -> Vec<Vec<ImageInfo>> {
    // group by sha256 hash, anything with more than one entry is a duplicate
    let mut map: std::collections::HashMap<String, Vec<ImageInfo>> =
        std::collections::HashMap::new();

    for img in images {
        if let Some(ref sha1) = img.sha1 {
            map.entry(sha1.clone()).or_default().push(img);
        }
    }

    map.into_values().filter(|g| g.len() > 1).collect()
}

#[tauri::command]
fn delete_images(paths: Vec<String>) -> Vec<serde_json::Value> {
    paths
        .iter()
        .map(|path| match fs::remove_file(path) {
            Ok(_) => {
                // also remove from cache so it doesn't show up on next scan
                if let Ok(conn) = db().lock() {
                    let _ = conn.execute("DELETE FROM images WHERE path = ?1", params![path]);
                }
                serde_json::json!({ "path": path, "deleted": true })
            }
            Err(e) => {
                serde_json::json!({ "path": path, "deleted": false, "error": e.to_string() })
            }
        })
        .collect()
}

#[tauri::command]
fn open_image(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to resolve app data dir");

            std::fs::create_dir_all(&app_data_dir).expect("Failed to create app data dir");

            let dir_str = app_data_dir.to_string_lossy().to_string();
            let conn = init_db(&dir_str).expect("Failed to initialize DB");
            DB.set(Mutex::new(conn)).expect("DB already initialized");

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            scan_folder,
            find_similar_duplicates,
            find_exact_duplicates,
            delete_images,
            open_image,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}