// js/ui/render-locations.js
// -----------------------------------------------------------------------------
// Locations tab — five zones; each panel shows housing usage, a "currently
// available" spec grid, a "planned organization" spec grid, and movement
// lists (Moving In / Residing / Moving Away).
// -----------------------------------------------------------------------------

import { POKEMON_DATA, SPECS, TOTAL_SLOTS, LOCATION_DATA, TYPE_SLOT_WEIGHT } from "../data/game-data.js";
import { POKE_BY_NO, effectivePrefLoc, SP }               from "../data/lookups.js";

import { queryAllState, getAllHouseholds } from "../store/queries.js";
import { switchTab }                       from "./tabs.js";

let _curLocKey  = "ww";
let _curSpecTab = "current"; // "current" | "planned"

export function switchLoc(key) {
  _curLocKey = key;
  renderLoc();
}

export function switchSpecTab(tab) {
  _curSpecTab = tab;
  // Update active class on buttons immediately
  ["current", "planned"].forEach(t => {
    const btn = document.getElementById("spec-tab-" + t);
    if (btn) btn.classList.toggle("active", t === tab);
  });
  // Called outside renderLoc(), so must query state here.
  const { acq, locs } = queryAllState();
  const hh = getAllHouseholds();
  _renderSpecPanel(acq, locs, hh);
}

// ── Render entry ─────────────────────────────────────────────────────────────

export function renderLoc() {
  const { acq, locs } = queryAllState(); // single scan — passed to all helpers
  const hh            = getAllHouseholds();

  // Build sidebar if empty
  const sidebar = document.getElementById("loc-sidebar");
  if (sidebar && !sidebar.children.length) {
    sidebar.innerHTML = LOCATION_DATA.map(l =>
      `<div class="loc-sidebar-tab" id="lsidebar-${l.key}" onclick="app.switchLoc('${l.key}')">
        <div class="loc-tab-header">
          <span>${l.name}</span>
          <span class="loc-tab-chevron">›</span>
        </div>
        <div class="loc-sidebar-body" id="lbody-${l.key}"></div>
      </div>`
    ).join("");
  }

  // Update active/open state
  LOCATION_DATA.forEach(l => {
    const tab = document.getElementById("lsidebar-" + l.key);
    if (!tab) return;
    tab.className = "loc-sidebar-tab";
    if (l.key === _curLocKey) {
      tab.classList.add("open", `active-${l.key}`);
      _renderSidebarBody(l, hh, tab, acq, locs);
    }
  });

  // Right panel header
  const loc = LOCATION_DATA.find(l => l.key === _curLocKey);
  if (loc) {
    const { curr, orig } = _getSpecCounts(loc.name, locs, hh, acq);
    const currentPoke = POKEMON_DATA.filter(p => locs[p.no] === loc.name);
    const currTotal   = Object.values(curr).reduce((a, b) => a + b, 0);
    const origTotal   = Object.values(orig).reduce((a, b) => a + b, 0);
    const h2 = document.getElementById("loc-right-name");
    const p  = document.getElementById("loc-right-meta");
    if (h2) h2.textContent = loc.name;
    if (p)  p.textContent  = `${currTotal} current specialties · ${origTotal} local · ${currentPoke.length} Pokémon here`;
  }

  // Spec tab buttons
  ["current", "planned"].forEach(t => {
    const btn = document.getElementById("spec-tab-" + t);
    if (btn) btn.classList.toggle("active", _curSpecTab === t);
  });

  _renderSpecPanel(acq, locs, hh);
}

// ── Sidebar body ─────────────────────────────────────────────────────────────

function _renderSidebarBody(loc, hh, tab, acq, locs) {
  const body = tab.querySelector(".loc-sidebar-body");
  if (!body) return;

  const { used } = _getHousingData(loc.name, hh);
  const avail = Math.max(0, TOTAL_SLOTS - used);
  const pct   = Math.min(100, Math.round(used / TOTAL_SLOTS * 100));
  const hhInLoc = hh.filter(h => h.loc === loc.name);

  const hhRows = ["block", "singles", "doubles"].map(type => {
    const group = hhInLoc.filter(h => h.type === type);
    if (!group.length) return "";
    const label = type === "block" ? "Block Home" : type === "singles" ? "Singles Prefab" : "Doubles/Quad";
    const cards = group.map(h => {
      const mem = h.m || [];
      const chips = mem.length
        ? mem.map(no => {
            const p   = POKE_BY_NO[no]; if (!p) return "";
            const idx = POKEMON_DATA.findIndex(x => x.no === no);
            // 60ms: one step above TAB_SWITCH_DELAY for extra margin on slower devices after tab switch.
            return `<span class="loc-hh-chip" onclick="app.switchTab(0);setTimeout(()=>app.openDetail(${idx}),60)">
              <img src="${SP(p)}" onerror="this.style.display='none'">${p.name}
            </span>`;
          }).join("")
        : `<span class="loc-hh-chip-empty">No members</span>`;
      return `<div class="loc-hh-inline-card">
        <span class="loc-hh-inline-name">${h.name}</span>
        <div class="loc-hh-inline-chips">${chips}</div>
      </div>`;
    }).join("");
    return `<div class="loc-htype-row"><span class="loc-htype-label">${label}</span><span class="loc-htype-count">${group.length}</span></div>
      ${cards ? `<div class="loc-hh-inline-group">${cards}</div>` : ""}`;
  }).join("");

  body.innerHTML = `
    <div style="font-weight:700;font-size:11px;margin-bottom:4px;">${avail} / ${TOTAL_SLOTS} slots remaining</div>
    <div class="loc-housing-bar-wrap"><div class="loc-housing-bar-fill" style="width:${pct}%"></div></div>
    <div class="loc-housing-meta">${used} used · ${pct}% full</div>
    ${hhRows || '<div style="font-size:10px;color:var(--muted);">No households here</div>'}`;
}

// ── Spec panel ───────────────────────────────────────────────────────────────

function _renderSpecPanel(acq, locs, hh) {
  const container = document.getElementById("loc-spec-content");
  if (!container) return;
  const loc = LOCATION_DATA.find(l => l.key === _curLocKey);
  if (!loc) return;

  const { orig, curr, planned, currPokes, plannedPokes } = _getSpecCounts(loc.name, locs, hh, acq);
  const currentPoke = POKEMON_DATA.filter(p => locs[p.no] === loc.name);
  const currentNos  = new Set(currentPoke.map(p => p.no));

  const isCurrent = _curSpecTab === "current";

  const specChip = (p, isNew) =>
    `<span class="spec-poke-chip"${isNew ? ' style="border-color:#4a7c59;"' : ""}>
      <img src="${SP(p)}" onerror="this.style.display='none'">${p.name}
    </span>`;

  const specGrid = SPECS.map(s => {
    const pokes  = isCurrent ? (currPokes[s]    || []) : (plannedPokes[s] || []);
    const count  = isCurrent ? curr[s]                 : planned[s];
    const active = count > 0;
    const gap    = !isCurrent && orig[s] > 0 && planned[s] === 0;
    const color  = isCurrent ? "#4a7c59" : "#7a4faf";
    return `<div class="spec-card${orig[s] === 0 ? " spec-empty" : ""}${gap ? " spec-gap" : ""}" style="${active ? "border-color:" + color : ""}">
      <div class="spec-name">${s}</div>
      <div class="spec-count-row">
        <span class="${isCurrent ? "spec-current" : "spec-planned"}" style="${active ? "color:" + color : ""}">${count}</span>
        <span class="spec-divider">/</span>
        <span class="spec-total">${orig[s]}</span>
      </div>
      ${pokes.length ? `<div class="spec-poke-tags">${pokes.map(p => specChip(p, !isCurrent && !currentNos.has(p.no))).join("")}</div>` : ""}
    </div>`;
  }).join("");

  // Gap callout (planned tab only)
  const gapSpecs = !isCurrent ? SPECS.filter(s => orig[s] > 0 && planned[s] === 0) : [];
  const gapCallout = gapSpecs.length
    ? `<div class="spec-gap-callout"><span class="spec-gap-label">Missing specs:</span>${gapSpecs.map(s => `<span class="spec-gap-chip">${s}</span>`).join("")}</div>`
    : "";

  // Movement lists
  const plannedPoke = [];
  hh.forEach(h => {
    if (h.loc !== loc.name) return;
    (h.m || []).forEach(no => {
      if (!plannedPoke.find(x => x.no === no)) {
        const pp = POKE_BY_NO[no]; if (pp) plannedPoke.push(pp);
      }
    });
  });
  const movingIn   = plannedPoke.filter(p => !currentNos.has(p.no));
  const movingAway = currentPoke.filter(p => { const hhLoc = _getPlannedLoc(p.no, hh); return hhLoc && hhLoc !== loc.name; });
  const residing   = currentPoke.filter(p => { const hhLoc = _getPlannedLoc(p.no, hh); return !hhLoc || hhLoc === loc.name; });

  const clickChip = (p, style = "", tooltip = "") => {
    const idx = POKEMON_DATA.findIndex(x => x.no === p.no);
    return `<div class="poke-list-item clickable" onclick="app.switchTab(0);setTimeout(()=>app.openDetail(${idx}),60)" ${style ? `style="${style}"` : ""} ${tooltip ? `title="${tooltip}"` : ""}>
      <img src="${SP(p)}" onerror="this.style.display='none'" style="pointer-events:none"><span style="pointer-events:none">${p.name}</span>
    </div>`;
  };

  const pokeListsHtml = isCurrent
    ? `<div class="poke-subheader" style="font-size:12px;font-weight:800;margin-bottom:6px;">Currently Here (${currentPoke.length})</div>
       ${currentPoke.length
         ? `<div class="poke-list-grid" style="margin-bottom:10px;">${currentPoke.map(p => clickChip(p)).join("")}</div>`
         : `<p style="color:var(--muted);font-size:12px;margin-bottom:10px;">No Pokémon currently here</p>`}`
    : `${movingIn.length   ? `<div class="poke-subheader moving-in">Moving In (${movingIn.length})</div><div class="poke-list-grid" style="margin-bottom:6px;">${movingIn.map(p => clickChip(p, "border-color:#4a7c59;", `from ${locs[p.no] || "unset"}`)).join("")}</div>` : ""}
       ${residing.length   ? `<div class="poke-subheader residing">Residing (${residing.length})</div><div class="poke-list-grid" style="margin-bottom:6px;">${residing.map(p => clickChip(p)).join("")}</div>` : ""}
       ${movingAway.length ? `<div class="poke-subheader moving-away">Moving Away (${movingAway.length})</div><div class="poke-list-grid" style="margin-bottom:6px;">${movingAway.map(p => clickChip(p, "border-color:#b84040;opacity:0.8;", `to ${_getPlannedLoc(p.no, hh) || "unset"}`)).join("")}</div>` : ""}
       ${!movingIn.length && !residing.length && !movingAway.length ? `<p style="color:var(--muted);font-size:12px;margin-bottom:10px;">No movement planned</p>` : ""}`;

  container.innerHTML = `
    ${pokeListsHtml}
    <hr style="border:none;border-top:1px solid var(--border);margin:8px 0 12px;">
    ${gapCallout}
    <div class="spec-grid">${specGrid}</div>`;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function _getPlannedLoc(no, hh) {
  const h = hh.find(h => (h.m || []).includes(no));
  return h && h.loc ? h.loc : null;
}

function _getSpecCounts(locName, locs, hh, acq) {
  const orig = {}, curr = {}, planned = {}, currPokes = {}, plannedPokes = {};
  SPECS.forEach(s => { orig[s] = curr[s] = planned[s] = 0; currPokes[s] = []; plannedPokes[s] = []; });
  POKEMON_DATA.forEach(p => {
    if (!p.canonical || !p.specs.length) return;
    const ep = effectivePrefLoc(p);
    p.specs.forEach(s => {
      if (!(s in orig)) return;
      if (ep === locName) orig[s]++;
      if (locs[p.no] === locName) { curr[s]++; currPokes[s].push(p); }
      const hhLoc      = _getPlannedLoc(p.no, hh);
      const effPlanned = hhLoc || locs[p.no] || null;
      if (effPlanned === locName) { planned[s]++; plannedPokes[s].push(p); }
    });
  });
  return { orig, curr, planned, currPokes, plannedPokes };
}

function _getHousingData(locName, hh) {
  const inLoc  = hh.filter(h => h.loc === locName);
  const counts = { block: 0, singles: 0, doubles: 0 };
  inLoc.forEach(h => { counts[h.type] = (counts[h.type] || 0) + 1; });
  const used = Object.entries(counts).reduce(
    (sum, [type, n]) => sum + n * (TYPE_SLOT_WEIGHT[type] ?? 0), 0
  );
  return { counts, used };
}

