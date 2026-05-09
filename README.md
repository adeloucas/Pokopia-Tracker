# Pokopia Tracker

This is a browser-based Pokémon Pokopia companion tracker. <br>
It is advised that you export periodically: save states are local, so clearing cookies will reset your tracker.<br>
This project is a work in progress that requires an internet connection at start-up, but should run offline after.

Pokémon data is courtesy of Serebii.net (https://www.serebii.net) <br>
The database was developed by AANDeloucas (https://www.aandeloucas.com) <br>
Donations accepted via ko-fi (https://ko-fi.com/aandeloucas).


## File Structure

```
index.html          — Main HTML shell: all tab panels, modals, and oninput wires.
styles.css          — All CSS for theming and location colors.

js/
  main.js           — Boot: initialise store, populate filters, assemble window.app

  data/
    game-data.js    — Static Pokémon / Habitat / Location data arrays
    lookups.js      — Derived O(1) lookup maps and game-rule helpers

  store/
    namespaces.js   — RDF URI constants and ID builders
    graph-builder.js — Translates game-data into immutable RDF quads
    store.js        — N3.Store singleton (init + accessors)
    queries.js      — Pure read queries against the triplestore
    actions.js      — All store mutations; each saves to localStorage
    persistence.js  — localStorage save/load, JSON export/import, reset

  ui/
    ui-constants.js — Named delay constants (TAB_SWITCH_DELAY, FOCUS_DELAY) + CREDITS_HTML
    shared-card.js  — Shared detail card ownership (claimCard / releaseCardIfNotOwner)
    tabs.js         — Tab switching and left-panel swapping
    modals.js       — How-to and reset modal open/close + confirmReset
    preview.js      — Floating hover-preview card (lazy-created)
    filters.js      — Populate filter <select> dropdowns from game-data at boot
    render-coordinator.js — renderAll() and renderTab(index) dispatch table
    render-pokedex.js     — Pokédex grid, filters, detail panel, HH select mode
    render-habitats.js    — Habitats grid, filters, detail panel, confirm modal
    render-households.js  — Households grid, sort, detail panel, member-pick modal
    render-locations.js   — Locations tab: sidebar, spec panel, movement lists
    render-dashboard.js   — Dashboard: trainer panel, Pokédex/Habitat card rows
```

---

## Architecture

**Store layer** (`store/`) — Pure data. No DOM access, no render calls.  
**UI layer** (`ui/`) — Reads from store via `queries.js`, mutates via `actions.js`.  
**`window.app`** — The public API surface wired in `main.js`. Every `onclick=""` handler in HTML or dynamically-generated HTML strings calls a function on `window.app`. This avoids circular ES module imports between render modules.

### Key patterns

- **Shared detail card** — One `#shared-detail-card` element in the DOM. Whichever tab last called `claimCard(tabIndex)` owns it. `releaseCardIfNotOwner` resets it on tab switch.
- **Cross-module calls via `window.app`** — Where render modules need to call each other (e.g. Habitats → Pokédex after marking complete), they go through `window.app` rather than direct imports, which would create cycles.
- **Inline patching over full re-renders** — Toggle handlers (`toggleAcqByIdx`, `setLocByNo`, `_patchCardAcq`) surgically update DOM attributes and classes rather than rebuilding the entire grid. Full re-renders (`renderPokedex`, `renderHH`) are reserved for state changes that affect many cards.

---

## Data Backup

- **Export**: Click *Export Backup* on the Dashboard. Downloads a `.json` file.
- **Import**: Click *Import Backup* and select a `.json` file. Replaces current state.
- **Reset**: Click *Reset Tracker* → confirm. Wipes all user state from localStorage.

Backup files use the key `"version": "spokopia_tracker_state"`. Future format changes will use a new version string and flag incompatible files on import.

---

**Known remaining issues (post-launch):**
- R7: `setLocByNo` calls `openDetail` which drops focus from the location `<select>` on badge click
- `selectHH` uses a fragile `onclick*=` attribute substring selector — should use a `data-hhid` attribute
- `filterMemberModal` silently truncates at 40 results with no overflow notice
- HH search only matches member Pokémon names, not household names — inconsistent UX
