import { useState } from "react";
import { ImageInfo } from "../App";
import { ImageCard } from "./ImageCard";

interface DuplicateViewProps {
  duplicates: ImageInfo[][];
  onDelete: (paths: string[]) => Promise<void>;
}

export function DuplicateView({ duplicates, onDelete }: DuplicateViewProps) {
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);

  // pick the best image in a group by resolution, fall back to file size if it's a tie
  const getHighestResImage = (group: ImageInfo[]): ImageInfo => {
    return group.reduce((best, img) => {
      const bestArea = (best.exif?.width ?? 0) * (best.exif?.height ?? 0);
      const imgArea = (img.exif?.width ?? 0) * (img.exif?.height ?? 0);
      if (imgArea > bestArea) return img;
      // if resolution is equal or unknown, prefer the larger file size
      if (imgArea === bestArea) return img.size > best.size ? img : best;
      return best;
    }, group[0]);
  };

  const toggleSelection = (path: string) => {
    setSelectedPaths((prev) =>
      prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]
    );
  };

  // auto-selects everything except the best image in each group
  const selectAllExceptOriginals = () => {
    const toSelect: string[] = [];
    duplicates.forEach((group) => {
      const original = getHighestResImage(group);
      group.forEach((img) => {
        if (img.path !== original.path) toSelect.push(img.path);
      });
    });
    setSelectedPaths(toSelect);
  };

  const bulkDelete = async () => {
    if (selectedPaths.length === 0) return;
    if (!confirm(`Delete ${selectedPaths.length} images?`)) return;
    try {
      await onDelete(selectedPaths);
      setSelectedPaths([]);
    } catch (err) {
      alert("Delete failed: " + err);
    }
  };

  // max deletable = total images minus one "original" kept per group
  const totalImages = duplicates.reduce((sum, g) => sum + g.length, 0);
  const maxDeletable = totalImages - duplicates.length;

  return (
    <div>
      <div style={{
        marginBottom: 24, padding: 12, background: "#f8f9fa", borderRadius: 8,
        display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap"
      }}>
        <strong>Selected: {selectedPaths.length} / {maxDeletable} copies</strong>
        <span style={{ fontSize: "0.9em", color: "#6c757d" }}>
          ({totalImages} total, {duplicates.length} originals)
        </span>
        <button onClick={selectAllExceptOriginals} style={{
          background: "#ffc107", color: "#856404", padding: "8px 16px",
          border: "1px solid #ffc107", borderRadius: 4, fontWeight: "bold"
        }}>
          Select All Except Originals
        </button>
        <button onClick={() => setSelectedPaths([])} style={{
          background: "#6c757d", color: "white", padding: "8px 12px",
          border: "none", borderRadius: 4
        }}>
          Deselect
        </button>
        <button onClick={bulkDelete} disabled={selectedPaths.length === 0} style={{
          background: "#dc3545", color: "white", padding: "8px 16px",
          border: "none", borderRadius: 4, fontWeight: "bold",
          opacity: selectedPaths.length === 0 ? 0.5 : 1
        }}>
          Delete Selected ({selectedPaths.length})
        </button>
      </div>

      {duplicates.length === 0 ? (
        <p>No duplicates found.</p>
      ) : (
        duplicates.map((group, groupIndex) => {
          const original = getHighestResImage(group);
          // sort by creation date so oldest (most likely the original) shows up first
          const sorted = [...group].sort((a, b) => a.created_at - b.created_at);

          return (
            <section key={groupIndex} style={{ marginBottom: 32 }}>
              <h3 style={{ marginBottom: 12, color: "#495057", borderBottom: "2px solid #dee2e6", paddingBottom: 8 }}>
                Group {groupIndex + 1}: {group.length} copies
                <span style={{ fontSize: "0.9em", color: "#6c757d", marginLeft: 8 }}>
                  (Keep: {original.exif?.width}×{original.exif?.height})
                </span>
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
                {sorted.map((img) => {
                  const isOriginal = img.path === original.path;
                  const isSelected = selectedPaths.includes(img.path);
                  return (
                    <div key={img.path} style={{ position: "relative" }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={isOriginal}
                        onChange={() => !isOriginal && toggleSelection(img.path)}
                        style={{
                          position: "absolute", top: 8, left: 8, zIndex: 10,
                          width: 20, height: 20,
                          accentColor: "#007bff",
                          cursor: isOriginal ? "not-allowed" : "pointer",
                          opacity: isOriginal ? 0.3 : 1, // dim it so it's obvious you can't check it
                        }}
                      />
                      <div style={{
                        // gold border = original, blue = selected, gray = untouched
                        border: isOriginal ? "4px solid #ffd700" : isSelected ? "3px solid #007bff" : "1px solid #ddd",
                        borderRadius: 8, overflow: "hidden",
                        background: isOriginal ? "#fff3cd" : isSelected ? "#d1ecf1" : "white",
                        transition: "all 0.2s ease"
                      }}>
                        <ImageCard image={img} />
                      </div>
                      {isOriginal && (
                        <div style={{
                          position: "absolute", top: -8, right: -8,
                          background: "#ffd700", color: "#856404",
                          padding: "2px 6px", borderRadius: "50%",
                          fontSize: 10, fontWeight: "bold",
                          boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
                        }}>
                          ORIGINAL
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}