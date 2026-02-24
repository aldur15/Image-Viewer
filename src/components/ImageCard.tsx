import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ImageInfo } from "../App";
import { convertFileSrc } from "@tauri-apps/api/core";

export function ImageCard({ image }: { image: ImageInfo }) {
  const [hovered, setHovered] = useState(false);

  // prefer exif date if available, fall back to file creation time
  const getDate = () => {
    const ts = image.exif?.date ?? image.created_at;
    if (!ts) return "Unknown date";
    return new Date(ts * 1000).toLocaleDateString();
  };

  // keeping this simple, don't need anything fancier than KB/MB for now
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const handleOpen = () => {
    // let the OS decide which app to open it with
    invoke("open_image", { path: image.path }).catch(console.error);
  };

  // tauri needs this to load local files in the webview
  const src = convertFileSrc(image.path);

  return (
    <div
      onClick={handleOpen}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title="Click to open in system viewer"
      style={{
        border: "1px solid #ddd",
        borderRadius: 8,
        overflow: "hidden",
        background: "white",
        cursor: "pointer",
        transform: hovered ? "translateY(-2px)" : "none",
        // slightly stronger shadow on hover to give a "lift" effect
        boxShadow: hovered ? "0 4px 12px rgba(0,0,0,0.15)" : "0 1px 3px rgba(0,0,0,0.08)",
        transition: "transform 0.15s ease, box-shadow 0.15s ease",
      }}
    >
      <img
        src={src}
        alt={image.name}
        style={{ width: "100%", height: 200, objectFit: "cover", display: "block" }}
        loading="lazy" // lazy load since there can be a lot of these
      />
      <div style={{ padding: 12 }}>
        {/* truncate long filenames with ellipsis */}
        <div
          style={{
            fontSize: "0.9em", fontWeight: "bold", marginBottom: 4,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}
          title={image.name}
        >
          {image.name}
        </div>
        <div style={{ fontSize: "0.8em", color: "#666" }}>
          <div>{getDate()}</div>
          <div>{formatSize(image.size)}</div>
          {/* dimensions are only in exif so not always available */}
          {image.exif?.width && (
            <div>{image.exif.width} × {image.exif.height}</div>
          )}
          {image.exif?.model && (
            <div style={{ marginTop: 4, fontStyle: "italic" }}>{image.exif.model}</div>
          )}
        </div>
      </div>
    </div>
  );
}