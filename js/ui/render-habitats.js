// js/ui/render-habitats.js
// -----------------------------------------------------------------------------
// Habitats tab. Three-state habitat model:
//
//   0 = unknown    — no Pokémon acquired; gray (hab-wip), no ring
//   1 = discovered — ≥1 acquired but not all
//   2 = complete   — all acquired
//
// The detail view writes into the shared-detail-card (left panel), consistent
// with how Pokédex and Households work.
// -----------------------------------------------------------------------------

import { POKEMON_DATA, HABITAT_DATA } from "../data/game-data.js";
import { LKEY, LCOLOR, POKE_BY_NO, SP, SH } from "../data/lookups.js";
import { queryAllState } from "../store/queries.js";
import { markHabitatComplete } from "../store/actions.js";
import { claimCard, resetCard } from "./shared-card.js";
import { CREDITS_HTML, TAB_SWITCH_DELAY } from "./ui-constants.js";
import { switchTab }    from "./tabs.js";
import { showPokePreview, hidePreview } from "./preview.js";

let _habDetailIdx      = null;
let _visibleHabIndices = [];
let _justOpenedHab     = false;
let _habConfirmIdx     = null;

export function isHabPanelJustOpened()   { return _justOpenedHab; }

// ── State helpers ─────────────────────────────────────────────────────────────

export function habState(h, acq) {
  if (!h.pokemon.length) return 0;
  const anyAcq = h.pokemon.some(no => !!acq[no]);
  if (!anyAcq) return 0;
  return h.pokemon.every(no => !!acq[no]) ? 2 : 1;
}

function _habIdealTypes(h) {
  const types = new Set();
  h.pokemon.forEach(no => { const p = POKE_BY_NO[no]; if (p && p.idealHab) types.add(p.idealHab); });
  return types;
}

// ── Tracker label ─────────────────────────────────────────────────────────────

function _buildHabTrackerLabel(q, lf, ift, v) {
  const total = HABITAT_DATA.length;
  if (!q && !lf && !ift) return `All habitats (${v} / ${total})`;
  if (q) {
    let among = "among";
    if (ift) among += ` ${ift}`;
    among += " habitats";
    if (lf) among += ` in ${lf}`;
    return `Searching '${q}' ${among} (${v} / ${total})`;
  }
  const parts = [];
  if (ift) parts.push(ift);
  parts.push("habitats");
  if (lf) parts.push(`in ${lf}`);
  let base = parts.join(" ");
  base = base.charAt(0).toUpperCase() + base.slice(1);
  return `${base} (${v} / ${total})`;
}

// ── Grid render ───────────────────────────────────────────────────────────────

export function renderHabitats() {
  const { acq } = queryAllState();
  const grid    = document.getElementById("hab-grid");
  if (!grid) return;
  grid.innerHTML = HABITAT_DATA.map((h, i) => {
    const state = habState(h, acq);
    const lc    = state === 2 && h.prefLoc && LKEY[h.prefLoc] ? " loc-" + LKEY[h.prefLoc] : "";
    const wip   = state === 0 ? " hab-wip"        : "";
    const disc  = state === 1 ? " hab-discovered" : "";
    const comp  = state === 2 ? " hab-complete"   : "";
    const isSelected  = _habDetailIdx === i ? " selected-card" : "";
    const ringClick   = state === 1 ? `event.stopPropagation();app.habCheckRing(${i})` : "event.stopPropagation()";
    return `<div class="hab-card${lc}${wip}${disc}${comp}${isSelected}" data-hi="${i}" data-state="${state}" onclick="app.openHabDetail(${i})">
      <div class="check-ring" onclick="${ringClick}"></div>
      <div class="hab-card-img"><img src="${SH(h)}" alt="${h.name}" loading="lazy" onerror="this.style.opacity='.08'"></div>
      <div class="hab-card-no">${h.no}</div>
      <div class="hab-card-name">${h.name}</div>
    </div>`;
  }).join("");
  filterHabitats();
  if (_habDetailIdx !== null) { claimCard(3); _renderHabDetailCard(_habDetailIdx); }
}

// ── Filter ────────────────────────────────────────────────────────────────────

export function filterHabitats() {
  const q   = (document.getElementById("hab-search")?.value || "").toLowerCase().trim();
  const lf  =  document.getElementById("filter-hab-loc")?.value || "";
  const ift =  document.getElementById("filter-hab-ideal")?.value || "";
  _visibleHabIndices = [];
  let v = 0;
  document.querySelectorAll("#hab-grid .hab-card").forEach(c => {
    const h = HABITAT_DATA[+c.dataset.hi];
    let show = true;
    if (lf  && h.prefLoc !== lf)            show = false;
    if (ift && !_habIdealTypes(h).has(ift)) show = false;
    if (q) {
      const habMatch  = h.name.toLowerCase().includes(q) || h.no.includes(q);
      const pokeMatch = h.pokemon.some(no => { const p = POKE_BY_NO[no]; return p && p.name.toLowerCase().includes(q); });
      if (!habMatch && !pokeMatch) show = false;
    }
    c.style.display = show ? "" : "none";
    if (show) { v++; _visibleHabIndices.push(+c.dataset.hi); }
  });
  const gc = document.getElementById("hab-grid-count");
  if (gc) gc.textContent = _buildHabTrackerLabel(q, lf, ift, v);
  const cb = document.getElementById("hab-clear-filter");
  if (cb) cb.style.display = (q || lf || ift) ? "inline-flex" : "none";

  // Dual search panel
  const searchPanel = document.getElementById("hab-search-poke-panel");
  if (!searchPanel) return;
  if (!q) { searchPanel.style.display = "none"; return; }
  const { locs } = queryAllState();
  const pokeHits = POKEMON_DATA.filter(p => p.canonical && p.name.toLowerCase().includes(q));
  if (!pokeHits.length) { searchPanel.style.display = "none"; return; }
  const chips = pokeHits.map(p => {
    const pdIdx  = POKEMON_DATA.findIndex(x => x.no === p.no);
    const locCls = locs[p.no] && LKEY[locs[p.no]] ? " loc-" + LKEY[locs[p.no]] : "";
    return `<div class="hab-poke-chip${locCls}" style="cursor:pointer;" onclick="app.switchTab(0);setTimeout(()=>app.openDetail(${pdIdx}),50)">
      <img src="${SP(p)}" alt="${p.name}" onerror="this.style.display='none'"><span>${p.name}</span>
    </div>`;
  }).join("");
  searchPanel.innerHTML = `<div class="hab-search-poke-header">Pokémon matching '${q}' (${pokeHits.length})</div><div class="hab-poke-grid">${chips}</div>`;
  searchPanel.style.display = "block";
}

export function clearHabFilters() {
  const s = document.getElementById("hab-search");     if (s) s.value = "";
  const l = document.getElementById("filter-hab-loc"); if (l) l.value = "";
  const i = document.getElementById("filter-hab-ideal"); if (i) i.value = "";
  filterHabitats();
}

// ── Detail card (shared-detail-card) ─────────────────────────────────────────

function _renderHabDetailCard(idx) {
  const cardEl = document.getElementById("shared-detail-card");
  if (!cardEl) return;
  if (idx === null) { resetCard(); return; }

  const h = HABITAT_DATA[idx];
  const { acq, locs } = queryAllState();
  const state = habState(h, acq);
  const lc    = LCOLOR[h.prefLoc];

  const chips = h.pokemon.map(no => {
    const p = POKE_BY_NO[no]; if (!p) return "";
    const isAcq   = !!acq[p.no];
    const chipLoc = isAcq && locs[p.no] && LKEY[locs[p.no]] ? ` loc-${LKEY[locs[p.no]]}` : "";
    return `<div class="hab-poke-chip${chipLoc}" onmouseenter="app.showPokePreview(event,'${no}')" onmouseleave="app.hidePreview()" onclick="app.goToPokemon('${no}')">
      <img src="${SP(p)}" alt="${p.name}" onerror="this.style.display='none'"><span>${p.name}</span>
    </div>`;
  }).join("");

  const markHtml = state === 1
    ? `<button class="btn-mark-complete" onclick="app.habCheckRing(${idx})">✓ Mark as Complete</button>`
    : state === 2 ? `<div class="hab-complete-badge">✓ Completed</div>` : "";

  const vi      = _visibleHabIndices.indexOf(idx);
  const prevDis = vi <= 0                                        ? "disabled" : "";
  const nextDis = vi < 0 || vi >= _visibleHabIndices.length - 1 ? "disabled" : "";

  cardEl.innerHTML = `
    <div class="card-hero">
      <img src="${SH(h)}" alt="${h.name}" onerror="this.style.opacity='.05'" style="width:72px;height:72px;object-fit:contain;">
      <div class="card-no">${h.no}</div>
      <div class="card-name">${h.name}</div>
    </div>
    <div class="card-body">
      <div class="card-row"><div class="card-label">Description</div><div class="card-val" style="font-style:italic;font-size:11px;color:var(--muted);">${h.desc || "—"}</div></div>
      <div class="card-row"><div class="card-label">Pref. Location</div><div class="card-val">${h.prefLoc ? `<span class="loc-badge" style="background:${lc}">${h.prefLoc}</span>` : "—"}</div></div>
      <div class="card-row" style="flex-direction:column;align-items:stretch;">
        <div class="card-label" style="width:100%;padding-bottom:6px;">Attracts</div>
        <div style="padding:4px 12px 8px;display:flex;flex-wrap:wrap;gap:5px;">${chips || '<span style="color:var(--muted);font-size:12px;">No Pokémon tagged</span>'}</div>
        ${markHtml ? `<div style="display:flex;justify-content:center;padding:4px 0 8px;">${markHtml}</div>` : ""}
      </div>
    </div>
    ${CREDITS_HTML}
    <div style="display:flex;gap:6px;padding:8px 12px;border-top:1px solid var(--border);">
      <button ${prevDis} onclick="app.navHabDetail(-1)" style="flex:1;font-family:inherit;font-size:12px;padding:5px;border-radius:8px;border:1px solid var(--border);background:var(--panel2);cursor:pointer;">← Prev</button>
      <button ${nextDis} onclick="app.navHabDetail(1)"  style="flex:1;font-family:inherit;font-size:12px;padding:5px;border-radius:8px;border:1px solid var(--border);background:var(--panel2);cursor:pointer;">Next →</button>
    </div>`;
}

// ── Public API ────────────────────────────────────────────────────────────────

export function openHabDetail(idx) {
  _justOpenedHab = true;
  setTimeout(() => { _justOpenedHab = false; }, 0);
  const prev = _habDetailIdx;
  _habDetailIdx = idx;
  if (prev !== null) {
    const old = document.querySelector(`#hab-grid .hab-card[data-hi="${prev}"]`);
    if (old) old.classList.remove("selected-card");
  }
  const card = document.querySelector(`#hab-grid .hab-card[data-hi="${idx}"]`);
  if (card) { card.classList.add("selected-card"); card.scrollIntoView({ block: "nearest", behavior: "smooth" }); }
  claimCard(3); // Habitats tab owns the card
  _renderHabDetailCard(idx);
}

export function navHabDetail(dir) {
  const vi = _visibleHabIndices.indexOf(_habDetailIdx);
  if (vi < 0) return;
  const ni = vi + dir;
  if (ni < 0 || ni >= _visibleHabIndices.length) return;
  openHabDetail(_visibleHabIndices[ni]);
}

export function closeHabDetail() {
  const prev = _habDetailIdx;
  _habDetailIdx = null;
  if (prev !== null) {
    const old = document.querySelector(`#hab-grid .hab-card[data-hi="${prev}"]`);
    if (old) old.classList.remove("selected-card");
  }
  resetCard();
}

// ── Check-ring confirm modal ──────────────────────────────────────────────────

export function habCheckRing(idx) {
  _habConfirmIdx = idx;
  const h    = HABITAT_DATA[idx];
  const list = document.getElementById("hab-confirm-list");
  if (list) {
    list.innerHTML = h.pokemon.map(no => {
      const p = POKE_BY_NO[no]; if (!p) return "";
      return `<div class="hab-poke-chip" style="cursor:pointer;" onclick="app.habConfirmNo();app.goToPokemon('${no}')">
        <img src="${SP(p)}" onerror="this.style.display='none'"><span>${p.name}</span></div>`;
    }).join("");
  }
  const modal = document.getElementById("hab-confirm-modal");
  if (modal) modal.style.display = "flex";
}

export function habConfirmYes() {
  if (_habConfirmIdx === null) return;
  markHabitatComplete(_habConfirmIdx);
  const modal = document.getElementById("hab-confirm-modal");
  if (modal) modal.style.display = "none";
  const completedIdx = _habConfirmIdx;
  _habConfirmIdx = null;
  // Re-render only what's needed
  renderHabitats();
  // Cross-module calls via window.app — direct imports would be circular (render-habitats ↔ render-pokedex).
  if (window.app?.renderPokedex) window.app.renderPokedex();
  if (window.app?.updateReg)     window.app.updateReg();
  if (_habDetailIdx === completedIdx) _renderHabDetailCard(completedIdx);
}

export function habConfirmNo() {
  const modal = document.getElementById("hab-confirm-modal");
  if (modal) modal.style.display = "none";
  _habConfirmIdx = null;
}

export function goToHabitat(habIdx) {
  switchTab(3);
  setTimeout(() => openHabDetail(habIdx), TAB_SWITCH_DELAY);
}


