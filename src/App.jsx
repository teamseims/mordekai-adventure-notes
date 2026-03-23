import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import * as d3 from "d3";

const STORAGE_KEY = "mordekai-notes-v1";

const DEFAULT_PCS = [
  { id: "pc-1", name: "King Gizzard", role: "Circle of the Stars Druid", notes: "Guided by the Lizard Wizard. Shepherd of Ends, Herald of Beginnings." },
  { id: "pc-2", name: "Lucien", role: "", notes: "" },
  { id: "pc-3", name: "Shio", role: "", notes: "" },
  { id: "pc-4", name: "Kazzak", role: "", notes: "" },
  { id: "pc-5", name: "Fazula", role: "", notes: "" },
];

const DEFAULT_DATA = {
  sessions: [],
  npcs: [],
  quests: [],
  locations: [],
  maps: [],
  factions: [],
  pcs: DEFAULT_PCS,
  nextIds: { session: 1, npc: 1, quest: 1, location: 1, map: 1, faction: 1 },
};

const NPC_STATUSES = ["Alive", "Dead", "Unknown", "Missing"];
const QUEST_STATUSES = ["Active", "Completed", "Dormant", "Failed"];
const ATTITUDES = ["Friendly", "Neutral", "Hostile", "Unknown"];
const MAP_LAYERS = ["Realm", "Region", "Locale"];

// ─── Storage helpers ───
function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_DATA, ...parsed };
    }
  } catch (e) { /* key doesn't exist yet */ }
  return { ...DEFAULT_DATA };
}

function saveData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error("Save failed:", e);
  }
}

// ─── Tiny helpers ───
const fmtDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

const generateId = (prefix, num) => `${prefix}-${num}`;

// ─── Styles ───
const css = `
@import url('https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700&family=MedievalSharp&display=swap');

:root {
  --parchment: #1a1510;
  --parchment-light: #2a2218;
  --parchment-lighter: #3a3028;
  --gold: #c8a84e;
  --gold-dim: #8a7535;
  --gold-bright: #e8c84e;
  --red: #8b3a3a;
  --red-bright: #c45050;
  --green: #3a6b3a;
  --green-bright: #5a9b5a;
  --blue: #3a5a7b;
  --blue-bright: #5a8abb;
  --text: #d4c5a0;
  --text-dim: #8a7d65;
  --text-bright: #efe0c0;
  --border: #4a3d2a;
  --border-light: #5a4d3a;
  --shadow: rgba(0,0,0,0.5);
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body, html {
  background: var(--parchment);
  color: var(--text);
  font-family: 'MedievalSharp', cursive;
  overflow-x: hidden;
}

.app {
  max-width: 900px;
  margin: 0 auto;
  padding: 12px;
  min-height: 100vh;
}

.app-header {
  text-align: center;
  padding: 18px 12px 10px;
  border-bottom: 2px solid var(--gold-dim);
  margin-bottom: 4px;
}

.app-title {
  font-family: 'Cinzel Decorative', cursive;
  font-size: 1.55rem;
  color: var(--gold);
  text-shadow: 0 2px 8px rgba(200,168,78,0.25);
  letter-spacing: 2px;
}

.app-subtitle {
  font-size: 0.78rem;
  color: var(--text-dim);
  margin-top: 2px;
  letter-spacing: 1px;
}

/* ─── Tabs ─── */
.tabs {
  display: flex;
  gap: 2px;
  margin: 10px 0 14px;
  border-bottom: 1px solid var(--border);
  overflow-x: auto;
}

.tab {
  flex: 1;
  min-width: 0;
  padding: 10px 6px;
  background: transparent;
  border: none;
  border-bottom: 3px solid transparent;
  color: var(--text-dim);
  font-family: 'MedievalSharp', cursive;
  font-size: 0.92rem;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
  text-align: center;
}

.tab:hover { color: var(--text); }

.tab.active {
  color: var(--gold);
  border-bottom-color: var(--gold);
}

.tab .tab-count {
  display: inline-block;
  background: var(--parchment-lighter);
  color: var(--text-dim);
  font-size: 0.7rem;
  padding: 1px 6px;
  border-radius: 8px;
  margin-left: 5px;
  vertical-align: middle;
}

.tab.active .tab-count {
  background: var(--gold-dim);
  color: var(--parchment);
}

/* ─── Cards & Lists ─── */
.card-list { display: flex; flex-direction: column; gap: 8px; }

.card {
  background: var(--parchment-light);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 12px 14px;
  cursor: pointer;
  transition: all 0.15s;
}

.card:hover {
  border-color: var(--gold-dim);
  background: var(--parchment-lighter);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
}

.card-title {
  font-family: 'Cinzel Decorative', cursive;
  font-size: 0.95rem;
  color: var(--gold);
}

.card-meta {
  font-size: 0.75rem;
  color: var(--text-dim);
  margin-top: 3px;
}

.card-preview {
  font-size: 0.82rem;
  color: var(--text-dim);
  margin-top: 6px;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.badge {
  display: inline-block;
  font-size: 0.68rem;
  padding: 2px 8px;
  border-radius: 10px;
  font-family: 'MedievalSharp', cursive;
  white-space: nowrap;
  flex-shrink: 0;
}

.badge-alive, .badge-active { background: var(--green); color: #c0e0c0; }
.badge-dead, .badge-failed { background: var(--red); color: #e0c0c0; }
.badge-unknown, .badge-dormant { background: var(--parchment-lighter); color: var(--text-dim); border: 1px solid var(--border); }
.badge-missing { background: var(--blue); color: #c0d0e0; }
.badge-completed { background: var(--gold-dim); color: var(--parchment); }
.badge-friendly { background: var(--green); color: #c0e0c0; }
.badge-neutral { background: var(--parchment-lighter); color: var(--text-dim); border: 1px solid var(--border); }
.badge-hostile { background: var(--red); color: #e0c0c0; }

/* ─── Toolbar ─── */
.toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.search-input {
  flex: 1;
  min-width: 140px;
  background: var(--parchment-light);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 8px 12px;
  color: var(--text);
  font-family: 'MedievalSharp', cursive;
  font-size: 0.85rem;
}

.search-input:focus {
  outline: none;
  border-color: var(--gold-dim);
}

.search-input::placeholder { color: var(--text-dim); }

.btn {
  background: var(--parchment-lighter);
  border: 1px solid var(--border-light);
  border-radius: 6px;
  color: var(--gold);
  font-family: 'MedievalSharp', cursive;
  font-size: 0.85rem;
  padding: 8px 14px;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.btn:hover {
  background: var(--gold-dim);
  color: var(--parchment);
  border-color: var(--gold-dim);
}

.btn-primary {
  background: var(--gold-dim);
  color: var(--parchment);
  border-color: var(--gold);
}

.btn-primary:hover {
  background: var(--gold);
}

.btn-danger {
  color: var(--red-bright);
  border-color: var(--red);
}

.btn-danger:hover {
  background: var(--red);
  color: #e0c0c0;
  border-color: var(--red-bright);
}

.btn-sm { padding: 5px 10px; font-size: 0.78rem; }

/* ─── Forms ─── */
.form-panel {
  background: var(--parchment-light);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 14px;
}

.form-title {
  font-family: 'Cinzel Decorative', cursive;
  font-size: 1rem;
  color: var(--gold);
  margin-bottom: 14px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
}

.form-row {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-width: 120px;
}

.form-group.full { flex-basis: 100%; }

.form-label {
  font-size: 0.72rem;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.form-input, .form-select, .form-textarea {
  background: var(--parchment);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 8px 10px;
  color: var(--text);
  font-family: 'MedievalSharp', cursive;
  font-size: 0.85rem;
}

.form-input:focus, .form-select:focus, .form-textarea:focus {
  outline: none;
  border-color: var(--gold-dim);
}

.form-textarea {
  resize: vertical;
  min-height: 80px;
  line-height: 1.5;
}

.form-select {
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%238a7535' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  padding-right: 28px;
}

.form-actions {
  display: flex;
  gap: 8px;
  margin-top: 14px;
  justify-content: flex-end;
}

/* ─── Detail view ─── */
.detail-panel {
  background: var(--parchment-light);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 18px;
  margin-bottom: 14px;
}

.detail-title {
  font-family: 'Cinzel Decorative', cursive;
  font-size: 1.15rem;
  color: var(--gold);
  margin-bottom: 4px;
}

.detail-meta {
  font-size: 0.78rem;
  color: var(--text-dim);
  margin-bottom: 12px;
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.detail-body {
  font-size: 0.88rem;
  line-height: 1.65;
  white-space: pre-wrap;
  color: var(--text-bright);
}

.detail-section {
  margin-top: 14px;
  padding-top: 10px;
  border-top: 1px solid var(--border);
}

.detail-section-title {
  font-size: 0.75rem;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 6px;
}

.detail-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--gold-dim);
  font-size: 0.82rem;
  cursor: pointer;
  margin-bottom: 10px;
  border: none;
  background: none;
  font-family: 'MedievalSharp', cursive;
}

.back-link:hover { color: var(--gold); }

/* ─── Tags ─── */
.tag-list { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 4px; }
.tag {
  display: inline-block;
  font-size: 0.68rem;
  padding: 2px 7px;
  border-radius: 8px;
  background: var(--parchment-lighter);
  color: var(--text-dim);
  border: 1px solid var(--border);
}

.pc-tag {
  background: var(--blue);
  color: #c0d8f0;
  border-color: var(--blue-bright);
}

/* ─── Empty state ─── */
.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: var(--text-dim);
}

.empty-state .icon {
  font-size: 2.2rem;
  margin-bottom: 10px;
  opacity: 0.4;
}

.empty-state p {
  font-size: 0.88rem;
  margin-bottom: 14px;
}

/* ─── Filter pills ─── */
.filter-row {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

.filter-pill {
  font-size: 0.72rem;
  padding: 4px 10px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-dim);
  cursor: pointer;
  font-family: 'MedievalSharp', cursive;
  transition: all 0.15s;
}

.filter-pill:hover { border-color: var(--gold-dim); color: var(--text); }
.filter-pill.active {
  background: var(--gold-dim);
  color: var(--parchment);
  border-color: var(--gold);
}

/* ─── PC strip ─── */
.pc-strip {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.pc-chip {
  font-size: 0.75rem;
  padding: 4px 10px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-dim);
  cursor: pointer;
  font-family: 'MedievalSharp', cursive;
  transition: all 0.15s;
}

.pc-chip:hover { border-color: var(--blue-bright); }
.pc-chip.selected {
  background: var(--blue);
  color: #c0d8f0;
  border-color: var(--blue-bright);
}

/* ─── Connections ─── */
.connection-list { display: flex; flex-direction: column; gap: 4px; margin-top: 4px; }

.connection-entry {
  display: flex;
  gap: 6px;
  align-items: center;
  padding: 5px 8px;
  background: var(--parchment);
  border: 1px solid var(--border);
  border-radius: 4px;
  font-size: 0.82rem;
}

.connection-name {
  color: var(--gold);
  font-family: 'Cinzel Decorative', cursive;
  font-size: 0.78rem;
  white-space: nowrap;
}

.connection-rel {
  color: var(--text-dim);
  font-style: italic;
}

.connection-arrow {
  color: var(--text-dim);
  font-size: 0.7rem;
}

.connection-remove {
  background: none;
  border: none;
  color: var(--text-dim);
  cursor: pointer;
  font-size: 0.75rem;
  padding: 0 4px;
  margin-left: auto;
  flex-shrink: 0;
}

.connection-remove:hover { color: var(--red-bright); }

.connection-add-row {
  display: flex;
  gap: 6px;
  margin-top: 8px;
  align-items: flex-end;
}

.connection-add-row .form-group { margin-bottom: 0; }

/* ─── Encounter log ─── */
.encounter-list { display: flex; flex-direction: column; gap: 6px; }

.encounter-entry {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 8px 10px;
  background: var(--parchment);
  border: 1px solid var(--border);
  border-radius: 4px;
  font-size: 0.82rem;
}

.encounter-session {
  font-family: 'Cinzel Decorative', cursive;
  font-size: 0.72rem;
  color: var(--gold);
  white-space: nowrap;
  min-width: 36px;
  padding-top: 1px;
}

.encounter-note {
  flex: 1;
  color: var(--text);
  line-height: 1.4;
}

.encounter-remove {
  background: none;
  border: none;
  color: var(--text-dim);
  cursor: pointer;
  font-size: 0.75rem;
  padding: 0 4px;
  flex-shrink: 0;
}

.encounter-remove:hover { color: var(--red-bright); }

.encounter-add-row {
  display: flex;
  gap: 6px;
  margin-top: 8px;
  align-items: flex-end;
}

.encounter-add-row .form-group { margin-bottom: 0; }

.npc-detail-field {
  display: flex;
  gap: 6px;
  font-size: 0.82rem;
  margin-bottom: 4px;
}

.npc-detail-field .field-label {
  color: var(--text-dim);
  min-width: 90px;
  flex-shrink: 0;
}

.npc-detail-field .field-value {
  color: var(--text-bright);
}

/* ─── Confirm dialog ─── */
.confirm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.confirm-box {
  background: var(--parchment-light);
  border: 1px solid var(--gold-dim);
  border-radius: 8px;
  padding: 24px;
  max-width: 340px;
  text-align: center;
}

.confirm-box p { margin-bottom: 16px; font-size: 0.9rem; }
.confirm-box .form-actions { justify-content: center; }

/* ─── Loading ─── */
.loading {
  text-align: center;
  padding: 60px 20px;
  color: var(--text-dim);
  font-size: 1rem;
}

/* ─── Settings tab ─── */
.settings-section {
  background: var(--parchment-light);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
}

.settings-title {
  font-family: 'Cinzel Decorative', cursive;
  font-size: 0.95rem;
  color: var(--gold);
  margin-bottom: 10px;
}

@media (max-width: 600px) {
  .app { padding: 8px; }
  .app-title { font-size: 1.2rem; }
  .form-row { flex-direction: column; }
  .form-group { min-width: 100%; }
  .toolbar { flex-direction: column; }
  .search-input { min-width: 100%; }
}

/* ─── Maps ─── */
.map-container {
  position: relative;
  width: 100%;
  cursor: crosshair;
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
  margin: 12px 0;
}

.map-container img {
  width: 100%;
  display: block;
}

.map-pin {
  position: absolute;
  transform: translate(-50%, -100%);
  cursor: pointer;
  z-index: 2;
  transition: transform 0.1s;
}

.map-pin:hover {
  transform: translate(-50%, -100%) scale(1.2);
  z-index: 3;
}

.map-pin-icon {
  width: 20px;
  height: 28px;
}

.pin-tooltip {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  background: var(--parchment-light);
  border: 1px solid var(--gold-dim);
  border-radius: 6px;
  padding: 8px 12px;
  white-space: nowrap;
  z-index: 10;
  font-size: 0.82rem;
  box-shadow: 0 4px 12px var(--shadow);
  margin-bottom: 4px;
}

.pin-form {
  background: var(--parchment-light);
  border: 1px solid var(--gold-dim);
  border-radius: 8px;
  padding: 14px;
  margin-top: 10px;
  box-shadow: 0 4px 16px var(--shadow);
}

.map-thumb {
  width: 80px;
  height: 50px;
  object-fit: cover;
  border-radius: 4px;
  border: 1px solid var(--border);
  flex-shrink: 0;
}

.badge-realm { background: #6b3a7b; color: #e0c0f0; }
.badge-region { background: var(--blue); color: #c0d8f0; }
.badge-locale { background: var(--green); color: #c0e0c0; }

.image-preview {
  margin-top: 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
  max-height: 200px;
}

.image-preview img {
  width: 100%;
  max-height: 200px;
  object-fit: contain;
  display: block;
}

.image-error {
  padding: 12px;
  text-align: center;
  color: var(--text-dim);
  font-size: 0.8rem;
  font-style: italic;
}

.location-map-image {
  width: 100%;
  max-height: 300px;
  object-fit: contain;
  border-radius: 6px;
  border: 1px solid var(--border);
  margin: 10px 0;
}

/* ─── View toggle (list / web) ─── */
.view-toggle {
  display: flex;
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
  flex-shrink: 0;
}
.view-toggle button {
  background: transparent;
  border: none;
  padding: 7px 13px;
  color: var(--text-dim);
  font-family: 'MedievalSharp', cursive;
  font-size: 0.82rem;
  cursor: pointer;
  transition: all 0.15s;
}
.view-toggle button.active {
  background: var(--gold-dim);
  color: var(--parchment);
}

/* ─── NPC Web ─── */
.npc-web-svg {
  width: 100%;
  border-radius: 8px;
  border: 1px solid var(--border);
  display: block;
  touch-action: none;
  user-select: none;
  overflow: visible;
}

/* ─── Factions ─── */
.faction-header-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.faction-swatch {
  border-radius: 50%;
  flex-shrink: 0;
  border: 2px solid var(--border);
}
.color-picker-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 4px;
}
.color-swatch-btn {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: all 0.15s;
  padding: 0;
}
.color-swatch-btn.selected {
  border-color: var(--text-bright);
  transform: scale(1.2);
}
.faction-member-tag {
  display: inline-block;
  font-size: 0.72rem;
  padding: 2px 8px;
  border-radius: 8px;
  background: var(--parchment-lighter);
  color: var(--text);
  border: 1px solid var(--border);
  margin: 2px;
  cursor: default;
}

/* ─── NPC Graph ─── */
.npc-graph-container {
  width: 100%;
  height: 500px;
  background: var(--parchment);
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
  position: relative;
  cursor: grab;
}
.npc-graph-container:active { cursor: grabbing; }
.npc-graph-container svg { width: 100%; height: 100%; display: block; }

.graph-tooltip {
  position: absolute;
  background: var(--parchment-light);
  border: 1px solid var(--gold-dim);
  border-radius: 6px;
  padding: 10px 14px;
  pointer-events: none;
  z-index: 10;
  box-shadow: 0 4px 12px rgba(0,0,0,0.5);
  max-width: 260px;
}
.graph-tooltip-name {
  font-family: 'Cinzel Decorative', cursive;
  font-size: 0.85rem;
  color: var(--gold);
  margin-bottom: 3px;
}
.graph-tooltip-meta {
  font-family: 'MedievalSharp', cursive;
  font-size: 0.75rem;
  color: var(--text-dim);
  line-height: 1.4;
}
.graph-edge-tooltip-line {
  font-family: 'MedievalSharp', cursive;
  font-size: 0.78rem;
  color: var(--text);
  line-height: 1.7;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 3px;
}
.graph-edge-tooltip-name { color: var(--gold); }
.graph-edge-tooltip-arrow { color: var(--text-dim); }
.graph-edge-tooltip-rel { color: var(--text-bright); font-style: italic; }

.graph-legend {
  position: absolute;
  bottom: 10px;
  left: 10px;
  background: rgba(26,21,16,0.88);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 8px 12px;
  z-index: 5;
  max-width: 160px;
}
.graph-legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: 'MedievalSharp', cursive;
  font-size: 0.72rem;
  color: var(--text-dim);
  line-height: 1.7;
}
.graph-legend-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }

/* view-toggle-btn alias so both selectors work */
.view-toggle-btn {
  background: transparent;
  border: none;
  padding: 7px 13px;
  color: var(--text-dim);
  font-family: 'MedievalSharp', cursive;
  font-size: 0.82rem;
  cursor: pointer;
  transition: all 0.15s;
}
.view-toggle-btn.active { background: var(--gold-dim); color: var(--parchment); }

@media (max-width: 600px) {
  .npc-graph-container { height: 350px; }
}
`;

// ─────────────────────────────────────────────
// Graph helpers (module-level pure functions)
// ─────────────────────────────────────────────

const FACTION_PALETTE = [
  "#c8a84e", "#5a9b5a", "#5a8abb", "#c45050",
  "#9b6bb5", "#d48a4e", "#4ababa", "#ba4a8a",
  "#8ab54e", "#b5864e", "#6a6abf", "#bf6a6a",
];
const GRAPH_DEFAULT_COLOR = "#8a7d65";

function hashFactionColor(faction) {
  if (!faction) return GRAPH_DEFAULT_COLOR;
  let h = 0;
  for (let i = 0; i < faction.length; i++) h = faction.charCodeAt(i) + ((h << 5) - h);
  return FACTION_PALETTE[Math.abs(h) % FACTION_PALETTE.length];
}

function buildGraphData(npcs) {
  // Build a canonical edge map: sorted pair key → all directional connections
  const edgeMap = new Map();
  npcs.forEach(npc => {
    (npc.connections || []).forEach(conn => {
      if (!npcs.find(n => n.id === conn.npcId)) return;
      const key = [npc.id, conn.npcId].sort().join("::");
      if (!edgeMap.has(key)) edgeMap.set(key, []);
      edgeMap.get(key).push({
        sourceId: npc.id,
        sourceName: npc.name,
        targetId: conn.npcId,
        targetName: npcs.find(n => n.id === conn.npcId)?.name || "(deleted)",
        relationship: conn.relationship,
      });
    });
  });

  const links = [];
  edgeMap.forEach((connections, key) => {
    const [idA, idB] = key.split("::");
    links.push({ source: idA, target: idB, connections });
  });

  const connectedIds = new Set();
  links.forEach(l => { connectedIds.add(l.source); connectedIds.add(l.target); });

  const nodes = npcs
    .filter(n => connectedIds.has(n.id))
    .map(n => ({
      id: n.id,
      name: n.name,
      faction: n.faction || "",
      factionId: n.factionId || "",
      race: n.race || "",
      status: n.status || "Unknown",
      attitude: n.attitude || "Neutral",
      connectionCount: links.filter(l => l.source === n.id || l.target === n.id).length,
    }));

  return { nodes, links };
}

// ─────────────────────────────────────────────
// Components
// ─────────────────────────────────────────────

function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div className="confirm-overlay" onClick={onCancel}>
      <div className="confirm-box" onClick={e => e.stopPropagation()}>
        <p>{message}</p>
        <div className="form-actions">
          <button className="btn" onClick={onCancel}>Cancel</button>
          <button className="btn btn-danger" onClick={onConfirm}>Delete</button>
        </div>
      </div>
    </div>
  );
}

function Badge({ status }) {
  const cls = `badge badge-${(status || "unknown").toLowerCase().replace(/\s/g, "")}`;
  return <span className={cls}>{status}</span>;
}

function BackButton({ onClick }) {
  return <button className="back-link" onClick={onClick}>← Back to list</button>;
}

const PinIcon = ({ color = "var(--gold)" }) => (
  <svg width="20" height="28" viewBox="0 0 20 28" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 0C4.48 0 0 4.48 0 10c0 7.5 10 18 10 18s10-10.5 10-18c0-5.52-4.48-10-10-10z" fill={color} stroke="var(--parchment)" strokeWidth="1.5"/>
    <circle cx="10" cy="10" r="4" fill="var(--parchment)" opacity="0.7"/>
  </svg>
);

// ─── SESSION JOURNAL ───
function SessionTab({ data, setData, save }) {
  const [view, setView] = useState("list"); // list | detail | form
  const [editId, setEditId] = useState(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({});
  const [confirmDel, setConfirmDel] = useState(null);

  const sessions = data.sessions || [];

  const filtered = sessions.filter(s => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (s.title || "").toLowerCase().includes(q) ||
           (s.body || "").toLowerCase().includes(q) ||
           (s.tags || []).some(t => t.toLowerCase().includes(q));
  }).sort((a, b) => (b.sessionNum || 0) - (a.sessionNum || 0));

  const openNew = () => {
    const nextNum = sessions.length > 0 ? Math.max(...sessions.map(s => s.sessionNum || 0)) + 1 : 1;
    setForm({ title: "", body: "", date: new Date().toISOString().slice(0, 10), sessionNum: nextNum, tags: "", pcs: data.pcs.map(p => p.id) });
    setEditId(null);
    setView("form");
  };

  const openEdit = (s) => {
    setForm({ ...s, tags: (s.tags || []).join(", "), pcs: s.pcs || [] });
    setEditId(s.id);
    setView("form");
  };

  const handleSave = () => {
    const tags = form.tags ? form.tags.split(",").map(t => t.trim()).filter(Boolean) : [];
    if (editId) {
      const updated = sessions.map(s => s.id === editId ? { ...s, ...form, tags, updatedAt: new Date().toISOString() } : s);
      const nd = { ...data, sessions: updated };
      setData(nd); save(nd);
    } else {
      const id = generateId("ses", data.nextIds.session);
      const entry = { ...form, id, tags, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      const nd = { ...data, sessions: [...sessions, entry], nextIds: { ...data.nextIds, session: data.nextIds.session + 1 } };
      setData(nd); save(nd);
    }
    setView("list");
  };

  const handleDelete = (id) => {
    const nd = { ...data, sessions: sessions.filter(s => s.id !== id) };
    setData(nd); save(nd);
    setConfirmDel(null);
    setView("list");
  };

  const togglePC = (pcId) => {
    const cur = form.pcs || [];
    setForm({ ...form, pcs: cur.includes(pcId) ? cur.filter(x => x !== pcId) : [...cur, pcId] });
  };

  const viewSession = sessions.find(s => s.id === editId);

  if (view === "form") {
    return (
      <div className="form-panel">
        <div className="form-title">{editId ? "Edit Session" : "New Session Entry"}</div>
        <div className="form-row">
          <div className="form-group" style={{ maxWidth: 80 }}>
            <label className="form-label">Session #</label>
            <input className="form-input" type="number" value={form.sessionNum || ""} onChange={e => setForm({ ...form, sessionNum: parseInt(e.target.value) || 0 })} />
          </div>
          <div className="form-group">
            <label className="form-label">Title</label>
            <input className="form-input" placeholder="Session title..." value={form.title || ""} onChange={e => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="form-group" style={{ maxWidth: 150 }}>
            <label className="form-label">Date</label>
            <input className="form-input" type="date" value={form.date || ""} onChange={e => setForm({ ...form, date: e.target.value })} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group full">
            <label className="form-label">Present Party Members</label>
            <div className="pc-strip">
              {data.pcs.map(pc => (
                <button key={pc.id} className={`pc-chip ${(form.pcs || []).includes(pc.id) ? "selected" : ""}`} onClick={() => togglePC(pc.id)}>
                  {pc.name}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group full">
            <label className="form-label">Notes</label>
            <textarea className="form-textarea" style={{ minHeight: 200 }} placeholder="What happened this session..." value={form.body || ""} onChange={e => setForm({ ...form, body: e.target.value })} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group full">
            <label className="form-label">Tags (comma-separated)</label>
            <input className="form-input" placeholder="e.g. combat, roleplay, lore" value={form.tags || ""} onChange={e => setForm({ ...form, tags: e.target.value })} />
          </div>
        </div>
        <div className="form-actions">
          <button className="btn" onClick={() => setView(editId ? "detail" : "list")}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>{editId ? "Save Changes" : "Create Entry"}</button>
        </div>
      </div>
    );
  }

  if (view === "detail" && viewSession) {
    const s = viewSession;
    return (
      <div>
        <BackButton onClick={() => { setView("list"); setEditId(null); }} />
        <div className="detail-panel">
          <div className="detail-meta">
            <span>Session #{s.sessionNum}</span>
            <span>{fmtDate(s.date)}</span>
          </div>
          <div className="detail-title">{s.title || "Untitled Session"}</div>
          {(s.pcs || []).length > 0 && (
            <div className="tag-list" style={{ marginTop: 8 }}>
              {s.pcs.map(pcId => {
                const pc = data.pcs.find(p => p.id === pcId);
                return pc ? <span key={pcId} className="tag pc-tag">{pc.name}</span> : null;
              })}
            </div>
          )}
          <div className="detail-body" style={{ marginTop: 14 }}>{s.body || "No notes recorded."}</div>
          {(s.tags || []).length > 0 && (
            <div className="detail-section">
              <div className="detail-section-title">Tags</div>
              <div className="tag-list">{s.tags.map(t => <span key={t} className="tag">{t}</span>)}</div>
            </div>
          )}
          <div className="detail-actions">
            <button className="btn" onClick={() => openEdit(s)}>Edit</button>
            <button className="btn btn-danger btn-sm" onClick={() => setConfirmDel(s.id)}>Delete</button>
          </div>
        </div>
        {confirmDel && <ConfirmDialog message="Delete this session entry?" onConfirm={() => handleDelete(confirmDel)} onCancel={() => setConfirmDel(null)} />}
      </div>
    );
  }

  return (
    <div>
      <div className="toolbar">
        <input className="search-input" placeholder="Search sessions..." value={search} onChange={e => setSearch(e.target.value)} />
        <button className="btn btn-primary" onClick={openNew}>+ New Session</button>
      </div>
      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="icon">📜</div>
          <p>{search ? "No sessions match your search." : "No sessions recorded yet."}</p>
          {!search && <button className="btn btn-primary" onClick={openNew}>Record First Session</button>}
        </div>
      ) : (
        <div className="card-list">
          {filtered.map(s => (
            <div key={s.id} className="card" onClick={() => { setEditId(s.id); setView("detail"); }}>
              <div className="card-header">
                <div>
                  <div className="card-title">#{s.sessionNum} — {s.title || "Untitled"}</div>
                  <div className="card-meta">{fmtDate(s.date)}</div>
                </div>
              </div>
              {(s.tags || []).length > 0 && (
                <div className="tag-list" style={{ marginTop: 4 }}>
                  {s.tags.slice(0, 5).map(t => <span key={t} className="tag">{t}</span>)}
                </div>
              )}
              {s.body && <div className="card-preview">{s.body}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── NPC REGISTRY ───
function NPCTab({ data, setData, save }) {
  const [view, setView] = useState("list");
  const [displayMode, setDisplayMode] = useState("list"); // "list" | "web"
  const [editId, setEditId] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [form, setForm] = useState({});
  const [confirmDel, setConfirmDel] = useState(null);
  const [encForm, setEncForm] = useState({ sessionNum: "", note: "" });
  const [connForm, setConnForm] = useState({ npcId: "", relationship: "" });

  const npcs = data.npcs || [];

  // Get NPC name by id
  const npcName = (id) => {
    const n = npcs.find(x => x.id === id);
    return n ? n.name : "(deleted)";
  };

  // Other NPCs available for connection (exclude self)
  const otherNpcs = (selfId) => npcs.filter(n => n.id !== selfId);

  const filtered = npcs.filter(n => {
    if (statusFilter !== "All" && n.status !== statusFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (n.name || "").toLowerCase().includes(q) ||
           (n.location || "").toLowerCase().includes(q) ||
           (n.faction || "").toLowerCase().includes(q) ||
           (n.race || "").toLowerCase().includes(q) ||
           (n.notes || "").toLowerCase().includes(q) ||
           (n.distinguishing || "").toLowerCase().includes(q);
  }).sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  const openNew = () => {
    setForm({ name: "", location: "", faction: "", factionId: "", status: "Alive", attitude: "Neutral", race: "", appearance: "", distinguishing: "", connections: [], belongings: "", notes: "", encounters: [] });
    setEditId(null);
    setConnForm({ npcId: "", relationship: "" });
    setView("form");
  };

  const openEdit = (n) => {
    // Migrate old string connections to array if needed
    const conns = Array.isArray(n.connections) ? n.connections : [];
    setForm({ ...n, connections: conns, distinguishing: n.distinguishing || n.voiceMannerism || "" });
    setEditId(n.id);
    setConnForm({ npcId: "", relationship: "" });
    setView("form");
  };

  const handleSave = () => {
    // Clean out voiceMannerism if migrated
    const saveForm = { ...form };
    delete saveForm.voiceMannerism;
    if (editId) {
      const updated = npcs.map(n => n.id === editId ? { ...n, ...saveForm, updatedAt: new Date().toISOString() } : n);
      const nd = { ...data, npcs: updated };
      setData(nd); save(nd);
    } else {
      const id = generateId("npc", data.nextIds.npc);
      const entry = { ...saveForm, id, encounters: saveForm.encounters || [], connections: saveForm.connections || [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      const nd = { ...data, npcs: [...npcs, entry], nextIds: { ...data.nextIds, npc: data.nextIds.npc + 1 } };
      setData(nd); save(nd);
    }
    setView("list");
  };

  const handleDelete = (id) => {
    const nd = { ...data, npcs: npcs.filter(n => n.id !== id) };
    setData(nd); save(nd);
    setConfirmDel(null);
    setView("list");
  };

  // Connection helpers (on form, before save)
  const addConnection = () => {
    if (!connForm.npcId || !connForm.relationship) return;
    const conns = [...(form.connections || []), { npcId: connForm.npcId, relationship: connForm.relationship }];
    setForm({ ...form, connections: conns });
    setConnForm({ npcId: "", relationship: "" });
  };

  const removeConnection = (idx) => {
    const conns = [...(form.connections || [])];
    conns.splice(idx, 1);
    setForm({ ...form, connections: conns });
  };

  // Encounter log helpers (on saved data, immediate save)
  const addEncounter = (npcId) => {
    if (!encForm.sessionNum && !encForm.note) return;
    const updated = npcs.map(n => {
      if (n.id !== npcId) return n;
      const encounters = [...(n.encounters || []), { sessionNum: parseInt(encForm.sessionNum) || 0, note: encForm.note, addedAt: new Date().toISOString() }];
      return { ...n, encounters, updatedAt: new Date().toISOString() };
    });
    const nd = { ...data, npcs: updated };
    setData(nd); save(nd);
    setEncForm({ sessionNum: "", note: "" });
  };

  const removeEncounter = (npcId, idx) => {
    const updated = npcs.map(n => {
      if (n.id !== npcId) return n;
      const encounters = [...(n.encounters || [])];
      encounters.splice(idx, 1);
      return { ...n, encounters, updatedAt: new Date().toISOString() };
    });
    const nd = { ...data, npcs: updated };
    setData(nd); save(nd);
  };

  const viewNPC = npcs.find(n => n.id === editId);

  if (view === "form") {
    const conns = form.connections || [];
    const availableForConn = otherNpcs(editId).filter(n => !conns.some(c => c.npcId === n.id));

    return (
      <div className="form-panel">
        <div className="form-title">{editId ? "Edit NPC" : "New NPC"}</div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Name</label>
            <input className="form-input" placeholder="NPC name..." value={form.name || ""} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="form-group" style={{ maxWidth: 160 }}>
            <label className="form-label">Race / Species</label>
            <input className="form-input" placeholder="e.g. Human, Tiefling..." value={form.race || ""} onChange={e => setForm({ ...form, race: e.target.value })} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group" style={{ maxWidth: 140 }}>
            <label className="form-label">Status</label>
            <select className="form-select" value={form.status || "Alive"} onChange={e => setForm({ ...form, status: e.target.value })}>
              {NPC_STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ maxWidth: 140 }}>
            <label className="form-label">Attitude</label>
            <select className="form-select" value={form.attitude || "Neutral"} onChange={e => setForm({ ...form, attitude: e.target.value })}>
              {ATTITUDES.map(a => <option key={a}>{a}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Location</label>
            <input className="form-input" placeholder="Where are they?" value={form.location || ""} onChange={e => setForm({ ...form, location: e.target.value })} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Faction / Affiliation</label>
            {(data.factions || []).length > 0 ? (
              <>
                <select className="form-select" value={form.factionId || ""} onChange={e => {
                  const fac = (data.factions || []).find(f => f.id === e.target.value);
                  setForm({ ...form, factionId: e.target.value, faction: fac ? fac.name : "" });
                }}>
                  <option value="">— None / Custom —</option>
                  {(data.factions || []).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
                {!form.factionId && (
                  <input className="form-input" placeholder="Custom faction / group..." value={form.faction || ""} onChange={e => setForm({ ...form, faction: e.target.value })} style={{ marginTop: 4 }} />
                )}
              </>
            ) : (
              <input className="form-input" placeholder="Faction or group..." value={form.faction || ""} onChange={e => setForm({ ...form, faction: e.target.value })} />
            )}
          </div>
        </div>
        <div className="form-row">
          <div className="form-group full">
            <label className="form-label">Appearance</label>
            <input className="form-input" placeholder="Short physical description..." value={form.appearance || ""} onChange={e => setForm({ ...form, appearance: e.target.value })} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Distinguishing Features</label>
            <input className="form-input" placeholder="Scars, tattoos, voice, habits..." value={form.distinguishing || ""} onChange={e => setForm({ ...form, distinguishing: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Notable Belongings</label>
            <input className="form-input" placeholder="e.g. Silver dagger, scarab amulet..." value={form.belongings || ""} onChange={e => setForm({ ...form, belongings: e.target.value })} />
          </div>
        </div>

        {/* Connections */}
        <div className="form-row">
          <div className="form-group full">
            <label className="form-label">Connections to Other NPCs</label>
            {conns.length > 0 && (
              <div className="connection-list">
                {conns.map((c, idx) => (
                  <div key={idx} className="connection-entry">
                    <span className="connection-name">{npcName(c.npcId)}</span>
                    <span className="connection-arrow">→</span>
                    <span className="connection-rel">{c.relationship}</span>
                    <button className="connection-remove" title="Remove" onClick={() => removeConnection(idx)}>✕</button>
                  </div>
                ))}
              </div>
            )}
            {availableForConn.length > 0 ? (
              <div className="connection-add-row">
                <div className="form-group" style={{ flex: "0 0 160px", maxWidth: 200 }}>
                  <select className="form-select" value={connForm.npcId} onChange={e => setConnForm({ ...connForm, npcId: e.target.value })}>
                    <option value="">Select NPC...</option>
                    {availableForConn.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <input className="form-input" placeholder="Relationship, e.g. 'works for', 'sister of'..." value={connForm.relationship} onChange={e => setConnForm({ ...connForm, relationship: e.target.value })} onKeyDown={e => { if (e.key === "Enter") addConnection(); }} />
                </div>
                <button className="btn btn-sm" style={{ marginBottom: 0, alignSelf: "flex-end" }} onClick={addConnection}>Add</button>
              </div>
            ) : (
              npcs.length <= 1 && conns.length === 0 && (
                <div style={{ fontSize: "0.78rem", color: "var(--text-dim)", fontStyle: "italic", marginTop: 4 }}>Add more NPCs first to create connections.</div>
              )
            )}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group full">
            <label className="form-label">Notes</label>
            <textarea className="form-textarea" placeholder="Backstory, motivations, secrets..." value={form.notes || ""} onChange={e => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
        <div className="form-actions">
          <button className="btn" onClick={() => setView(editId ? "detail" : "list")}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>{editId ? "Save Changes" : "Add NPC"}</button>
        </div>
      </div>
    );
  }

  if (view === "detail" && viewNPC) {
    const n = viewNPC;
    const encounters = n.encounters || [];
    const conns = Array.isArray(n.connections) ? n.connections : [];
    const detailFields = [
      { label: "Race", value: n.race },
      { label: "Appearance", value: n.appearance },
      { label: "Features", value: n.distinguishing || n.voiceMannerism },
      { label: "Belongings", value: n.belongings },
      { label: "Location", value: n.location },
      { label: "Faction", value: n.faction },
    ].filter(f => f.value);

    return (
      <div>
        <BackButton onClick={() => { setView("list"); setEditId(null); setEncForm({ sessionNum: "", note: "" }); }} />
        <div className="detail-panel">
          <div className="card-header">
            <div className="detail-title">{n.name}</div>
            <div style={{ display: "flex", gap: 4 }}>
              <Badge status={n.status} />
              <Badge status={n.attitude} />
            </div>
          </div>

          {detailFields.length > 0 && (
            <div style={{ marginTop: 12 }}>
              {detailFields.map(f => (
                <div key={f.label} className="npc-detail-field">
                  <span className="field-label">{f.label}</span>
                  <span className="field-value">{f.value}</span>
                </div>
              ))}
            </div>
          )}

          {conns.length > 0 && (
            <div className="detail-section">
              <div className="detail-section-title">Connections</div>
              <div className="connection-list">
                {conns.map((c, idx) => (
                  <div key={idx} className="connection-entry" style={{ cursor: "pointer" }} onClick={() => { setEditId(c.npcId); setEncForm({ sessionNum: "", note: "" }); }}>
                    <span className="connection-name">{npcName(c.npcId)}</span>
                    <span className="connection-arrow">→</span>
                    <span className="connection-rel">{c.relationship}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {n.notes && (
            <div className="detail-section">
              <div className="detail-section-title">Notes</div>
              <div className="detail-body">{n.notes}</div>
            </div>
          )}

          <div className="detail-section">
            <div className="detail-section-title">Encounter Log ({encounters.length})</div>
            {encounters.length > 0 ? (
              <div className="encounter-list">
                {encounters.map((enc, idx) => (
                  <div key={idx} className="encounter-entry">
                    <span className="encounter-session">#{enc.sessionNum || "?"}</span>
                    <span className="encounter-note">{enc.note}</span>
                    <button className="encounter-remove" title="Remove" onClick={() => removeEncounter(n.id, idx)}>✕</button>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: "0.8rem", color: "var(--text-dim)", fontStyle: "italic" }}>No encounters logged yet.</div>
            )}
            <div className="encounter-add-row">
              <div className="form-group" style={{ maxWidth: 70, flex: "0 0 70px" }}>
                <label className="form-label">Sess. #</label>
                <input className="form-input" type="number" placeholder="#" value={encForm.sessionNum} onChange={e => setEncForm({ ...encForm, sessionNum: e.target.value })} />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">What happened</label>
                <input className="form-input" placeholder="Short note about this encounter..." value={encForm.note} onChange={e => setEncForm({ ...encForm, note: e.target.value })} onKeyDown={e => { if (e.key === "Enter") addEncounter(n.id); }} />
              </div>
              <button className="btn btn-sm" style={{ marginBottom: 0, alignSelf: "flex-end" }} onClick={() => addEncounter(n.id)}>Add</button>
            </div>
          </div>

          <div className="detail-actions">
            <button className="btn" onClick={() => openEdit(n)}>Edit</button>
            <button className="btn btn-danger btn-sm" onClick={() => setConfirmDel(n.id)}>Delete</button>
          </div>
        </div>
        {confirmDel && <ConfirmDialog message={`Delete ${n.name}?`} onConfirm={() => handleDelete(confirmDel)} onCancel={() => setConfirmDel(null)} />}
      </div>
    );
  }

  const factionName = (n) => {
    if (n.factionId) {
      const f = (data.factions || []).find(f => f.id === n.factionId);
      return f ? f.name : n.faction;
    }
    return n.faction;
  };
  const factionColor = (n) => {
    if (n.factionId) {
      const f = (data.factions || []).find(f => f.id === n.factionId);
      return f ? f.color : null;
    }
    return null;
  };

  const navigateToNPC = (id) => {
    setDisplayMode("list");
    setEditId(id);
    setEncForm({ sessionNum: "", note: "" });
    setView("detail");
  };

  return (
    <div>
      <div className="toolbar">
        {displayMode === "list" && (
          <input className="search-input" placeholder="Search NPCs..." value={search} onChange={e => setSearch(e.target.value)} />
        )}
        <div className="view-toggle">
          <button className={`view-toggle-btn ${displayMode === "list" ? "active" : ""}`} onClick={() => setDisplayMode("list")}>List</button>
          <button className={`view-toggle-btn ${displayMode === "graph" ? "active" : ""}`} onClick={() => setDisplayMode("graph")}>Graph</button>
        </div>
        {displayMode === "list" && (
          <button className="btn btn-primary" onClick={openNew}>+ New NPC</button>
        )}
      </div>
      {displayMode === "list" && (
        <div className="filter-row">
          {["All", ...NPC_STATUSES].map(s => (
            <button key={s} className={`filter-pill ${statusFilter === s ? "active" : ""}`} onClick={() => setStatusFilter(s)}>{s}</button>
          ))}
        </div>
      )}
      {displayMode === "graph" ? (
        <NPCGraph
          npcs={npcs}
          factions={data.factions || []}
          onNodeClick={navigateToNPC}
        />
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="icon">👤</div>
          <p>{search || statusFilter !== "All" ? "No NPCs match your filters." : "No NPCs recorded yet."}</p>
          {!search && statusFilter === "All" && <button className="btn btn-primary" onClick={openNew}>Add First NPC</button>}
        </div>
      ) : (
        <div className="card-list">
          {filtered.map(n => {
            const encCount = (n.encounters || []).length;
            const connCount = (Array.isArray(n.connections) ? n.connections : []).length;
            const facName = factionName(n);
            const facColor = factionColor(n);
            return (
              <div key={n.id} className="card" onClick={() => { setEditId(n.id); setView("detail"); }}>
                <div className="card-header">
                  <div>
                    <div className="card-title">{n.name}</div>
                    <div className="card-meta">
                      {n.race && <span>{n.race}</span>}
                      {n.location && <span style={{ marginLeft: n.race ? 8 : 0 }}>📍 {n.location}</span>}
                      {facName && (
                        <span style={{ marginLeft: 8 }}>
                          {facColor && <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: facColor, marginRight: 4, verticalAlign: "middle" }} />}
                          ⚔ {facName}
                        </span>
                      )}
                      {connCount > 0 && <span style={{ marginLeft: 8 }}>{connCount} link{connCount !== 1 ? "s" : ""}</span>}
                      {encCount > 0 && <span style={{ marginLeft: 8 }}>{encCount} encounter{encCount !== 1 ? "s" : ""}</span>}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <Badge status={n.status} />
                    <Badge status={n.attitude} />
                  </div>
                </div>
                {(n.appearance || n.distinguishing || n.notes) && <div className="card-preview">{n.appearance || n.distinguishing || n.notes}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── NPC GRAPH (D3 force-directed) ───
function NPCGraph({ npcs, factions, onNodeClick }) {
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const simRef = useRef(null);
  const simNodesRef = useRef([]);
  const simLinksRef = useRef([]);
  const rafRef = useRef(null);
  const zoomRef = useRef(null);

  const [renderTick, setRenderTick] = useState(0);
  const [zoomT, setZoomT] = useState({ x: 0, y: 0, k: 1 });
  const [tooltip, setTooltip] = useState(null);      // {type:"node"|"edge", x, y, data}
  const [hovNode, setHovNode] = useState(null);
  const [hovEdge, setHovEdge] = useState(null);       // canonical edge key

  // Resolve faction colour: prefer Factions-tab colour, fall back to hash
  const getFactionColor = useCallback((node) => {
    if (node.factionId) {
      const f = factions.find(f => f.id === node.factionId);
      if (f) return f.color;
    }
    return hashFactionColor(node.faction);
  }, [factions]);

  // Change key: rebuild + restart simulation whenever NPC list or connections change
  const npcKey = npcs.map(n => n.id + "|" + (n.connections || []).length).join(",");

  // ── Zoom — set up once on mount ──
  useEffect(() => {
    if (!svgRef.current) return;
    const zoom = d3.zoom()
      .scaleExtent([0.15, 4])
      .on("zoom", (e) => setZoomT({ x: e.transform.x, y: e.transform.y, k: e.transform.k }));
    zoomRef.current = zoom;
    d3.select(svgRef.current).call(zoom);
    return () => { d3.select(svgRef.current).on(".zoom", null); };
  }, []);

  // ── Simulation — restart whenever NPC data changes ──
  useEffect(() => {
    const { nodes, links } = buildGraphData(npcs);

    // Stop previous simulation and cancel any pending rAF
    if (simRef.current) simRef.current.stop();
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }

    if (nodes.length === 0) {
      simNodesRef.current = [];
      simLinksRef.current = [];
      setRenderTick(t => t + 1);
      return;
    }

    const svg = svgRef.current;
    const w = svg ? (svg.clientWidth || 800) : 800;
    const h = svg ? (svg.clientHeight || 500) : 500;

    // Preserve positions of nodes that already exist (data update, not first load)
    const prevPos = {};
    simNodesRef.current.forEach(n => { prevPos[n.id] = { x: n.x, y: n.y }; });

    const simNodes = nodes.map(n => ({
      ...n,
      x: prevPos[n.id]?.x ?? w / 2 + (Math.random() - 0.5) * 200,
      y: prevPos[n.id]?.y ?? h / 2 + (Math.random() - 0.5) * 200,
    }));
    const simLinks = links.map(l => ({ ...l }));

    simNodesRef.current = simNodes;
    simLinksRef.current = simLinks;

    const sim = d3.forceSimulation(simNodes)
      .force("link", d3.forceLink(simLinks).id(d => d.id).distance(120))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(w / 2, h / 2))
      .force("collide", d3.forceCollide().radius(d => Math.max(10, Math.min(28, 10 + d.connectionCount * 3)) + 8));

    simRef.current = sim;

    const scheduleRender = () => {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        setRenderTick(t => t + 1);
      });
    };

    sim.on("tick", scheduleRender).on("end", () => setRenderTick(t => t + 1));

    return () => {
      sim.stop();
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [npcKey]);

  // ── Tooltip helpers ──
  const getTooltipPos = (x, y) => {
    const c = containerRef.current;
    if (!c) return { left: x + 12, top: y + 12 };
    const { width, height } = c.getBoundingClientRect();
    return {
      left: Math.min(x + 14, width - 268),
      top: Math.min(y + 14, height - 120),
    };
  };

  // ── Legend ── (factions visible in current graph)
  const factionLegend = useMemo(() => {
    const seen = new Map();
    simNodesRef.current.forEach(n => {
      const key = n.factionId || n.faction;
      if (key && !seen.has(key)) seen.set(key, { label: n.faction || "", color: getFactionColor(n) });
    });
    return [...seen.values()].filter(f => f.label);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderTick, getFactionColor]);

  // ── Empty states ──
  if (npcs.length === 0) return (
    <div className="empty-state" style={{ marginTop: 20 }}>
      <div className="icon">👤</div>
      <p>No NPCs yet. Add some NPCs first.</p>
    </div>
  );

  const nodes = simNodesRef.current;
  const links = simLinksRef.current;

  if (nodes.length === 0) return (
    <div className="empty-state" style={{ marginTop: 20 }}>
      <div className="icon">🕸</div>
      <p>No connections to visualize.</p>
      <p style={{ fontSize: "0.78rem", marginTop: 4 }}>Add connections between NPCs to see the network graph.</p>
    </div>
  );

  const { x: tx, y: ty, k: tk } = zoomT;

  return (
    <div ref={containerRef} className="npc-graph-container">
      <svg ref={svgRef}>
        <g transform={`translate(${tx},${ty}) scale(${tk})`}>

          {/* ── Edges ── */}
          {links.map((link) => {
            const src = typeof link.source === "object" ? link.source : null;
            const tgt = typeof link.target === "object" ? link.target : null;
            if (!src || !tgt || src.x == null) return null;
            const edgeKey = [src.id, tgt.id].sort().join("::");
            const isHov = hovEdge === edgeKey;
            return (
              <g key={edgeKey}>
                {/* Visible line */}
                <line
                  x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y}
                  stroke={isHov ? "rgba(200,168,78,0.65)" : "rgba(200,168,78,0.25)"}
                  strokeWidth={isHov ? 2.5 : 1.5}
                  style={{ pointerEvents: "none" }}
                />
                {/* Wide transparent hit-area — makes thin lines easy to hover */}
                <line
                  x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y}
                  stroke="transparent" strokeWidth={12}
                  style={{ cursor: "pointer" }}
                  onMouseEnter={(e) => {
                    setHovEdge(edgeKey);
                    const rect = containerRef.current.getBoundingClientRect();
                    setTooltip({ type: "edge", x: e.clientX - rect.left, y: e.clientY - rect.top, data: link });
                  }}
                  onMouseMove={(e) => {
                    if (tooltip?.type === "edge") {
                      const rect = containerRef.current.getBoundingClientRect();
                      setTooltip(t => ({ ...t, x: e.clientX - rect.left, y: e.clientY - rect.top }));
                    }
                  }}
                  onMouseLeave={() => { setHovEdge(null); setTooltip(null); }}
                />
              </g>
            );
          })}

          {/* ── Nodes ── */}
          {nodes.map(node => {
            if (node.x == null) return null;
            const isHov = hovNode === node.id;
            const color = getFactionColor(node);
            const r = Math.max(10, Math.min(28, 10 + node.connectionCount * 3)) + (isHov ? 3 : 0);
            // Initials: first letter of first + last word
            const words = node.name.trim().split(/\s+/);
            const inits = words.length === 1
              ? words[0].slice(0, 2).toUpperCase()
              : (words[0][0] + words[words.length - 1][0]).toUpperCase();
            // Auto-contrast text color against faction fill
            const rgb = color.match(/[\da-f]{2}/gi) || [];
            const lum = rgb.length === 3
              ? (0.299 * parseInt(rgb[0], 16) + 0.587 * parseInt(rgb[1], 16) + 0.114 * parseInt(rgb[2], 16)) / 255
              : 0;
            const tc = lum > 0.55 ? "#1a1510" : "#f5edd8";
            const firstName = node.name.split(" ")[0];
            const label = firstName.length > 13 ? firstName.slice(0, 12) + "…" : firstName;
            return (
              <g key={node.id}
                transform={`translate(${node.x},${node.y})`}
                style={{ cursor: "pointer" }}
                onClick={() => onNodeClick(node.id)}
                onMouseEnter={(e) => {
                  setHovNode(node.id);
                  const rect = containerRef.current.getBoundingClientRect();
                  setTooltip({
                    type: "node",
                    x: node.x * tk + tx,
                    y: node.y * tk + ty,
                    data: node,
                  });
                }}
                onMouseLeave={() => { setHovNode(null); setTooltip(null); }}
              >
                {/* Filled circle — faction colour fill, faction colour stroke */}
                <circle r={r} fill={color}
                  stroke={isHov ? "#e8c84e" : color}
                  strokeWidth={isHov ? 3 : 2} />
                {/* Initials */}
                <text textAnchor="middle" dy="0.35em"
                  fontSize={Math.max(8, Math.round(r * 0.52))}
                  fill={tc} fontWeight="bold"
                  fontFamily="'Cinzel Decorative', cursive"
                  style={{ pointerEvents: "none" }}>
                  {inits}
                </text>
                {/* Name label below */}
                <text textAnchor="middle" y={r + 13} fontSize={9}
                  fill="#8a7d65" fontFamily="'MedievalSharp', cursive"
                  style={{ pointerEvents: "none" }}>
                  {label}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {/* ── Tooltip ── */}
      {tooltip && (
        <div className="graph-tooltip" style={{ position: "absolute", ...getTooltipPos(tooltip.x, tooltip.y) }}>
          {tooltip.type === "node" ? (
            <>
              <div className="graph-tooltip-name">{tooltip.data.name}</div>
              <div className="graph-tooltip-meta">
                {[tooltip.data.race, tooltip.data.status].filter(Boolean).join(" · ")}
                {tooltip.data.faction && <><br />{tooltip.data.faction}</>}
                <br />{tooltip.data.connectionCount} connection{tooltip.data.connectionCount !== 1 ? "s" : ""}
              </div>
            </>
          ) : (
            (tooltip.data.connections || []).map((conn, i) => (
              <div key={i} className="graph-edge-tooltip-line">
                <span className="graph-edge-tooltip-name">{conn.sourceName}</span>
                <span className="graph-edge-tooltip-arrow">→</span>
                <span className="graph-edge-tooltip-rel">{conn.relationship}</span>
                <span className="graph-edge-tooltip-arrow">→</span>
                <span className="graph-edge-tooltip-name">{conn.targetName}</span>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Legend (only shown when ≥2 factions) ── */}
      {factionLegend.length > 1 && (
        <div className="graph-legend">
          {factionLegend.map(f => (
            <div key={f.label} className="graph-legend-item">
              <div className="graph-legend-dot" style={{ background: f.color }} />
              {f.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── FACTION COLOURS ───
const FACTION_COLORS = [
  "#c8a84e", "#8b3a3a", "#3a5a7b", "#3a6b3a",
  "#6b3a7b", "#7b5a3a", "#4a7b7b", "#7b7b3a",
  "#8a7d65", "#5a3a7b",
];

// ─── FACTION TAB ───
function FactionTab({ data, setData, save }) {
  const [view, setView] = useState("list");
  const [editId, setEditId] = useState(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({});
  const [confirmDel, setConfirmDel] = useState(null);

  const factions = data.factions || [];
  const npcs = data.npcs || [];

  const getMembers = (facId) => npcs.filter(n => n.factionId === facId);

  const filtered = factions.filter(f => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (f.name || "").toLowerCase().includes(q) || (f.description || "").toLowerCase().includes(q);
  }).sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  const openNew = () => {
    setForm({ name: "", description: "", color: FACTION_COLORS[0], notes: "" });
    setEditId(null);
    setView("form");
  };

  const openEdit = (f) => {
    setForm({ ...f });
    setEditId(f.id);
    setView("form");
  };

  const handleSave = () => {
    if (editId) {
      const updated = factions.map(f => f.id === editId ? { ...f, ...form, updatedAt: new Date().toISOString() } : f);
      const nd = { ...data, factions: updated };
      setData(nd); save(nd);
    } else {
      const id = generateId("fac", data.nextIds.faction || 1);
      const entry = { ...form, id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      const nd = { ...data, factions: [...factions, entry], nextIds: { ...data.nextIds, faction: (data.nextIds.faction || 1) + 1 } };
      setData(nd); save(nd);
    }
    setView("list");
  };

  const handleDelete = (id) => {
    const updatedNpcs = npcs.map(n => n.factionId === id ? { ...n, factionId: "", faction: n.faction } : n);
    const nd = { ...data, factions: factions.filter(f => f.id !== id), npcs: updatedNpcs };
    setData(nd); save(nd);
    setConfirmDel(null);
    setView("list");
  };

  const viewFaction = factions.find(f => f.id === editId);

  if (view === "form") {
    return (
      <div className="form-panel">
        <div className="form-title">{editId ? "Edit Faction" : "New Faction"}</div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Name</label>
            <input className="form-input" placeholder="Faction name..." value={form.name || ""} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group full">
            <label className="form-label">Colour</label>
            <div className="color-picker-row">
              {FACTION_COLORS.map(c => (
                <button key={c} className={`color-swatch-btn ${form.color === c ? "selected" : ""}`} style={{ background: c }} onClick={() => setForm({ ...form, color: c })} />
              ))}
            </div>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group full">
            <label className="form-label">Description</label>
            <input className="form-input" placeholder="Short description..." value={form.description || ""} onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group full">
            <label className="form-label">Notes</label>
            <textarea className="form-textarea" placeholder="Goals, history, leadership..." value={form.notes || ""} onChange={e => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
        <div className="form-actions">
          <button className="btn" onClick={() => setView(editId ? "detail" : "list")}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>{editId ? "Save Changes" : "Add Faction"}</button>
        </div>
      </div>
    );
  }

  if (view === "detail" && viewFaction) {
    const f = viewFaction;
    const members = getMembers(f.id);
    return (
      <div>
        <BackButton onClick={() => { setView("list"); setEditId(null); }} />
        <div className="detail-panel">
          <div className="faction-header-row">
            <div className="faction-swatch" style={{ background: f.color || "var(--gold-dim)", width: 28, height: 28 }} />
            <div className="detail-title">{f.name}</div>
          </div>
          {f.description && <div style={{ fontSize: "0.88rem", color: "var(--text)", marginTop: 10 }}>{f.description}</div>}
          {f.notes && (
            <div className="detail-section">
              <div className="detail-section-title">Notes</div>
              <div className="detail-body">{f.notes}</div>
            </div>
          )}
          <div className="detail-section">
            <div className="detail-section-title">Members ({members.length})</div>
            {members.length === 0 ? (
              <div style={{ fontSize: "0.8rem", color: "var(--text-dim)", fontStyle: "italic" }}>No NPCs assigned yet. Edit an NPC and select this faction.</div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", marginTop: 4 }}>
                {members.map(n => <span key={n.id} className="faction-member-tag">{n.name}</span>)}
              </div>
            )}
          </div>
          <div className="detail-actions">
            <button className="btn" onClick={() => openEdit(f)}>Edit</button>
            <button className="btn btn-danger btn-sm" onClick={() => setConfirmDel(f.id)}>Delete</button>
          </div>
        </div>
        {confirmDel && <ConfirmDialog message={`Delete "${f.name}"? NPCs will be unlinked.`} onConfirm={() => handleDelete(confirmDel)} onCancel={() => setConfirmDel(null)} />}
      </div>
    );
  }

  return (
    <div>
      <div className="toolbar">
        <input className="search-input" placeholder="Search factions..." value={search} onChange={e => setSearch(e.target.value)} />
        <button className="btn btn-primary" onClick={openNew}>+ New Faction</button>
      </div>
      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="icon">⚔</div>
          <p>{search ? "No factions match your search." : "No factions created yet."}</p>
          {!search && <button className="btn btn-primary" onClick={openNew}>Create First Faction</button>}
        </div>
      ) : (
        <div className="card-list">
          {filtered.map(f => {
            const mc = getMembers(f.id).length;
            return (
              <div key={f.id} className="card" onClick={() => { setEditId(f.id); setView("detail"); }}>
                <div className="card-header">
                  <div className="faction-header-row">
                    <div className="faction-swatch" style={{ background: f.color || "var(--gold-dim)", width: 20, height: 20 }} />
                    <div>
                      <div className="card-title">{f.name}</div>
                      {f.description && <div className="card-meta">{f.description}</div>}
                    </div>
                  </div>
                  <span className="badge" style={{ background: "var(--parchment-lighter)", color: "var(--text-dim)" }}>{mc} member{mc !== 1 ? "s" : ""}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── QUEST TRACKER ───
function QuestTab({ data, setData, save }) {
  const [view, setView] = useState("list");
  const [editId, setEditId] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [form, setForm] = useState({});
  const [confirmDel, setConfirmDel] = useState(null);

  const quests = data.quests || [];

  const filtered = quests.filter(q => {
    if (statusFilter !== "All" && q.status !== statusFilter) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return (q.name || "").toLowerCase().includes(s) ||
           (q.giver || "").toLowerCase().includes(s) ||
           (q.description || "").toLowerCase().includes(s);
  }).sort((a, b) => {
    const order = { Active: 0, Dormant: 1, Completed: 2, Failed: 3 };
    return (order[a.status] ?? 4) - (order[b.status] ?? 4);
  });

  const openNew = () => {
    setForm({ name: "", status: "Active", giver: "", description: "", reward: "" });
    setEditId(null);
    setView("form");
  };

  const openEdit = (q) => {
    setForm({ ...q });
    setEditId(q.id);
    setView("form");
  };

  const handleSave = () => {
    if (editId) {
      const updated = quests.map(q => q.id === editId ? { ...q, ...form, updatedAt: new Date().toISOString() } : q);
      const nd = { ...data, quests: updated };
      setData(nd); save(nd);
    } else {
      const id = generateId("qst", data.nextIds.quest);
      const entry = { ...form, id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      const nd = { ...data, quests: [...quests, entry], nextIds: { ...data.nextIds, quest: data.nextIds.quest + 1 } };
      setData(nd); save(nd);
    }
    setView("list");
  };

  const handleDelete = (id) => {
    const nd = { ...data, quests: quests.filter(q => q.id !== id) };
    setData(nd); save(nd);
    setConfirmDel(null);
    setView("list");
  };

  const viewQuest = quests.find(q => q.id === editId);

  if (view === "form") {
    return (
      <div className="form-panel">
        <div className="form-title">{editId ? "Edit Quest" : "New Quest"}</div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Quest Name</label>
            <input className="form-input" placeholder="Quest title..." value={form.name || ""} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="form-group" style={{ maxWidth: 140 }}>
            <label className="form-label">Status</label>
            <select className="form-select" value={form.status || "Active"} onChange={e => setForm({ ...form, status: e.target.value })}>
              {QUEST_STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Quest Giver</label>
            <input className="form-input" placeholder="Who gave this quest?" value={form.giver || ""} onChange={e => setForm({ ...form, giver: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Reward</label>
            <input className="form-input" placeholder="Known rewards..." value={form.reward || ""} onChange={e => setForm({ ...form, reward: e.target.value })} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group full">
            <label className="form-label">Description & Notes</label>
            <textarea className="form-textarea" placeholder="Objectives, clues, progress..." value={form.description || ""} onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>
        </div>
        <div className="form-actions">
          <button className="btn" onClick={() => setView(editId ? "detail" : "list")}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>{editId ? "Save Changes" : "Add Quest"}</button>
        </div>
      </div>
    );
  }

  if (view === "detail" && viewQuest) {
    const q = viewQuest;
    return (
      <div>
        <BackButton onClick={() => { setView("list"); setEditId(null); }} />
        <div className="detail-panel">
          <div className="card-header">
            <div className="detail-title">{q.name}</div>
            <Badge status={q.status} />
          </div>
          <div className="detail-meta" style={{ marginTop: 6 }}>
            {q.giver && <span>Given by: {q.giver}</span>}
            {q.reward && <span>Reward: {q.reward}</span>}
          </div>
          {q.description && <div className="detail-body">{q.description}</div>}
          <div className="detail-actions">
            <button className="btn" onClick={() => openEdit(q)}>Edit</button>
            <button className="btn btn-danger btn-sm" onClick={() => setConfirmDel(q.id)}>Delete</button>
          </div>
        </div>
        {confirmDel && <ConfirmDialog message={`Delete quest "${q.name}"?`} onConfirm={() => handleDelete(confirmDel)} onCancel={() => setConfirmDel(null)} />}
      </div>
    );
  }

  return (
    <div>
      <div className="toolbar">
        <input className="search-input" placeholder="Search quests..." value={search} onChange={e => setSearch(e.target.value)} />
        <button className="btn btn-primary" onClick={openNew}>+ New Quest</button>
      </div>
      <div className="filter-row">
        {["All", ...QUEST_STATUSES].map(s => (
          <button key={s} className={`filter-pill ${statusFilter === s ? "active" : ""}`} onClick={() => setStatusFilter(s)}>{s}</button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="icon">⚔</div>
          <p>{search || statusFilter !== "All" ? "No quests match your filters." : "No quests tracked yet."}</p>
          {!search && statusFilter === "All" && <button className="btn btn-primary" onClick={openNew}>Add First Quest</button>}
        </div>
      ) : (
        <div className="card-list">
          {filtered.map(q => (
            <div key={q.id} className="card" onClick={() => { setEditId(q.id); setView("detail"); }}>
              <div className="card-header">
                <div>
                  <div className="card-title">{q.name}</div>
                  <div className="card-meta">
                    {q.giver && <span>Given by: {q.giver}</span>}
                  </div>
                </div>
                <Badge status={q.status} />
              </div>
              {q.description && <div className="card-preview">{q.description}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LocationMapImage({ url }) {
  const [error, setError] = useState(false);
  if (error) return <div className="image-error" style={{ border: "1px solid var(--border)", borderRadius: 6, margin: "10px 0" }}>Could not load map image</div>;
  return <img className="location-map-image" src={url} alt="Location map" onError={() => setError(true)} />;
}

// ─── LOCATION TRACKER ───
function LocationTab({ data, setData, save, navTarget, setNavTarget }) {
  const [view, setView] = useState("list");
  const [editId, setEditId] = useState(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({});
  const [confirmDel, setConfirmDel] = useState(null);
  const [locImgError, setLocImgError] = useState(false);

  useEffect(() => {
    if (navTarget && navTarget.tab === "locations") {
      setEditId(navTarget.id);
      setView("detail");
      setNavTarget(null);
    }
  }, [navTarget]);

  const locations = data.locations || [];

  const filtered = locations.filter(l => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (l.name || "").toLowerCase().includes(q) ||
           (l.region || "").toLowerCase().includes(q) ||
           (l.type || "").toLowerCase().includes(q) ||
           (l.notes || "").toLowerCase().includes(q);
  }).sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  const openNew = () => {
    setForm({ name: "", type: "", region: "", notes: "", visited: false, mapImageUrl: "", parentMapId: "" });
    setEditId(null);
    setView("form");
  };

  const openEdit = (l) => {
    setForm({ ...l });
    setEditId(l.id);
    setView("form");
  };

  const handleSave = () => {
    if (editId) {
      const updated = locations.map(l => l.id === editId ? { ...l, ...form, updatedAt: new Date().toISOString() } : l);
      const nd = { ...data, locations: updated };
      setData(nd); save(nd);
    } else {
      const id = generateId("loc", data.nextIds.location);
      const entry = { ...form, id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      const nd = { ...data, locations: [...locations, entry], nextIds: { ...data.nextIds, location: data.nextIds.location + 1 } };
      setData(nd); save(nd);
    }
    setView("list");
  };

  const handleDelete = (id) => {
    const nd = { ...data, locations: locations.filter(l => l.id !== id) };
    setData(nd); save(nd);
    setConfirmDel(null);
    setView("list");
  };

  const viewLoc = locations.find(l => l.id === editId);

  if (view === "form") {
    return (
      <div className="form-panel">
        <div className="form-title">{editId ? "Edit Location" : "New Location"}</div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Name</label>
            <input className="form-input" placeholder="Location name..." value={form.name || ""} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="form-group" style={{ maxWidth: 160 }}>
            <label className="form-label">Type</label>
            <input className="form-input" placeholder="City, dungeon, tavern..." value={form.type || ""} onChange={e => setForm({ ...form, type: e.target.value })} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Region</label>
            <input className="form-input" placeholder="Region or area..." value={form.region || ""} onChange={e => setForm({ ...form, region: e.target.value })} />
          </div>
          <div className="form-group" style={{ maxWidth: 140, display: "flex", alignItems: "flex-end" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: "0.85rem" }}>
              <input type="checkbox" checked={form.visited || false} onChange={e => setForm({ ...form, visited: e.target.checked })} />
              Visited
            </label>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group full">
            <label className="form-label">Map Image URL</label>
            <input className="form-input" placeholder="Tumblr URL for a map of this location (optional)" value={form.mapImageUrl || ""} onChange={e => { setForm({ ...form, mapImageUrl: e.target.value }); setLocImgError(false); }} />
            {form.mapImageUrl && (
              <div className="image-preview">
                {locImgError ? (
                  <div className="image-error">Could not load image</div>
                ) : (
                  <img src={form.mapImageUrl} alt="Map preview" onError={() => setLocImgError(true)} />
                )}
              </div>
            )}
          </div>
        </div>
        <div className="form-row">
          <div className="form-group full">
            <label className="form-label">Notes</label>
            <textarea className="form-textarea" placeholder="Description, notable features, secrets..." value={form.notes || ""} onChange={e => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
        <div className="form-actions">
          <button className="btn" onClick={() => setView(editId ? "detail" : "list")}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>{editId ? "Save Changes" : "Add Location"}</button>
        </div>
      </div>
    );
  }

  if (view === "detail" && viewLoc) {
    const l = viewLoc;
    const parentMap = l.parentMapId ? (data.maps || []).find(m => m.id === l.parentMapId) : null;
    return (
      <div>
        <BackButton onClick={() => { setView("list"); setEditId(null); }} />
        <div className="detail-panel">
          <div className="card-header">
            <div className="detail-title">{l.name}</div>
            <Badge status={l.visited ? "Visited" : "Unvisited"} />
          </div>
          <div className="detail-meta" style={{ marginTop: 6 }}>
            {l.type && <span>{l.type}</span>}
            {l.region && <span>📍 {l.region}</span>}
            {parentMap && (
              <button className="back-link" style={{ marginBottom: 0 }} onClick={() => setNavTarget && setNavTarget({ tab: "maps", id: parentMap.id })}>
                View on Map →
              </button>
            )}
          </div>
          {l.mapImageUrl && (
            <LocationMapImage url={l.mapImageUrl} />
          )}
          {l.notes && <div className="detail-body">{l.notes}</div>}
          <div className="detail-actions">
            <button className="btn" onClick={() => openEdit(l)}>Edit</button>
            <button className="btn btn-danger btn-sm" onClick={() => setConfirmDel(l.id)}>Delete</button>
          </div>
        </div>
        {confirmDel && <ConfirmDialog message={`Delete ${l.name}?`} onConfirm={() => handleDelete(confirmDel)} onCancel={() => setConfirmDel(null)} />}
      </div>
    );
  }

  return (
    <div>
      <div className="toolbar">
        <input className="search-input" placeholder="Search locations..." value={search} onChange={e => setSearch(e.target.value)} />
        <button className="btn btn-primary" onClick={openNew}>+ New Location</button>
      </div>
      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="icon">🗺</div>
          <p>{search ? "No locations match your search." : "No locations mapped yet."}</p>
          {!search && <button className="btn btn-primary" onClick={openNew}>Add First Location</button>}
        </div>
      ) : (
        <div className="card-list">
          {filtered.map(l => (
            <div key={l.id} className="card" onClick={() => { setEditId(l.id); setView("detail"); }}>
              <div className="card-header">
                <div>
                  <div className="card-title">{l.name}</div>
                  <div className="card-meta">
                    {l.type && <span>{l.type}</span>}
                    {l.region && <span style={{ marginLeft: 8 }}>📍 {l.region}</span>}
                  </div>
                </div>
                <Badge status={l.visited ? "Visited" : "Unvisited"} />
              </div>
              {l.notes && <div className="card-preview">{l.notes}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── MAP TAB ───
function MapTab({ data, setData, save, navTarget, setNavTarget }) {
  const [view, setView] = useState("list");
  const [editId, setEditId] = useState(null);
  const [search, setSearch] = useState("");
  const [layerFilter, setLayerFilter] = useState("All");
  const [form, setForm] = useState({});
  const [formImgError, setFormImgError] = useState(false);
  const [mapImgError, setMapImgError] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  const [hoveredPin, setHoveredPin] = useState(null);
  const [pendingPin, setPendingPin] = useState(null);
  const [pinForm, setPinForm] = useState({ label: "", createLocation: true, createMap: false, existingLocId: "" });
  const imgRef = useRef(null);

  const maps = data.maps || [];

  useEffect(() => {
    if (navTarget && navTarget.tab === "maps") {
      setEditId(navTarget.id);
      setView("detail");
      setNavTarget(null);
    }
  }, [navTarget]);

  // Reset image error when form imageUrl changes
  useEffect(() => { setFormImgError(false); }, [form.imageUrl]);

  const layerOrder = { Realm: 0, Region: 1, Locale: 2 };

  const filtered = maps.filter(m => {
    if (layerFilter !== "All" && m.layer !== layerFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (m.name || "").toLowerCase().includes(q) || (m.notes || "").toLowerCase().includes(q);
  }).sort((a, b) => {
    const lo = (layerOrder[a.layer] ?? 9) - (layerOrder[b.layer] ?? 9);
    if (lo !== 0) return lo;
    return (a.name || "").localeCompare(b.name || "");
  });

  const openNew = () => {
    setForm({ name: "", layer: "Realm", imageUrl: "", notes: "", parentMapId: null });
    setEditId(null);
    setFormImgError(false);
    setView("form");
  };

  const openEdit = (m) => {
    setForm({ ...m });
    setEditId(m.id);
    setFormImgError(false);
    setView("form");
  };

  const handleSave = () => {
    if (editId) {
      const updated = maps.map(m => m.id === editId ? { ...m, ...form, updatedAt: new Date().toISOString() } : m);
      const nd = { ...data, maps: updated };
      setData(nd); save(nd);
    } else {
      const id = generateId("map", data.nextIds.map);
      const entry = { ...form, id, pins: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      const nd = { ...data, maps: [...maps, entry], nextIds: { ...data.nextIds, map: data.nextIds.map + 1 } };
      setData(nd); save(nd);
    }
    setView("list");
  };

  const handleDelete = (id) => {
    const nd = { ...data, maps: maps.filter(m => m.id !== id) };
    setData(nd); save(nd);
    setConfirmDel(null);
    setView("list");
  };

  const handleMapClick = (e) => {
    const img = imgRef.current;
    if (!img) return;
    const rect = img.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPendingPin({ x, y });
    setPinForm({ label: "", createLocation: true, createMap: false, existingLocId: "" });
    setHoveredPin(null);
  };

  const confirmPin = () => {
    if (!pinForm.label.trim()) return;
    const currentMap = maps.find(m => m.id === editId);
    if (!currentMap || !pendingPin) return;

    let newLocId = null;
    let newMapId = null;
    let updatedData = { ...data };

    if (pinForm.existingLocId) {
      newLocId = pinForm.existingLocId;
    } else if (pinForm.createLocation) {
      const locId = generateId("loc", updatedData.nextIds.location);
      const newLoc = {
        id: locId,
        name: pinForm.label.trim(),
        type: currentMap.layer || "",
        region: "",
        notes: "",
        visited: false,
        mapImageUrl: "",
        parentMapId: currentMap.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      updatedData = {
        ...updatedData,
        locations: [...updatedData.locations, newLoc],
        nextIds: { ...updatedData.nextIds, location: updatedData.nextIds.location + 1 },
      };
      newLocId = locId;
    }

    if (pinForm.createMap) {
      const layerIdx = MAP_LAYERS.indexOf(currentMap.layer);
      const childLayer = layerIdx >= 0 && layerIdx < MAP_LAYERS.length - 1 ? MAP_LAYERS[layerIdx + 1] : MAP_LAYERS[MAP_LAYERS.length - 1];
      const childMapId = generateId("map", updatedData.nextIds.map);
      const childMap = {
        id: childMapId,
        name: pinForm.label.trim(),
        layer: childLayer,
        imageUrl: "",
        notes: "",
        pins: [],
        parentMapId: currentMap.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      updatedData = {
        ...updatedData,
        maps: [...updatedData.maps, childMap],
        nextIds: { ...updatedData.nextIds, map: updatedData.nextIds.map + 1 },
      };
      newMapId = childMapId;
    }

    const pinId = `pin-${Date.now()}`;
    const newPin = { id: pinId, x: pendingPin.x, y: pendingPin.y, label: pinForm.label.trim() };
    if (newLocId) newPin.locationId = newLocId;
    if (newMapId) newPin.childMapId = newMapId;

    const updatedMaps = updatedData.maps.map(m => {
      if (m.id !== currentMap.id) return m;
      return { ...m, pins: [...(m.pins || []), newPin], updatedAt: new Date().toISOString() };
    });

    updatedData = { ...updatedData, maps: updatedMaps };
    setData(updatedData);
    save(updatedData);
    setPendingPin(null);
  };

  const removePin = (pinId) => {
    const updatedMaps = maps.map(m => {
      if (m.id !== editId) return m;
      return { ...m, pins: (m.pins || []).filter(p => p.id !== pinId), updatedAt: new Date().toISOString() };
    });
    const nd = { ...data, maps: updatedMaps };
    setData(nd); save(nd);
  };

  const viewMap = maps.find(m => m.id === editId);

  if (view === "form") {
    return (
      <div className="form-panel">
        <div className="form-title">{editId ? "Edit Map" : "New Map"}</div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Name</label>
            <input className="form-input" placeholder="Map name..." value={form.name || ""} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="form-group" style={{ maxWidth: 140 }}>
            <label className="form-label">Layer</label>
            <select className="form-select" value={form.layer || "Realm"} onChange={e => setForm({ ...form, layer: e.target.value })}>
              {MAP_LAYERS.map(l => <option key={l}>{l}</option>)}
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group full">
            <label className="form-label">Image URL</label>
            <input className="form-input" placeholder="Paste Tumblr image URL..." value={form.imageUrl || ""} onChange={e => setForm({ ...form, imageUrl: e.target.value })} />
            {form.imageUrl && (
              <div className="image-preview">
                {formImgError ? (
                  <div className="image-error">Could not load image</div>
                ) : (
                  <img src={form.imageUrl} alt="Map preview" onError={() => setFormImgError(true)} />
                )}
              </div>
            )}
          </div>
        </div>
        <div className="form-row">
          <div className="form-group full">
            <label className="form-label">Notes</label>
            <textarea className="form-textarea" placeholder="Notes about this map..." value={form.notes || ""} onChange={e => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
        <div className="form-actions">
          <button className="btn" onClick={() => setView(editId ? "detail" : "list")}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>{editId ? "Save Changes" : "Create Map"}</button>
        </div>
      </div>
    );
  }

  if (view === "detail" && viewMap) {
    const m = viewMap;
    const pins = m.pins || [];
    const parentMap = m.parentMapId ? maps.find(pm => pm.id === m.parentMapId) : null;
    const locations = data.locations || [];

    return (
      <div>
        <BackButton onClick={() => { setView("list"); setEditId(null); setPendingPin(null); setHoveredPin(null); }} />
        {parentMap && (
          <button className="back-link" style={{ marginBottom: 6 }} onClick={() => { setEditId(parentMap.id); setMapImgError(false); setPendingPin(null); setHoveredPin(null); }}>
            ↑ Back to {parentMap.name}
          </button>
        )}
        <div className="detail-panel">
          <div className="card-header">
            <div className="detail-title">{m.name}</div>
            <span className={`badge badge-${(m.layer || "realm").toLowerCase()}`}>{m.layer}</span>
          </div>
          {m.notes && <div className="detail-body" style={{ marginTop: 8 }}>{m.notes}</div>}

          {m.imageUrl ? (
            mapImgError ? (
              <div className="image-error" style={{ border: "1px solid var(--border)", borderRadius: 6, margin: "12px 0" }}>Could not load map image</div>
            ) : (
              <div className="map-container" onClick={handleMapClick}>
                <img ref={imgRef} src={m.imageUrl} alt={m.name} onError={() => setMapImgError(true)} />
                {pins.map(pin => (
                  <div
                    key={pin.id}
                    className="map-pin"
                    style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
                    onClick={e => { e.stopPropagation(); setHoveredPin(hoveredPin === pin.id ? null : pin.id); setPendingPin(null); }}
                    onMouseEnter={() => setHoveredPin(pin.id)}
                    onMouseLeave={() => setHoveredPin(null)}
                  >
                    <div className="map-pin-icon"><PinIcon /></div>
                    {hoveredPin === pin.id && (
                      <div className="pin-tooltip" onClick={e => e.stopPropagation()}>
                        <div style={{ fontFamily: "'Cinzel Decorative', cursive", color: "var(--gold)", fontSize: "0.8rem", marginBottom: 4 }}>{pin.label}</div>
                        {pin.locationId && (
                          <div>
                            <button className="back-link" style={{ marginBottom: 2 }} onClick={e => { e.stopPropagation(); setNavTarget && setNavTarget({ tab: "locations", id: pin.locationId }); }}>
                              → View Location
                            </button>
                          </div>
                        )}
                        {pin.childMapId && (
                          <div>
                            <button className="back-link" style={{ marginBottom: 2 }} onClick={e => { e.stopPropagation(); setEditId(pin.childMapId); setMapImgError(false); setPendingPin(null); setHoveredPin(null); }}>
                              → Open Map
                            </button>
                          </div>
                        )}
                        <button style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer", fontSize: "0.75rem", marginTop: 4 }} onClick={e => { e.stopPropagation(); removePin(pin.id); setHoveredPin(null); }}>✕ Remove pin</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="empty-state" style={{ padding: "20px", border: "1px dashed var(--border)", borderRadius: 6, margin: "12px 0" }}>
              <p style={{ marginBottom: 0 }}>No image URL set. Edit this map to add one.</p>
            </div>
          )}

          {pendingPin && (
            <div className="pin-form">
              <div style={{ fontFamily: "'Cinzel Decorative', cursive", color: "var(--gold)", fontSize: "0.85rem", marginBottom: 10 }}>Drop Pin Here</div>
              <div className="form-row">
                <div className="form-group full">
                  <label className="form-label">Label (required)</label>
                  <input className="form-input" placeholder="Pin label..." value={pinForm.label} onChange={e => setPinForm({ ...pinForm, label: e.target.value })} autoFocus />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group full">
                  <label className="form-label">Link to Existing Location</label>
                  <select className="form-select" value={pinForm.existingLocId} onChange={e => setPinForm({ ...pinForm, existingLocId: e.target.value, createLocation: !e.target.value })}>
                    <option value="">— Create new location —</option>
                    {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
              </div>
              {!pinForm.existingLocId && (
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 10 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.85rem", cursor: "pointer" }}>
                    <input type="checkbox" checked={pinForm.createLocation} onChange={e => setPinForm({ ...pinForm, createLocation: e.target.checked })} />
                    Create Location
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.85rem", cursor: "pointer" }}>
                    <input type="checkbox" checked={pinForm.createMap} onChange={e => setPinForm({ ...pinForm, createMap: e.target.checked })} />
                    Also create a child map
                  </label>
                </div>
              )}
              <div className="form-actions" style={{ marginTop: 8 }}>
                <button className="btn btn-sm" onClick={() => setPendingPin(null)}>Cancel</button>
                <button className="btn btn-primary btn-sm" onClick={confirmPin}>Confirm Pin</button>
              </div>
            </div>
          )}

          <div className="detail-actions">
            <button className="btn" onClick={() => openEdit(m)}>Edit</button>
            <button className="btn btn-danger btn-sm" onClick={() => setConfirmDel(m.id)}>Delete</button>
          </div>
        </div>
        {confirmDel && <ConfirmDialog message={`Delete map "${m.name}"?`} onConfirm={() => handleDelete(confirmDel)} onCancel={() => setConfirmDel(null)} />}
      </div>
    );
  }

  return (
    <div>
      <div className="toolbar">
        <input className="search-input" placeholder="Search maps..." value={search} onChange={e => setSearch(e.target.value)} />
        <button className="btn btn-primary" onClick={openNew}>+ New Map</button>
      </div>
      <div className="filter-row">
        {["All", ...MAP_LAYERS].map(l => (
          <button key={l} className={`filter-pill ${layerFilter === l ? "active" : ""}`} onClick={() => setLayerFilter(l)}>{l}</button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="icon">🗺</div>
          <p>{search || layerFilter !== "All" ? "No maps match your filters." : "No maps created yet."}</p>
          {!search && layerFilter === "All" && <button className="btn btn-primary" onClick={openNew}>Create First Map</button>}
        </div>
      ) : (
        <div className="card-list">
          {filtered.map(m => {
            const parentMap = m.parentMapId ? maps.find(pm => pm.id === m.parentMapId) : null;
            const pinCount = (m.pins || []).length;
            return (
              <div key={m.id} className="card" onClick={() => { setEditId(m.id); setMapImgError(false); setPendingPin(null); setHoveredPin(null); setView("detail"); }}>
                <div className="card-header">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="card-title">{m.name}</div>
                    <div className="card-meta">
                      <span className={`badge badge-${(m.layer || "realm").toLowerCase()}`}>{m.layer}</span>
                      <span style={{ marginLeft: 8 }}>{pinCount} pin{pinCount !== 1 ? "s" : ""}</span>
                      {parentMap && <span style={{ marginLeft: 8 }}>↑ {parentMap.name}</span>}
                    </div>
                  </div>
                  {m.imageUrl && <img className="map-thumb" src={m.imageUrl} alt={m.name} onError={e => e.target.style.display = "none"} />}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── PARTY TAB (bonus settings-like) ───
function PartyTab({ data, setData, save }) {
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({});

  const pcs = data.pcs || [];

  const openEdit = (pc) => {
    setForm({ ...pc });
    setEditId(pc.id);
  };

  const handleSave = () => {
    const updated = pcs.map(p => p.id === editId ? { ...p, ...form } : p);
    const nd = { ...data, pcs: updated };
    setData(nd); save(nd);
    setEditId(null);
  };

  const handleReset = () => {
    if (confirm("Reset all data? This cannot be undone.")) {
      setData({ ...DEFAULT_DATA });
      save({ ...DEFAULT_DATA });
    }
  };

  return (
    <div>
      <div className="settings-section">
        <div className="settings-title">The Party</div>
        <div className="card-list">
          {pcs.map(pc => (
            editId === pc.id ? (
              <div key={pc.id} className="form-panel" style={{ margin: 0 }}>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Name</label>
                    <input className="form-input" value={form.name || ""} onChange={e => setForm({ ...form, name: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Role / Class</label>
                    <input className="form-input" value={form.role || ""} onChange={e => setForm({ ...form, role: e.target.value })} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group full">
                    <label className="form-label">Notes</label>
                    <textarea className="form-textarea" style={{ minHeight: 50 }} value={form.notes || ""} onChange={e => setForm({ ...form, notes: e.target.value })} />
                  </div>
                </div>
                <div className="form-actions">
                  <button className="btn btn-sm" onClick={() => setEditId(null)}>Cancel</button>
                  <button className="btn btn-primary btn-sm" onClick={handleSave}>Save</button>
                </div>
              </div>
            ) : (
              <div key={pc.id} className="card" onClick={() => openEdit(pc)}>
                <div className="card-header">
                  <div>
                    <div className="card-title">{pc.name}</div>
                    {pc.role && <div className="card-meta">{pc.role}</div>}
                  </div>
                  <span className="tag pc-tag">PC</span>
                </div>
                {pc.notes && <div className="card-preview">{pc.notes}</div>}
              </div>
            )
          ))}
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-title">Data</div>
        <p style={{ fontSize: "0.82rem", color: "var(--text-dim)", marginBottom: 12 }}>
          {data.sessions.length} sessions · {data.npcs.length} NPCs · {(data.factions || []).length} factions · {data.quests.length} quests · {data.locations.length} locations · {(data.maps || []).length} maps
        </p>
        <button className="btn btn-danger btn-sm" onClick={handleReset}>Reset All Data</button>
      </div>
    </div>
  );
}

// ─── MAIN APP ───
export default function AdventureNotes() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("sessions");
  const [loaded, setLoaded] = useState(false);
  const [navTarget, setNavTarget] = useState(null);

  useEffect(() => {
    const d = loadData();
    setData(d);
    setLoaded(true);
  }, []);

  // When navTarget is set, switch to its tab
  useEffect(() => {
    if (navTarget) {
      setTab(navTarget.tab);
    }
  }, [navTarget]);

  const doSave = useCallback((d) => saveData(d), []);

  if (!loaded || !data) {
    return <div className="app"><style>{css}</style><div className="loading">Unfurling the scrolls...</div></div>;
  }

  const tabs = [
    { key: "sessions", label: "Journal", count: data.sessions.length },
    { key: "npcs", label: "NPCs", count: data.npcs.length },
    { key: "factions", label: "Factions", count: (data.factions || []).length },
    { key: "quests", label: "Quests", count: data.quests.length },
    { key: "locations", label: "Locations", count: data.locations.length },
    { key: "maps", label: "Maps", count: (data.maps || []).length },
    { key: "party", label: "Party", count: null },
  ];

  return (
    <div className="app">
      <style>{css}</style>
      <div className="app-header">
        <div className="app-title">Mordekai's Broken Seal</div>
        <div className="app-subtitle">Adventure Chronicle</div>
      </div>
      <div className="tabs">
        {tabs.map(t => (
          <button key={t.key} className={`tab ${tab === t.key ? "active" : ""}`} onClick={() => setTab(t.key)}>
            {t.label}
            {t.count !== null && <span className="tab-count">{t.count}</span>}
          </button>
        ))}
      </div>
      {tab === "sessions" && <SessionTab data={data} setData={setData} save={doSave} />}
      {tab === "npcs" && <NPCTab data={data} setData={setData} save={doSave} />}
      {tab === "factions" && <FactionTab data={data} setData={setData} save={doSave} />}
      {tab === "quests" && <QuestTab data={data} setData={setData} save={doSave} />}
      {tab === "locations" && <LocationTab data={data} setData={setData} save={doSave} navTarget={navTarget} setNavTarget={setNavTarget} />}
      {tab === "maps" && <MapTab data={data} setData={setData} save={doSave} navTarget={navTarget} setNavTarget={setNavTarget} />}
      {tab === "party" && <PartyTab data={data} setData={setData} save={doSave} />}
    </div>
  );
}
