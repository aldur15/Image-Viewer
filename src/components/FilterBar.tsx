import { useState, useEffect } from "react";

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
  // keep a local copy so the input stays responsive while typing
  const [localYear, setLocalYear] = useState(year ?? "");

  // sync back up if the parent resets the year externally
  useEffect(() => { setLocalYear(year ?? ""); }, [year]);

  const handleYearChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // strip non-numeric chars so users can't type garbage into the year field
    const value = e.target.value.replace(/\D/g, "");
    setLocalYear(value);
    onYearChange(value);
  };

  const toggleGroupByYear = () => {
    const newValue = !groupByYear;
    onGroupByYearChange(newValue);
    // clear the manual year filter when switching to group mode, they conflict
    if (!groupByYear && localYear) {
      setLocalYear("");
      onYearChange("");
    }
  };

  return (
    <div style={{ marginBottom: 16, display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
      <div>
        <label>
          Year:{" "}
          <input
            type="text"
            inputMode="numeric"
            placeholder="e.g. 2021"
            value={localYear}
            onChange={handleYearChange}
            disabled={groupByYear}
            style={{ width: 100, padding: "4px 8px", border: "1px solid #ddd", borderRadius: 4 }}
          />
        </label>
      </div>

      {/* scrollable checkbox list, capped at 120px so it doesn't take over the layout */}
      <div style={{
        display: "flex", flexDirection: "column", gap: 4,
        maxHeight: 120, overflowY: "auto",
        border: "1px solid #ddd", borderRadius: 4, padding: 8, background: "#f8f9fa"
      }}>
        <label style={{ fontSize: "0.9em", fontWeight: "bold", marginBottom: 4 }}>Filter by Year:</label>
        {availableYears.map((y) => (
          <label key={y} style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", fontSize: "0.85em" }}>
            <input
              type="checkbox"
              checked={selectedYears.includes(y)}
              onChange={() => onYearToggle(y)}
              disabled={groupByYear} // checkboxes don't make sense when grouping is on
            />
            {y}
          </label>
        ))}
        {availableYears.length === 0 && <span>No years available</span>}
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
        <input type="checkbox" checked={groupByYear} onChange={toggleGroupByYear} />
        Group by Year
      </label>
    </div>
  );
}