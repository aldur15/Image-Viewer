import { useState, useEffect } from "react";
import { t } from "../theme";

interface FilterBarProps {
  year: string;
  onYearChange: (year: string) => void;
  selectedYears: string[];
  onYearToggle: (year: string) => void;
  availableYears: string[];
  groupByYear: boolean;
  onGroupByYearChange: (value: boolean) => void;
}

export function FilterBar({
  year, onYearChange, selectedYears, onYearToggle,
  availableYears, groupByYear, onGroupByYearChange,
}: FilterBarProps) {
  const [localYear, setLocalYear] = useState(year ?? "");

  useEffect(() => { setLocalYear(year ?? ""); }, [year]);

  const handleYearChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 4);
    setLocalYear(value);
    onYearChange(value);
  };

  const toggleGroupByYear = () => {
    const next = !groupByYear;
    onGroupByYearChange(next);
    if (next && localYear) { setLocalYear(""); onYearChange(""); }
  };

  // nothing to show if no years available yet
  if (availableYears.length === 0) return null;

  const hasActiveFilter = selectedYears.length > 0 || localYear.trim() !== "";

  return (
    <div style={{
      marginBottom: 18,
      padding: "12px 14px",
      background: t.surface,
      border: `1px solid ${t.border}`,
      borderRadius: 10,
      display: "flex", flexWrap: "wrap",
      alignItems: "center", gap: "10px 16px",
    }}>

      {/* ── Year chips ── */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, flex: 1 }}>
        {/* "All" chip — clears both text filter and year selection */}
        <button
          className={`year-chip ${selectedYears.length === 0 && !localYear ? "active" : ""}`}
          onClick={() => { onYearChange(""); setLocalYear(""); selectedYears.slice().forEach(y => onYearToggle(y)); }}
          disabled={groupByYear}
          style={{ opacity: groupByYear ? 0.4 : 1 }}
        >
          All
        </button>

        {availableYears.map((y) => (
          <button
            key={y}
            className={`year-chip ${selectedYears.includes(y) ? "active" : ""}`}
            onClick={() => !groupByYear && onYearToggle(y)}
            disabled={groupByYear}
            style={{ opacity: groupByYear ? 0.4 : 1 }}
          >
            {y}
          </button>
        ))}
      </div>

      {/* ── Divider ── */}
      <div style={{ width: 1, height: 20, background: t.border2, flexShrink: 0 }} />

      {/* ── Year text search ── */}
      <input
        type="text"
        inputMode="numeric"
        value={localYear}
        onChange={handleYearChange}
        placeholder="Search year…"
        disabled={groupByYear || selectedYears.length > 0}
        style={{
          width: 100, padding: "5px 10px",
          background: t.surface2, color: t.text,
          border: `1px solid ${localYear ? t.accentBorder : t.border2}`,
          borderRadius: 8, fontSize: 12, fontFamily: "inherit",
          outline: "none", transition: "border-color 0.15s ease",
          opacity: (groupByYear || selectedYears.length > 0) ? 0.4 : 1,
        }}
      />

      {/* ── Divider ── */}
      <div style={{ width: 1, height: 20, background: t.border2, flexShrink: 0 }} />

      {/* ── Group by year toggle ── */}
      <label style={{ display: "flex", alignItems: "center", gap: 8,
        cursor: "pointer", userSelect: "none", flexShrink: 0 }}>
        <div className={`toggle-track ${groupByYear ? "on" : ""}`} onClick={toggleGroupByYear}>
          <div className="toggle-knob" />
        </div>
        <span style={{ fontSize: 12, color: t.text2 }}>Group by year</span>
      </label>

      {/* ── Clear button ── */}
      {hasActiveFilter && !groupByYear && (
        <button
          style={{
            fontSize: 11, color: t.text3, background: "none", border: "none",
            cursor: "pointer", padding: "2px 4px", fontFamily: "inherit",
            transition: "color 0.15s ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = t.text2)}
          onMouseLeave={(e) => (e.currentTarget.style.color = t.text3)}
          onClick={() => {
            setLocalYear(""); onYearChange("");
            selectedYears.slice().forEach((y) => onYearToggle(y));
          }}
        >
          Clear ×
        </button>
      )}
    </div>
  );
}