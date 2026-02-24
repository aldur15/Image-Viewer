import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { convertFileSrc } from "@tauri-apps/api/core";
import { ImageInfo } from "../App";
import { t } from "../theme";

export function ImageCard({ image }: { image: ImageInfo }) {
  const [hovered, setHovered] = useState(false);
  const [imgError, setImgError] = useState(false);

  const getDate = () => {
    const ts = image.exif?.date ?? image.created_at;
    if (!ts) return null;
    return new Date(ts * 1000).toLocaleDateString(undefined, {
      year: "numeric", month: "short", day: "numeric",
    });
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const handleOpen = () => {
    invoke("open_image", { path: image.path }).catch(console.error);
  };

  const src = convertFileSrc(image.path);
  const date = getDate();
  const hasDimensions = image.exif?.width && image.exif?.height;

  return (
    <div
      className="img-card"
      onClick={handleOpen}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={image.path}
    >
      {/* ── Thumbnail ── */}
      <div style={{ position: "relative", width: "100%", paddingBottom: "66%", background: t.surface2 }}>
        {!imgError ? (
          <img
            src={src}
            alt={image.name}
            onError={() => setImgError(true)}
            loading="lazy"
            style={{
              position: "absolute", inset: 0,
              width: "100%", height: "100%",
              objectFit: "cover", display: "block",
            }}
          />
        ) : (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: t.text3,
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
          </div>
        )}

        {/* Hover overlay with "open" hint */}
        <div style={{
          position: "absolute", inset: 0,
          background: "rgba(0,0,0,0.45)",
          display: "flex", alignItems: "center", justifyContent: "center",
          opacity: hovered ? 1 : 0,
          transition: "opacity 0.15s ease",
        }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 5,
            background: "rgba(255,255,255,0.12)", backdropFilter: "blur(6px)",
            padding: "5px 12px", borderRadius: 20,
            fontSize: 11, fontWeight: 600, color: "#fff",
            border: "1px solid rgba(255,255,255,0.15)",
          }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
            Open
          </div>
        </div>
      </div>

      {/* ── Info panel ── */}
      <div style={{ padding: "10px 12px" }}>
        {/* Filename */}
        <div style={{
          fontSize: 12, fontWeight: 600, color: t.text,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          marginBottom: 5,
        }} title={image.name}>
          {image.name}
        </div>

        {/* Meta row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
          <span style={{ fontSize: 11, color: t.text2 }}>
            {date ?? "—"}
          </span>
          <span style={{ fontSize: 11, color: t.text3 }}>
            {formatSize(image.size)}
          </span>
        </div>

        {/* Dimensions + camera model */}
        {(hasDimensions || image.exif?.model) && (
          <div style={{ marginTop: 5, display: "flex", flexWrap: "wrap", gap: "3px 8px" }}>
            {hasDimensions && (
              <span style={{
                fontSize: 10, color: t.text3,
                background: t.surface2, padding: "1px 6px",
                borderRadius: 4, border: `1px solid ${t.border}`,
              }}>
                {image.exif!.width} × {image.exif!.height}
              </span>
            )}
            {image.exif?.model && (
              <span style={{
                fontSize: 10, color: t.text3,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                maxWidth: "100%",
              }}>
                {image.exif.model}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}