// Shared design tokens — import in any component that needs them
export const t = {
  bg:          "#0A0A0A",
  surface:     "#141414",
  surface2:    "#1D1D1D",
  surface3:    "#252525",
  border:      "#272727",
  border2:     "#363636",
  accent:      "#F59E0B",
  accentSoft:  "rgba(245,158,11,0.10)",
  accentBorder:"rgba(245,158,11,0.28)",
  blue:        "#3B82F6",
  blueSoft:    "rgba(59,130,246,0.10)",
  red:         "#EF4444",
  redSoft:     "rgba(239,68,68,0.10)",
  redBorder:   "rgba(239,68,68,0.25)",
  green:       "#22C55E",
  text:        "#F0F0F0",
  text2:       "#888888",
  text3:       "#484848",
  radius:      "10px",
  radiusSm:    "6px",
  radiusLg:    "16px",
};

// Global CSS string — inject once at the top of App.tsx via <style> tag
export const globalCSS = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:           ${t.bg};
    --surface:      ${t.surface};
    --surface2:     ${t.surface2};
    --surface3:     ${t.surface3};
    --border:       ${t.border};
    --border2:      ${t.border2};
    --accent:       ${t.accent};
    --accent-soft:  ${t.accentSoft};
    --accent-bd:    ${t.accentBorder};
    --blue:         ${t.blue};
    --blue-soft:    ${t.blueSoft};
    --red:          ${t.red};
    --red-soft:     ${t.redSoft};
    --red-bd:       ${t.redBorder};
    --green:        ${t.green};
    --text:         ${t.text};
    --text2:        ${t.text2};
    --text3:        ${t.text3};
    --ease:         0.15s ease;
    --font:         'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
  }

  html, body, #root {
    height: 100%;
    background: var(--bg);
    color: var(--text);
    font-family: var(--font);
    font-size: 14px;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }

  ::-webkit-scrollbar            { width: 5px; height: 5px; }
  ::-webkit-scrollbar-track      { background: transparent; }
  ::-webkit-scrollbar-thumb      { background: var(--border2); border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover{ background: #505050; }

  /* ── Buttons ── */
  .btn {
    display: inline-flex; align-items: center; gap: 6px;
    font-family: var(--font); font-size: 13px; font-weight: 600;
    border: none; border-radius: 8px; padding: 8px 14px;
    cursor: pointer; transition: all var(--ease);
    white-space: nowrap; letter-spacing: 0.01em;
  }
  .btn:active { transform: scale(0.97); }
  .btn:disabled { opacity: 0.35; cursor: not-allowed; pointer-events: none; }

  .btn-accent  { background: var(--accent); color: #000; }
  .btn-accent:hover  { background: #FBBF24; }

  .btn-ghost   { background: var(--surface2); color: var(--text2); border: 1px solid var(--border2); }
  .btn-ghost:hover   { background: var(--surface3); color: var(--text); border-color: #444; }

  .btn-danger  { background: var(--red-soft); color: var(--red); border: 1px solid var(--red-bd); }
  .btn-danger:hover  { background: rgba(239,68,68,0.18); }

  .btn-warn    { background: rgba(245,158,11,0.12); color: var(--accent); border: 1px solid var(--accent-bd); }
  .btn-warn:hover    { background: rgba(245,158,11,0.2); }

  .btn-lg { padding: 12px 24px; font-size: 14px; border-radius: 10px; }
  .btn-full { width: 100%; justify-content: center; }

  /* ── Tab navigation ── */
  .tab-nav {
    display: flex; gap: 2px; background: var(--surface);
    border-bottom: 1px solid var(--border); padding: 0 20px;
  }
  .tab-btn {
    display: flex; align-items: center; gap: 7px;
    padding: 0 16px; height: 44px;
    font-family: var(--font); font-size: 13px; font-weight: 500;
    color: var(--text2); background: none; border: none;
    border-bottom: 2px solid transparent; margin-bottom: -1px;
    cursor: pointer; transition: color var(--ease), border-color var(--ease);
    white-space: nowrap;
  }
  .tab-btn:hover { color: var(--text); }
  .tab-btn.active { color: var(--text); border-bottom-color: var(--accent); font-weight: 600; }
  .tab-badge {
    display: inline-flex; align-items: center; justify-content: center;
    padding: 1px 6px; border-radius: 20px; font-size: 11px; font-weight: 600;
    background: var(--surface3); color: var(--text2);
    transition: background var(--ease), color var(--ease);
  }
  .tab-btn.active .tab-badge { background: var(--accent-soft); color: var(--accent); }

  /* ── Image card ── */
  .img-card {
    border-radius: 10px; overflow: hidden;
    background: var(--surface); border: 1px solid var(--border);
    cursor: pointer;
    transition: transform var(--ease), box-shadow var(--ease), border-color var(--ease);
  }
  .img-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 12px 32px rgba(0,0,0,0.5);
    border-color: var(--border2);
  }

  /* ── Year chip ── */
  .year-chip {
    display: inline-flex; align-items: center;
    padding: 4px 10px; border-radius: 20px;
    font-size: 12px; font-weight: 500;
    background: var(--surface2); color: var(--text2);
    border: 1px solid var(--border2); cursor: pointer;
    transition: all var(--ease);
    user-select: none;
  }
  .year-chip:hover  { color: var(--text); border-color: #444; }
  .year-chip.active { background: var(--accent-soft); color: var(--accent); border-color: var(--accent-bd); }

  /* ── Form inputs ── */
  .text-input {
    background: var(--surface2); color: var(--text);
    border: 1px solid var(--border2); border-radius: 10px;
    padding: 12px 16px; font-family: var(--font); font-size: 14px;
    transition: border-color var(--ease), box-shadow var(--ease); outline: none;
  }
  .text-input:focus { border-color: var(--accent-bd); box-shadow: 0 0 0 3px var(--accent-soft); }
  .text-input::placeholder { color: var(--text3); }

  /* ── Duplicate card states ── */
  .dup-card          { border-radius: 10px; overflow: hidden; transition: all 0.18s ease; }
  .dup-card.original { border: 2px solid var(--accent); box-shadow: 0 0 0 1px var(--accent-bd); }
  .dup-card.selected { border: 2px solid var(--red); box-shadow: 0 0 0 1px var(--red-bd); }
  .dup-card.neutral  { border: 1px solid var(--border2); }
  .dup-card.neutral:hover { border-color: #444; cursor: pointer; }

  /* ── Toggle switch ── */
  .toggle-track {
    width: 32px; height: 18px; border-radius: 9px;
    background: var(--surface3); border: 1px solid var(--border2);
    position: relative; cursor: pointer;
    transition: background var(--ease);
  }
  .toggle-track.on { background: var(--accent); border-color: var(--accent); }
  .toggle-knob {
    position: absolute; top: 2px; left: 2px;
    width: 12px; height: 12px; border-radius: 50%;
    background: var(--text2); transition: transform var(--ease), background var(--ease);
  }
  .toggle-track.on .toggle-knob { transform: translateX(14px); background: #000; }

  /* ── Animations ── */
  @keyframes fadeUp   { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
  @keyframes spin     { to { transform: rotate(360deg); } }
  @keyframes shimmer  {
    0%   { background-position: -400px 0; }
    100% { background-position:  400px 0; }
  }

  .fade-up { animation: fadeUp 0.35s ease forwards; }
  .spinner { animation: spin 0.9s linear infinite; }

  /* ── Skeleton loading ── */
  .skeleton {
    background: linear-gradient(90deg, var(--surface2) 25%, var(--surface3) 50%, var(--surface2) 75%);
    background-size: 800px 100%;
    animation: shimmer 1.4s infinite;
    border-radius: 4px;
  }

  /* Welcome screen dot-grid background */
  .welcome-bg {
    background-color: var(--bg);
    background-image: radial-gradient(var(--border2) 1px, transparent 1px);
    background-size: 28px 28px;
  }

  /* Error banner */
  .error-banner {
    background: var(--red-soft); color: var(--red);
    border: 1px solid var(--red-bd); border-radius: 8px;
    padding: 10px 14px; font-size: 13px;
  }

  /* Section header */
  .section-header {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 0 10px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 16px;
  }
  .section-header h2 { font-size: 14px; font-weight: 600; color: var(--text2); }
`;