import { useState } from "react";
import { ImageInfo } from "../App";
import { ImageCard } from "./ImageCard";
import { t } from "../theme";

interface DuplicateViewProps {
  duplicates: ImageInfo[][];
  onDelete: (paths: string[]) => Promise<void>;
}

export function DuplicateView({ duplicates, onDelete }: DuplicateViewProps) {
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);

  // pick the best image in a group by resolution, then file size as tiebreaker
  const getHighestResImage = (group: ImageInfo[]): ImageInfo =>
    group.reduce((best, img) => {
      const bestArea = (best.exif?.width ?? 0) * (best.exif?.height ?? 0);
      const imgArea  = (img.exif?.width  ?? 0) * (img.exif?.height  ?? 0);
      if (imgArea > bestArea) return img;
      if (imgArea === bestArea) return img.size > best.size ? img : best;
      return best;
    }, group[0]);

  const toggleSelection = (path: string) => {
    setSelectedPaths((prev) =>
      prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]
    );
  };

  const selectAllExceptOriginals = () => {
    const toSelect: string[] = [];
    duplicates.forEach((group) => {
      const original = getHighestResImage(group);
      group.forEach((img) => { if (img.path !== original.path) toSelect.push(img.path); });
    });
    setSelectedPaths(toSelect);
  };

  const bulkDelete = async () => {
    if (selectedPaths.length === 0) return;
    if (!confirm(`Permanently delete ${selectedPaths.length} image${selectedPaths.length !== 1 ? "s" : ""}?`)) return;
    setDeleting(true);
    try {
      await onDelete(selectedPaths);
      setSelectedPaths([]);
    } catch (err) {
      alert("Delete failed: " + err);
    } finally {
      setDeleting(false);
    }
  };

  const totalImages   = duplicates.reduce((sum, g) => sum + g.length, 0);
  const maxDeletable  = totalImages - duplicates.length;

  // ── Empty state ────────────────────────────────────────────────────────────

  if (duplicates.length === 0) {
    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", padding: "80px 20px", color: "#3A3A3A", gap: 12,
      }}>
        <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
        <p style={{ fontSize: 14 }}>No duplicates found — your library is clean!</p>
      </div>
    );
  }

  // ── Main ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ paddingBottom: 80 }}>

      {/* Summary info */}
      <div style={{
        display: "flex", gap: 16, marginBottom: 20, flexWrap: "wrap",
      }}>
        {[
          { label: "Groups", value: duplicates.length },
          { label: "Total copies", value: totalImages },
          { label: "Can remove", value: maxDeletable },
        ].map(({ label, value }) => (
          <div key={label} style={{
            padding: "10px 16px",
            background: t.surface, border: `1px solid ${t.border}`,
            borderRadius: 10, minWidth: 90,
          }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: t.text, letterSpacing: "-0.03em" }}>
              {value}
            </div>
            <div style={{ fontSize: 11, color: t.text3, marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
        {[
          { color: t.accent, label: "Best quality — will be kept" },
          { color: t.red,    label: "Marked for deletion" },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
            <span style={{ fontSize: 11, color: t.text2 }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Duplicate groups */}
      {duplicates.map((group, groupIndex) => {
        const original = getHighestResImage(group);
        // sort by date, original always first
        const sorted = [...group].sort((a, b) => a.created_at - b.created_at);
        const originalIndex = sorted.findIndex((img) => img.path === original.path);
        if (originalIndex > 0) sorted.unshift(sorted.splice(originalIndex, 1)[0]);

        return (
          <section key={groupIndex} style={{ marginBottom: 32 }}>
            {/* Group header */}
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              paddingBottom: 10, marginBottom: 14,
              borderBottom: `1px solid ${t.border}`,
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: t.text3,
                letterSpacing: "0.07em", textTransform: "uppercase" }}>
                Group {groupIndex + 1}
              </span>
              <span style={{
                fontSize: 11, color: t.text2,
                padding: "2px 8px", background: t.surface2,
                border: `1px solid ${t.border2}`, borderRadius: 20,
              }}>
                {group.length} copies
              </span>
              {original.exif?.width && original.exif?.height && (
                <span style={{ fontSize: 11, color: t.text3 }}>
                  Best: {original.exif.width} × {original.exif.height}
                </span>
              )}
            </div>

            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: 12,
            }}>
              {sorted.map((img) => {
                const isOriginal = img.path === original.path;
                const isSelected = selectedPaths.includes(img.path);

                return (
                  <div
                    key={img.path}
                    className={`dup-card ${isOriginal ? "original" : isSelected ? "selected" : "neutral"}`}
                    onClick={() => !isOriginal && toggleSelection(img.path)}
                    style={{ position: "relative" }}
                  >
                    {/* Top badge */}
                    {isOriginal ? (
                      <div style={{
                        position: "absolute", top: 8, left: 8, zIndex: 10,
                        background: t.accent, color: "#000",
                        padding: "2px 8px", borderRadius: 20,
                        fontSize: 10, fontWeight: 700, letterSpacing: "0.04em",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
                      }}>
                        ✓ KEEP
                      </div>
                    ) : (
                      <div style={{
                        position: "absolute", top: 8, left: 8, zIndex: 10,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <div style={{
                          width: 20, height: 20, borderRadius: "50%",
                          background: isSelected ? t.red : "rgba(0,0,0,0.5)",
                          border: isSelected ? `2px solid ${t.red}` : "2px solid rgba(255,255,255,0.3)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          transition: "all 0.15s ease",
                          cursor: "pointer",
                        }}>
                          {isSelected && (
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                              stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Deletion overlay */}
                    {isSelected && (
                      <div style={{
                        position: "absolute", inset: 0, zIndex: 5,
                        background: "rgba(239,68,68,0.08)",
                        pointerEvents: "none",
                        borderRadius: 8,
                      }} />
                    )}

                    <ImageCard image={img} />
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {/* ── Sticky action bar ── */}
      <div style={{
        position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)",
        zIndex: 200,
        background: t.surface, border: `1px solid ${t.border2}`,
        borderRadius: 14, padding: "10px 16px",
        display: "flex", alignItems: "center", gap: 10,
        boxShadow: "0 8px 32px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.4)",
        backdropFilter: "blur(12px)",
        flexWrap: "wrap",
      }}>
        {/* Selection summary */}
        <div style={{ fontSize: 13, color: t.text2, marginRight: 4 }}>
          <span style={{ fontWeight: 600, color: selectedPaths.length > 0 ? t.red : t.text }}>
            {selectedPaths.length}
          </span>
          <span style={{ color: t.text3 }}>
            {" "}/ {maxDeletable} selected
          </span>
        </div>

        <div style={{ width: 1, height: 20, background: t.border2 }} />

        <button
          className="btn btn-warn"
          onClick={selectAllExceptOriginals}
          style={{ fontSize: 12, padding: "6px 12px" }}
        >
          Select All Copies
        </button>

        <button
          className="btn btn-ghost"
          onClick={() => setSelectedPaths([])}
          disabled={selectedPaths.length === 0}
          style={{ fontSize: 12, padding: "6px 12px" }}
        >
          Deselect
        </button>

        <button
          className="btn btn-danger"
          onClick={bulkDelete}
          disabled={selectedPaths.length === 0 || deleting}
          style={{ fontSize: 12, padding: "6px 14px", fontWeight: 700 }}
        >
          {deleting ? "Deleting…" : `Delete ${selectedPaths.length > 0 ? selectedPaths.length : ""}`}
        </button>
      </div>
    </div>
  );
}