// js/ui/render-dashboard.js
// -----------------------------------------------------------------------------
// Dashboard tab — welcome/trainer panel on the left, at-a-glance Pokédex and
// habitat preview rows on the right.
//
// The trainer name is stored as a triple in the user graph (via actions.js)
// so it survives export/import/reset like all other user state.
// -----------------------------------------------------------------------------

import { POKEMON_DATA, HABITAT_DATA } from "../data/game-data.js";
import { LKEY, CANONICAL_COUNT, SP, SH } from "../data/lookups.js";
import { queryAllState, getAllHouseholds, isHabComplete } from "../store/queries.js";
import { getTrainerName, setTrainerName } from "../store/actions.js";
import { switchTab }                 from "./tabs.js";
import { openDetail }                from "./render-pokedex.js";
import { openHabDetail }             from "./render-habitats.js";
import { TAB_SWITCH_DELAY }          from "./ui-constants.js";

// ── Left panel: welcome + trainer ────────────────────────────────────────────

export function renderLeftPanel() {
  const name = getTrainerName();
  const { acq } = queryAllState();
  const hasData = Object.keys(acq).length > 0;

  const trainerEl = document.getElementById("trainer-display");
  if (trainerEl) trainerEl.textContent = name ? `Trainer: ${name}` : "";

  const welcomeEl = document.getElementById("left-panel-welcome");
  if (!welcomeEl) return;

  if (name) {
    welcomeEl.innerHTML = `
      <div class="dash-welcome-title">Welcome back, ${name}! 👋</div>
      <div id="change-name-area">
        <button class="btn-change-name" onclick="app.showChangeName()">✏ Change name</button>
      </div>`;
  } else {
    welcomeEl.innerHTML = `
      <div class="dash-welcome-title">Welcome to Pokopia!</div>
      <div class="dash-welcome-sub">${hasData ? "Enter your trainer name." : "Enter your trainer name to get started, or import a backup."}</div>
      <input class="trainer-name-input" id="trainer-name-input" type="text" placeholder="Trainer name..." maxlength="30" autofocus>
      <button class="btn-set-name" onclick="app.saveTrainerName()">Set Name</button>`;
    // 0ms deferred — push to next microtask so the element exists in the DOM
    setTimeout(() => {
      const inp = document.getElementById("trainer-name-input");
      if (inp) inp.addEventListener("keydown", e => { if (e.key === "Enter") app.saveTrainerName(); });
    }, 0);
  }
}

export function showChangeName() {
  const area = document.getElementById("change-name-area");
  if (!area) return;
  const current = getTrainerName();
  area.innerHTML = `
    <input class="trainer-name-input" id="trainer-name-input" type="text" placeholder="Trainer name..." maxlength="30" value="${current.replace(/"/g, "&quot;")}">
    <div style="display:flex;gap:6px;margin-top:6px;">
      <button class="btn-set-name" onclick="app.saveTrainerName()">Save</button>
      <button class="btn-cancel-name" onclick="app.renderLeftPanel()">Cancel</button>
    </div>`;
  const inp = document.getElementById("trainer-name-input");
  if (inp) {
    inp.focus();
    inp.select();
    inp.addEventListener("keydown", e => {
      if (e.key === "Enter")  app.saveTrainerName();
      if (e.key === "Escape") app.renderLeftPanel();
    });
  }
}

export function saveTrainerName() {
  const inp = document.getElementById("trainer-name-input");
  const val = inp ? inp.value.trim() : "";
  if (val) { setTrainerName(val); renderLeftPanel(); }
}

// ── Dashboard search helpers (R9) ─────────────────────────────────────────────
// Extracted so each search input only rebuilds its own card row rather than
// triggering a full re-render (queryAllState + getAllHouseholds) on every keypress.
// Both are exported so main.js can wire them to window.app.

export function filterDashPoke() {
  const { acq, locs } = queryAllState();
  const pqL = ((document.getElementById("dash-poke-search") || {}).value || "").toLowerCase().trim();
  const pokeMatches = POKEMON_DATA.filter(p => !pqL || p.name.toLowerCase().includes(pqL) || p.no.includes(pqL));
  const pokeRow = document.getElementById("dash-poke-row");
  if (pokeRow) {
    pokeRow.innerHTML = pokeMatches.slice(0, 80).map(p => {
      const i    = POKEMON_DATA.indexOf(p);
      const isAcq = !!acq[p.no];
      const locKey = locs[p.no] && LKEY[locs[p.no]] ? LKEY[locs[p.no]] : "";
      const lc     = isAcq && locKey ? " loc-" + locKey : "";
      return `<div class="poke-card${isAcq ? " acquired" : ""}${lc}" onclick="app.openDetailFromDash(${i})">
        <div class="sprite-wrap"><img src="${SP(p)}" alt="${p.name}" loading="lazy" onerror="this.style.opacity='.05'"></div>
        <div class="poke-no">${p.no}</div><div class="poke-name">${p.name}</div>
      </div>`;
    }).join("");
  }
}

export function filterDashHab() {
  const { acq } = queryAllState();
  const hqL = ((document.getElementById("dash-hab-search") || {}).value || "").toLowerCase().trim();
  const habMatches = HABITAT_DATA.filter(h => !hqL || h.name.toLowerCase().includes(hqL) || h.no.includes(hqL));
  const habRow = document.getElementById("dash-hab-row");
  if (habRow) {
    habRow.innerHTML = habMatches.slice(0, 80).map(h => {
      const i        = HABITAT_DATA.indexOf(h);
      const complete = isHabComplete(h, acq);
      const lc  = complete && h.prefLoc && LKEY[h.prefLoc] ? " loc-" + LKEY[h.prefLoc] : "";
      const wip = !complete ? " hab-wip" : "";
      return `<div class="hab-card${lc}${wip}" onclick="app.openDetailFromDash(${i},true)">
        <div class="hab-card-img"><img src="${SH(h)}" alt="${h.name}" loading="lazy" onerror="this.style.opacity='.08'"></div>
        <div class="hab-card-no">${h.no}</div><div class="hab-card-name">${h.name}</div>
      </div>`;
    }).join("");
  }
}

// ── Dashboard right content ───────────────────────────────────────────────────

export function renderDashboard() {
  renderLeftPanel();

  const { acq } = queryAllState();
  const acqCount      = POKEMON_DATA.filter(p => p.canonical && acq[p.no]).length;
  const completeCount = HABITAT_DATA.filter(h => isHabComplete(h, acq)).length;

  const pokeCountEl = document.getElementById("dash-poke-count");
  if (pokeCountEl) pokeCountEl.textContent = `${acqCount} / ${CANONICAL_COUNT} acquired`;
  const habCountEl = document.getElementById("dash-hab-count");
  if (habCountEl) habCountEl.textContent = `${completeCount} / ${HABITAT_DATA.length} completed`;

  filterDashPoke();
  filterDashHab();
}

// ── Detail panel openers from the dashboard ───────────────────────────────────

export function openDetailFromDash(idx, isHab = false) {
  // 60ms: one step above TAB_SWITCH_DELAY — gives slower devices extra margin after the tab switch.
  if (isHab) { switchTab(3); setTimeout(() => openHabDetail(idx), 60); }
  else        { switchTab(0); setTimeout(() => openDetail(idx),    60); }
}
