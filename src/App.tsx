import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { ImageCard } from "./components/ImageCard";
import { FilterBar } from "./components/FilterBar";
import { DuplicateView } from "./components/DuplicateView";

// shared types used across components
export interface ExifData {
  date: number | null;
  make: string | null;
  model: string | null;
  width: number | null;
  height: number | null;
}

export interface ImageInfo {
  path: string;
  name: string;
  size: number;
  created_at: number;
  modified_at: number;
  phash: string | null;
  sha1: string | null;
  exif: ExifData | null;
}

interface ScanProgress {
  current: number;
  total: number;
}

function App() {
  const [images, setImages] = useState<ImageInfo[]>([]);
  const [duplicates, setDuplicates] = useState<ImageInfo[][]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [folderPath, setFolderPath] = useState("");
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [duplicateMode, setDuplicateMode] = useState<"similar" | "exact">("similar");
  const [similarCount, setSimilarCount] = useState<number | null>(null);
  const [exactCount, setExactCount] = useState<number | null>(null);
  const [recursive, setRecursive] = useState(true);

  // filter state
  const [yearFilter, setYearFilter] = useState("");
  const [selectedYears, setSelectedYears] = useState<string[]>([]);
  const [groupByYear, setGroupByYear] = useState(false);

  // helpers

  const getImageYear = (img: ImageInfo): string | null => {
    const ts = img.exif?.date ?? img.created_at;
    if (!ts) return null;
    return new Date(ts * 1000).getFullYear().toString();
  };

  // dedupe and sort descending so newest years show first
  const availableYears = Array.from(
    new Set(images.map(getImageYear).filter(Boolean) as string[])
  ).sort((a, b) => Number(b) - Number(a));

  // checkbox selection takes priority over the text input filter
  const filteredImages =
    selectedYears.length > 0
      ? images.filter((img) => {
          const y = getImageYear(img);
          return y && selectedYears.includes(y);
        })
      : yearFilter.trim() === ""
      ? images
      : images.filter((img) => {
          const y = getImageYear(img);
          return y && y.startsWith(yearFilter);
        });

  const groupedByYear = groupByYear
    ? filteredImages.reduce<Record<string, ImageInfo[]>>((groups, img) => {
        const year = getImageYear(img);
        if (year) {
          if (!groups[year]) groups[year] = [];
          groups[year].push(img);
        }
        return groups;
      }, {})
    : {};

  const sortedYears = Object.keys(groupedByYear).sort((a, b) => Number(b) - Number(a));

  // actions

  const handleScanFolder = async () => {
    if (!folderPath.trim()) {
      setError("Please enter a folder path");
      return;
    }
    setLoading(true);
    setError("");
    setScanProgress(null);
    setLoadingMessage("Scanning folder...");

    // wire up progress events from the Rust backend before the invoke call
    const unlisten = await listen<ScanProgress>("scan-progress", (event) => {
      setScanProgress(event.payload);
    });

    try {
      const result = await invoke<ImageInfo[]>("scan_folder", {
        folderPath: folderPath.trim(),
        recursive,
      });
      setImages(result);
      setCurrentPath(folderPath.trim());
      // reset duplicate counts since they're stale after a new scan
      setSimilarCount(null);
      setExactCount(null);
    } catch (e) {
      setError(String(e));
    } finally {
      unlisten();
      setLoading(false);
      setLoadingMessage("");
      setScanProgress(null);
    }
  };

  const handleSimilarDuplicates = async () => {
    setLoading(true);
    setLoadingMessage("Finding similar duplicates...");
    try {
      const result = await invoke<ImageInfo[][]>("find_similar_duplicates", { images });
      setDuplicates(result);
      setSimilarCount(result.length);
      setDuplicateMode("similar");
      setShowDuplicates(true);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
      setLoadingMessage("");
    }
  };

  const handleExactDuplicates = async () => {
    setLoading(true);
    setLoadingMessage("Finding exact duplicates...");
    try {
      const result = await invoke<ImageInfo[][]>("find_exact_duplicates", { images });
      setDuplicates(result);
      setExactCount(result.length);
      setDuplicateMode("exact");
      setShowDuplicates(true);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
      setLoadingMessage("");
    }
  };

  const handleDelete = async (paths: string[]) => {
    const results = await invoke<{ path: string; deleted: boolean }[]>("delete_images", { paths });
    const deletedPaths = new Set(results.filter((r) => r.deleted).map((r) => r.path));
    // remove deleted images from both the main list and the duplicate groups
    setImages((prev) => prev.filter((img) => !deletedPaths.has(img.path)));
    setDuplicates((prev) =>
      prev
        .map((group) => group.filter((img) => !deletedPaths.has(img.path)))
        .filter((group) => group.length > 1) // drop groups that are no longer actual duplicates
    );
  };

  const handleYearToggle = (year: string) => {
    setSelectedYears((prev) =>
      prev.includes(year) ? prev.filter((y) => y !== year) : [...prev, year]
    );
  };

  const handleReset = () => {
    setCurrentPath(null);
    setImages([]);
    setDuplicates([]);
    setFolderPath("");
    setSimilarCount(null);
    setExactCount(null);
    setShowDuplicates(false);
    setSelectedYears([]);
    setYearFilter("");
  };

  // path selection screen — shown before any folder has been scanned
  if (!currentPath) {
    return (
      <div style={{ padding: 16, maxWidth: 600, margin: "0 auto" }}>
        <h1>Image Viewer</h1>
        <h2>Select Image Directory</h2>
        <p style={{ color: "#666" }}>
          Enter the full path to the directory containing your images.
        </p>
        <p style={{ color: "#666", fontSize: "0.9em" }}>
          <strong>Example:</strong> C:\Users\You\Pictures
        </p>
        <input
          type="text"
          value={folderPath}
          onChange={(e) => setFolderPath(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleScanFolder()}
          placeholder="C:\Users\You\Pictures"
          style={{
            width: "100%", padding: 12, fontSize: 16,
            border: "2px solid #ddd", borderRadius: 4,
            marginBottom: 12, boxSizing: "border-box",
          }}
        />

        <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={recursive}
            onChange={(e) => setRecursive(e.target.checked)}
          />
          <span>Include subfolders</span>
        </label>

        {error && (
          <div style={{
            color: "#dc3545", padding: 12, background: "#f8d7da",
            border: "1px solid #f5c6cb", borderRadius: 4, marginBottom: 12,
          }}>
            {error}
          </div>
        )}
        <button
          onClick={handleScanFolder}
          disabled={loading}
          style={{
            width: "100%", padding: 12, fontSize: 16,
            background: loading ? "#6c757d" : "#007bff",
            color: "white", border: "none", borderRadius: 4,
            cursor: loading ? "not-allowed" : "pointer", fontWeight: "bold",
          }}
        >
          {loading ? loadingMessage : "Scan Folder"}
        </button>
      </div>
    );
  }

  // loading screen — shown during scans and duplicate searches
  if (loading) {
    const pct = scanProgress && scanProgress.total > 0
      ? Math.round((scanProgress.current / scanProgress.total) * 100)
      : null;

    return (
      <div style={{ padding: 32, textAlign: "center", maxWidth: 500, margin: "0 auto" }}>
        <p style={{ fontSize: 18, marginBottom: 24 }}>{loadingMessage}</p>

        {scanProgress && scanProgress.total > 0 ? (
          <>
            <div style={{
              width: "100%", background: "#e9ecef",
              borderRadius: 8, height: 12, marginBottom: 12, overflow: "hidden",
            }}>
              <div style={{
                width: `${pct}%`, background: "#007bff",
                height: "100%", borderRadius: 8,
                transition: "width 0.15s ease",
              }} />
            </div>
            <p style={{ color: "#666", margin: 0 }}>
              {scanProgress.current} / {scanProgress.total} images
              {pct !== null && ` (${pct}%)`}
            </p>
          </>
        ) : (
          // no progress info yet — happens briefly at the start of a scan
          <p style={{ color: "#666" }}>This may take a moment on first scan...</p>
        )}
      </div>
    );
  }

  // main view
  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h1 style={{ margin: 0 }}>Image Viewer</h1>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: "0.9em" }}>
            <input
              type="checkbox"
              checked={recursive}
              onChange={(e) => setRecursive(e.target.checked)}
            />
            Include subfolders
          </label>
          <button
            onClick={handleReset}
            style={{ padding: "8px 16px", background: "#6c757d", color: "white", border: "none", borderRadius: 4, cursor: "pointer" }}
          >
            Change Folder
          </button>
        </div>
      </div>

      <div style={{ color: "#666", fontSize: "0.9em", marginBottom: 16 }}>
        <strong>{currentPath}</strong> — {images.length} images
      </div>

      <FilterBar
        year={yearFilter}
        onYearChange={setYearFilter}
        selectedYears={selectedYears}
        onYearToggle={handleYearToggle}
        availableYears={availableYears}
        groupByYear={groupByYear}
        onGroupByYearChange={setGroupByYear}
      />

      {/* view toggle — all photos vs duplicate modes */}
      <div style={{ marginBottom: 16, display: "flex", gap: 8 }}>
        <button
          onClick={() => setShowDuplicates(false)}
          style={{
            background: !showDuplicates ? "#007bff" : "#6c757d",
            color: "white", padding: "8px 16px", border: "none",
            borderRadius: 4, fontWeight: !showDuplicates ? "bold" : "normal",
            cursor: "pointer",
          }}
        >
          All Photos ({images.length})
        </button>
        <button
          onClick={handleSimilarDuplicates}
          style={{
            background: showDuplicates && duplicateMode === "similar" ? "#28a745" : "#6c757d",
            color: "white", padding: "8px 16px", border: "none",
            borderRadius: 4, fontWeight: showDuplicates && duplicateMode === "similar" ? "bold" : "normal",
            cursor: "pointer",
          }}
        >
          Similar Duplicates {similarCount !== null ? `(${similarCount})` : ""}
        </button>
        <button
          onClick={handleExactDuplicates}
          style={{
            background: showDuplicates && duplicateMode === "exact" ? "#ffc107" : "#6c757d",
            color: duplicateMode === "exact" && showDuplicates ? "#000" : "white",
            padding: "8px 16px", border: "none",
            borderRadius: 4, fontWeight: showDuplicates && duplicateMode === "exact" ? "bold" : "normal",
            cursor: "pointer",
          }}
        >
          Exact Duplicates {exactCount !== null ? `(${exactCount})` : ""}
        </button>
      </div>

      {!showDuplicates ? (
        groupByYear ? (
          sortedYears.length > 0 ? (
            sortedYears.map((year) => (
              <section key={year} style={{ marginBottom: 32 }}>
                <h2>{year} ({groupedByYear[year].length} images)</h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
                  {groupedByYear[year].map((img) => (
                    <ImageCard key={img.path} image={img} />
                  ))}
                </div>
              </section>
            ))
          ) : (
            <p>No images found for the selected years.</p>
          )
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
            {filteredImages.map((img) => <ImageCard key={img.path} image={img} />)}
          </div>
        )
      ) : (
        <DuplicateView duplicates={duplicates} onDelete={handleDelete} />
      )}
    </div>
  );
}

export default App;