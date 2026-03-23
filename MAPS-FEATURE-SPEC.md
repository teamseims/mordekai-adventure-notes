# Maps Tab Feature Spec — Mordekai's Adventure Notes

## Overview

Add an interactive Maps tab to the existing React adventure notes app (`mordekai-adventure-notes.jsx`). Maps display hosted images (Tumblr URLs) with clickable pin-dropping. Pins auto-create Locations and optionally child Maps, creating a drill-down hierarchy: Realm → Region → Locale.

The app is a single-file React artifact using `window.storage` for persistence (key: `"mordekai-notes-v1"`). It uses MedievalSharp + Cinzel Decorative fonts, a dark parchment color scheme (CSS variables already defined), and Tailwind is NOT used — all styling is in a `css` template string injected via `<style>`.

---

## File to modify

`/mnt/user-data/outputs/mordekai-adventure-notes.jsx`

Working copy also at `/home/claude/adventure-notes.jsx`.

Output the final file to `/mnt/user-data/outputs/mordekai-adventure-notes.jsx`.

---

## 1. Data Model Changes

### Add `maps` array to `DEFAULT_DATA`:

```js
const DEFAULT_DATA = {
  sessions: [],
  npcs: [],
  quests: [],
  locations: [],
  maps: [],        // ← NEW
  pcs: DEFAULT_PCS,
  nextIds: { session: 1, npc: 1, quest: 1, location: 1, map: 1 },  // ← add map
};
```

### Map object shape:

```js
{
  id: "map-1",
  name: "The Known Desert",
  layer: "Realm",           // "Realm" | "Region" | "Locale"
  imageUrl: "https://...",  // Tumblr image URL
  notes: "",
  pins: [
    {
      id: "pin-1",
      x: 45.2,              // percentage-based X coordinate (0-100)
      y: 67.8,              // percentage-based Y coordinate (0-100)
      label: "Sandspire",
      locationId: "loc-3",  // optional — linked Location
      childMapId: "map-2",  // optional — linked child Map
    }
  ],
  parentMapId: null,        // optional — if this map was created from a pin on another map
  createdAt: "...",
  updatedAt: "...",
}
```

### Location object additions (extend existing shape):

Add these optional fields to locations:

```js
{
  // ...existing fields...
  mapImageUrl: "",      // optional Tumblr URL for a map of this location
  parentMapId: "",      // optional — the map this location was pinned on
}
```

### Constants:

```js
const MAP_LAYERS = ["Realm", "Region", "Locale"];
```

---

## 2. Maps Tab Component (`MapTab`)

### List View
- Toolbar: search input + "+ New Map" button
- Filter pills for layer: All | Realm | Region | Locale
- Card list sorted by layer order (Realm first), then alphabetically within layer
- Each card shows: name (in gold Cinzel), layer badge, pin count, and a thumbnail of the map image (small, ~60px height, object-fit cover, rounded)
- If a map has a `parentMapId`, show "↑ {parentMapName}" as a breadcrumb in the card meta

### Form View (New / Edit Map)
Fields:
- **Name** — text input
- **Layer** — select: Realm / Region / Locale
- **Image URL** — text input (placeholder: "Paste Tumblr image URL...")
- **Notes** — textarea (optional)
- Image preview below the URL field — render `<img>` if URL is non-empty, with graceful error handling (onError hide the image, show "Could not load image" message)
- Save / Cancel buttons

### Detail View — the main interactive map
- Back button to list
- Map name as title, layer badge, notes if any
- **The map image** rendered in a container that is:
  - Full width of the app column
  - `position: relative` with `cursor: crosshair`
  - The image itself: `width: 100%; display: block;` so it scales responsively
- **Pins rendered as absolute-positioned markers** on top of the image:
  - Each pin at `left: {x}%; top: {y}%` with `transform: translate(-50%, -100%)`
  - Pin visual: a small marker icon (use a simple SVG drop-pin or a styled div — a circle with a downward-pointing triangle, in gold `var(--gold)` with dark stroke)
  - On hover/tap: show a tooltip with the label
  - If pin has a `locationId`: label is clickable → navigates to that Location in the Locations tab (change the main app tab to "locations" and open that location's detail)
  - If pin has a `childMapId`: show a small "→ Open Map" link in the tooltip → navigates to that child Map's detail view
  - Pin marker should be ~18-22px wide so it's tappable on mobile

- **Pin dropping mode:**
  - Clicking on the map image (not on an existing pin) opens a small inline form/popover near the click point (or below the map if easier):
    - **Label** — text input (required)
    - **Create Location** — checkbox, ON by default
    - **Create Map** — checkbox, OFF by default (label: "Also create a child map")
    - **Or link existing Location** — a select dropdown of existing locations (alternative to creating a new one). If an existing location is selected, "Create Location" unchecks.
    - **Confirm / Cancel** buttons
  - On confirm:
    - Pin is added to the map's `pins` array with percentage coordinates
    - If "Create Location" is checked: a new Location is created in `data.locations` with the pin label as name, the map's layer as a hint for the location type, and `parentMapId` set to this map's id. The pin's `locationId` is set to the new location's id.
    - If "Link existing Location" was chosen instead: the pin's `locationId` is set to that location's id.
    - If "Create Map" is checked: a new Map is created in `data.maps` with the pin label as name, one layer down from the current map (Realm→Region, Region→Locale, Locale→Locale), `parentMapId` set to current map, and no image URL yet. The pin's `childMapId` is set to the new map's id.
    - Save all changes to storage in one operation.

- **Pin removal:** each pin tooltip has a small ✕ button. Removing a pin does NOT delete the linked Location or child Map — it only removes the pin from this map.

- **Edit / Delete map buttons** at the bottom (same pattern as other tabs)

### Navigation helpers
- If a map has a `parentMapId`, show a "↑ Back to {parentMapName}" link at the top of the detail view (in addition to the regular back-to-list button)
- Breadcrumb concept: "Realm: The Known Desert → Region: Sandspire" shown if navigating from a parent

---

## 3. Location Tab Changes

### Form View — add one field:
- **Map Image URL** — text input, optional, placed after the existing fields and before Notes
- Placeholder: "Tumblr URL for a map of this location (optional)"

### Detail View — add:
- If `mapImageUrl` is set, render the image below the standard detail fields (before Notes), at full width with rounded corners and `max-height: 300px; object-fit: contain`
- If the location has a `parentMapId`, show a "View on Map →" link that navigates to that map's detail view

---

## 4. Tab Bar Changes

Add the Maps tab between Locations and Party:

```js
const tabs = [
  { key: "sessions", label: "Journal", count: data.sessions.length },
  { key: "npcs", label: "NPCs", count: data.npcs.length },
  { key: "quests", label: "Quests", count: data.quests.length },
  { key: "locations", label: "Locations", count: data.locations.length },
  { key: "maps", label: "Maps", count: data.maps.length },    // ← NEW
  { key: "party", label: "Party", count: null },
];
```

The main app needs to support cross-tab navigation (e.g., clicking a pin's location link switches to the locations tab and opens that location). Add a simple navigation mechanism:

```js
// In the main App component, add:
const [navTarget, setNavTarget] = useState(null);
// navTarget shape: { tab: "locations", id: "loc-3" } or { tab: "maps", id: "map-2" }
// Pass setNavTarget down to MapTab and LocationTab
// When navTarget is set, switch tab and open the detail view for that id
// Clear navTarget after consuming it
```

---

## 5. CSS Additions

Add styles for:

### Map container
```css
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
```

### Pin markers
```css
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
  /* SVG pin icon or styled div */
}
```

### Pin tooltip
```css
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
}
```

### Pin form (the popover when placing a new pin)
```css
.pin-form {
  background: var(--parchment-light);
  border: 1px solid var(--gold-dim);
  border-radius: 8px;
  padding: 14px;
  margin-top: 10px;
  box-shadow: 0 4px 16px var(--shadow);
}
```

### Map thumbnail in list cards
```css
.map-thumb {
  width: 80px;
  height: 50px;
  object-fit: cover;
  border-radius: 4px;
  border: 1px solid var(--border);
  flex-shrink: 0;
}
```

### Layer badges
```css
.badge-realm { background: #6b3a7b; color: #e0c0f0; }
.badge-region { background: var(--blue); color: #c0d8f0; }
.badge-locale { background: var(--green); color: #c0e0c0; }
```

### Image preview in forms
```css
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
```

### Location map image in detail view
```css
.location-map-image {
  width: 100%;
  max-height: 300px;
  object-fit: contain;
  border-radius: 6px;
  border: 1px solid var(--border);
  margin: 10px 0;
}
```

---

## 6. Party Tab / Settings Update

In the data summary on the Party tab, add maps count:

```js
<p>
  {data.sessions.length} sessions · {data.npcs.length} NPCs · {data.quests.length} quests · {data.locations.length} locations · {data.maps.length} maps
</p>
```

---

## 7. Pin Icon SVG

Use this inline SVG for the pin marker (gold with dark outline):

```jsx
const PinIcon = ({ color = "var(--gold)" }) => (
  <svg width="20" height="28" viewBox="0 0 20 28" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 0C4.48 0 0 4.48 0 10c0 7.5 10 18 10 18s10-10.5 10-18c0-5.52-4.48-10-10-10z" fill={color} stroke="var(--parchment)" strokeWidth="1.5"/>
    <circle cx="10" cy="10" r="4" fill="var(--parchment)" opacity="0.7"/>
  </svg>
);
```

---

## 8. Important Implementation Notes

- **Single file**: everything stays in one `.jsx` file. No separate CSS files.
- **No localStorage**: use only `window.storage.get/set` (async, same as existing code).
- **Storage key**: keep using `"mordekai-notes-v1"`. The `loadData` function already does `{ ...DEFAULT_DATA, ...parsed }` so the new `maps` array will default cleanly for existing data.
- **Percentage-based pin coordinates**: calculate as `(clickX / imageWidth) * 100` and `(clickY / imageHeight) * 100` using the image element's bounding rect. This keeps pins accurate across screen sizes.
- **Cross-tab navigation**: the `setNavTarget` function needs to be passed down from the main `AdventureNotes` component to `MapTab` and `LocationTab`. When a navTarget is set, the main component switches tabs and the target tab component checks for it on mount/update and opens the appropriate detail view.
- **Pin click vs map click**: use `e.stopPropagation()` on pin clicks so they don't trigger a new pin placement.
- **Image error handling**: if a Tumblr URL fails to load, show the error state gracefully — don't break the detail view.
- **Existing aesthetic**: match the dark parchment theme, use `var(--gold)` for interactive elements, `Cinzel Decorative` for titles, `MedievalSharp` for body text. Follow the same card/form/detail patterns used in other tabs.
- **Data integrity**: removing a pin does NOT delete linked Locations or Maps. Deleting a Map does NOT delete its pins' linked Locations (but the location's `parentMapId` becomes orphaned — that's fine, just don't crash on it).
- **Mobile-friendly**: pin form should work on touch. Consider placing the pin form below the map rather than as a floating popover to avoid positioning issues on mobile.
