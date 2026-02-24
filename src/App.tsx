import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { ImageCard } from "./components/ImageCard";
import { FilterBar } from "./components/FilterBar";
import { DuplicateView } from "./components/DuplicateView";
import { globalCSS, t } from "./theme";

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

// ── Icons ─────────────────────────────────────────────────────────────────────

const IconFolder = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
  </svg>
);

const IconImages = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
    <polyline points="21 15 16 10 5 21"/>
  </svg>
);

const IconCopy = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
);

const IconArrow = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
  </svg>
);

const IconSpinner = () => (
  <svg className="spinner" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="2.5" strokeLinecap="round">
    <path d="M12 2a10 10 0 0 1 10 10" opacity="1"/>
    <path d="M12 2a10 10 0 0 0-10 10" opacity="0.2"/>
  </svg>
);

// ── App ───────────────────────────────────────────────────────────────────────

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

  const [yearFilter, setYearFilter] = useState("");
  const [selectedYears, setSelectedYears] = useState<string[]>([]);
  const [groupByYear, setGroupByYear] = useState(false);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const getImageYear = (img: ImageInfo): string | null => {
    const ts = img.exif?.date ?? img.created_at;
    if (!ts) return null;
    return new Date(ts * 1000).getFullYear().toString();
  };

  const availableYears = Array.from(
    new Set(images.map(getImageYear).filter(Boolean) as string[])
  ).sort((a, b) => Number(b) - Number(a));

  const filteredImages =
    selectedYears.length > 0
      ? images.filter((img) => { const y = getImageYear(img); return y && selectedYears.includes(y); })
      : yearFilter.trim() === ""
      ? images
      : images.filter((img) => { const y = getImageYear(img); return y && y.startsWith(yearFilter); });

  const groupedByYear = groupByYear
    ? filteredImages.reduce<Record<string, ImageInfo[]>>((groups, img) => {
        const year = getImageYear(img);
        if (year) { if (!groups[year]) groups[year] = []; groups[year].push(img); }
        return groups;
      }, {})
    : {};

  const sortedYears = Object.keys(groupedByYear).sort((a, b) => Number(b) - Number(a));

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleScanFolder = async () => {
    if (!folderPath.trim()) { setError("Please enter a folder path"); return; }
    setLoading(true); setError(""); setScanProgress(null);
    setLoadingMessage("Scanning folder…");
    const unlisten = await listen<ScanProgress>("scan-progress", (e) => setScanProgress(e.payload));
    try {
      const result = await invoke<ImageInfo[]>("scan_folder", { folderPath: folderPath.trim(), recursive });
      setImages(result);
      setCurrentPath(folderPath.trim());
      setSimilarCount(null); setExactCount(null);
    } catch (e) { setError(String(e)); }
    finally { unlisten(); setLoading(false); setLoadingMessage(""); setScanProgress(null); }
  };

  const handleSimilarDuplicates = async () => {
    setLoading(true); setLoadingMessage("Finding similar duplicates…");
    try {
      const result = await invoke<ImageInfo[][]>("find_similar_duplicates", { images });
      setDuplicates(result); setSimilarCount(result.length);
      setDuplicateMode("similar"); setShowDuplicates(true);
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); setLoadingMessage(""); }
  };

  const handleExactDuplicates = async () => {
    setLoading(true); setLoadingMessage("Finding exact duplicates…");
    try {
      const result = await invoke<ImageInfo[][]>("find_exact_duplicates", { images });
      setDuplicates(result); setExactCount(result.length);
      setDuplicateMode("exact"); setShowDuplicates(true);
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); setLoadingMessage(""); }
  };

  const handleDelete = async (paths: string[]) => {
    const results = await invoke<{ path: string; deleted: boolean }[]>("delete_images", { paths });
    const deletedPaths = new Set(results.filter((r) => r.deleted).map((r) => r.path));
    setImages((prev) => prev.filter((img) => !deletedPaths.has(img.path)));
    setDuplicates((prev) =>
      prev.map((g) => g.filter((img) => !deletedPaths.has(img.path))).filter((g) => g.length > 1)
    );
  };

  const handleYearToggle = (year: string) => {
    setSelectedYears((prev) => prev.includes(year) ? prev.filter((y) => y !== year) : [...prev, year]);
  };

  const handleReset = () => {
    setCurrentPath(null); setImages([]); setDuplicates([]);
    setFolderPath(""); setSimilarCount(null); setExactCount(null);
    setShowDuplicates(false); setSelectedYears([]); setYearFilter("");
  };

  // ── Toggle component ───────────────────────────────────────────────────────

  const Toggle = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
    <div className={`toggle-track ${checked ? "on" : ""}`} onClick={onChange}>
      <div className="toggle-knob" />
    </div>
  );

  // ── Folder-picker screen ───────────────────────────────────────────────────

  if (!currentPath) {
    return (
      <>
        <style>{globalCSS}</style>
        <div className="welcome-bg fade-up" style={{
          minHeight: "100vh", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", padding: 24,
        }}>
          <div style={{ width: "100%", maxWidth: 460 }}>

            {/* App identity */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 32 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: t.accentSoft, border: `1px solid ${t.accentBorder}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: t.accent,
              }}>
                <IconImages />
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em" }}>Image Viewer</div>
                <div style={{ fontSize: 12, color: t.text2, marginTop: 1 }}>Photo organiser &amp; duplicate finder</div>
              </div>
            </div>

            {/* Input card */}
            <div style={{
              background: t.surface, border: `1px solid ${t.border}`,
              borderRadius: 16, padding: 24,
            }}>
              <label style={{
                display: "block", fontSize: 11, fontWeight: 700,
                color: t.text3, letterSpacing: "0.08em", textTransform: "uppercase",
                marginBottom: 8,
              }}>
                Folder path
              </label>

              <div style={{ position: "relative", marginBottom: 14 }}>
                <span style={{
                  position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)",
                  color: t.text3, pointerEvents: "none",
                }}>
                  <IconFolder />
                </span>
                <input
                  className="text-input"
                  type="text"
                  value={folderPath}
                  onChange={(e) => setFolderPath(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleScanFolder()}
                  placeholder="C:\Users\You\Pictures"
                  style={{ width: "100%", paddingLeft: 40 }}
                />
              </div>

              <label style={{
                display: "flex", alignItems: "center", gap: 10,
                marginBottom: 20, cursor: "pointer", userSelect: "none",
              }}>
                <Toggle checked={recursive} onChange={() => setRecursive((v) => !v)} />
                <span style={{ fontSize: 13, color: t.text2 }}>Include subfolders</span>
              </label>

              {error && <div className="error-banner" style={{ marginBottom: 16 }}>{error}</div>}

              <button
                className="btn btn-accent btn-lg btn-full"
                onClick={handleScanFolder}
                disabled={loading}
              >
                {loading ? loadingMessage : <><IconArrow /> Scan Folder</>}
              </button>
            </div>

            <p style={{ marginTop: 14, textAlign: "center", fontSize: 11, color: t.text3 }}>
              Supports JPEG · PNG · HEIC · WEBP · TIFF
            </p>
          </div>
        </div>
      </>
    );
  }

  // ── Loading screen ─────────────────────────────────────────────────────────

  if (loading) {
    const pct = scanProgress && scanProgress.total > 0
      ? Math.round((scanProgress.current / scanProgress.total) * 100)
      : null;

    return (
      <>
        <style>{globalCSS}</style>
        <div style={{
          minHeight: "100vh", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 18,
        }}>
          <IconSpinner />
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{loadingMessage}</p>

            {scanProgress && scanProgress.total > 0 ? (
              <>
                <div style={{
                  width: 260, height: 3, background: t.surface3,
                  borderRadius: 2, overflow: "hidden", margin: "14px auto 8px",
                }}>
                  <div style={{
                    width: `${pct}%`, height: "100%",
                    background: `linear-gradient(90deg, ${t.accent}, #FBBF24)`,
                    borderRadius: 2, transition: "width 0.15s ease",
                  }} />
                </div>
                <p style={{ fontSize: 12, color: t.text2 }}>
                  {scanProgress.current.toLocaleString()} / {scanProgress.total.toLocaleString()}
                  {pct !== null && (
                    <span style={{ color: t.accent, marginLeft: 6, fontWeight: 600 }}>{pct}%</span>
                  )}
                </p>
              </>
            ) : (
              <p style={{ fontSize: 12, color: t.text2, marginTop: 6 }}>This may take a moment…</p>
            )}
          </div>
        </div>
      </>
    );
  }

  // ── Main view ──────────────────────────────────────────────────────────────

  return (
    <>
      <style>{globalCSS}</style>

      {/* ── Sticky header ── */}
      <header style={{
        position: "sticky", top: 0, zIndex: 100,
        background: `${t.bg}ee`, backdropFilter: "blur(14px)",
        borderBottom: `1px solid ${t.border}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 20px", height: 54, gap: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
          <span style={{ color: t.text3, flexShrink: 0 }}><IconFolder /></span>
          <span style={{
            fontSize: 12, color: t.text2, overflow: "hidden",
            textOverflow: "ellipsis", whiteSpace: "nowrap",
          }} title={currentPath}>
            {currentPath}
          </span>
          <span style={{
            flexShrink: 0,
            padding: "2px 8px", borderRadius: 20,
            background: t.surface2, border: `1px solid ${t.border2}`,
            fontSize: 11, fontWeight: 600, color: t.text2,
          }}>
            {images.length.toLocaleString()}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 7,
            cursor: "pointer", userSelect: "none" }}>
            <Toggle checked={recursive} onChange={() => setRecursive((v) => !v)} />
            <span style={{ fontSize: 12, color: t.text2 }}>Subfolders</span>
          </label>
          <button className="btn btn-ghost" onClick={handleReset}
            style={{ fontSize: 12, padding: "6px 12px" }}>
            Change Folder
          </button>
        </div>
      </header>

      {/* ── Tab bar ── */}
      <div className="tab-nav">
        <button
          className={`tab-btn ${!showDuplicates ? "active" : ""}`}
          onClick={() => setShowDuplicates(false)}
        >
          <IconImages />
          All Photos
          <span className="tab-badge">{filteredImages.length.toLocaleString()}</span>
        </button>
        <button
          className={`tab-btn ${showDuplicates && duplicateMode === "similar" ? "active" : ""}`}
          onClick={handleSimilarDuplicates}
        >
          <IconCopy />
          Similar
          {similarCount !== null && <span className="tab-badge">{similarCount}</span>}
        </button>
        <button
          className={`tab-btn ${showDuplicates && duplicateMode === "exact" ? "active" : ""}`}
          onClick={handleExactDuplicates}
        >
          <IconCopy />
          Exact Duplicates
          {exactCount !== null && <span className="tab-badge">{exactCount}</span>}
        </button>
      </div>

      {/* ── Page content ── */}
      <div style={{ padding: "16px 20px 80px" }}>

        {!showDuplicates && (
          <FilterBar
            year={yearFilter}
            onYearChange={setYearFilter}
            selectedYears={selectedYears}
            onYearToggle={handleYearToggle}
            availableYears={availableYears}
            groupByYear={groupByYear}
            onGroupByYearChange={setGroupByYear}
          />
        )}

        {!showDuplicates ? (
          groupByYear ? (
            sortedYears.length > 0 ? (
              sortedYears.map((year) => (
                <section key={year} style={{ marginBottom: 40 }}>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 10,
                    paddingBottom: 12, marginBottom: 14,
                    borderBottom: `1px solid ${t.border}`,
                  }}>
                    <h2 style={{ fontSize: 14, fontWeight: 700, color: t.text2 }}>{year}</h2>
                    <span style={{
                      fontSize: 11, color: t.text3,
                      padding: "2px 8px", background: t.surface2,
                      border: `1px solid ${t.border}`, borderRadius: 20,
                    }}>
                      {groupedByYear[year].length} photos
                    </span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 10 }}>
                    {groupedByYear[year].map((img) => <ImageCard key={img.path} image={img} />)}
                  </div>
                </section>
              ))
            ) : (
              <EmptyState message="No images for the selected years." />
            )
          ) : (
            filteredImages.length > 0 ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 10 }}>
                {filteredImages.map((img) => <ImageCard key={img.path} image={img} />)}
              </div>
            ) : (
              <EmptyState message="No images found." />
            )
          )
        ) : (
          <DuplicateView duplicates={duplicates} onDelete={handleDelete} />
        )}
      </div>
    </>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: "80px 20px", color: "#3A3A3A", gap: 12,
    }}>
      <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <circle cx="8.5" cy="8.5" r="1.5"/>
        <polyline points="21 15 16 10 5 21"/>
      </svg>
      <p style={{ fontSize: 14 }}>{message}</p>
    </div>
  );
}

export default App;