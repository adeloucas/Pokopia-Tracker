// js/ui/render-pokedex.js
// -----------------------------------------------------------------------------
// Pokédex tab — the main grid, filter bar, detail panel, and the
// "Form Household" multi-select mode that lives on the Pokédex.
//
// Detail-panel state and HH-select state are private to this module. The
// few values other modules need (detail index, visible-indices array,
// just-opened flag) are exposed via small accessor functions.
// -----------------------------------------------------------------------------

import { POKEMON_DATA, HABITAT_DATA, LOCATION_DATA, TYPE_MAX } from "../data/game-data.js";
import {
  POKE_BY_NO, POKE_HABS,
  LOC_ABBR, LCOLOR, LKEY,
  effectivePrefLoc,
  SP
} from "../data/lookups.js";

import {
  queryAllState, queryHouseholdMembership
} from "../store/queries.js";
import {
  toggleAcquired, setLocation,
  addHousehold, addMember, setHouseholdLoc
} from "../store/actions.js";

import { switchTab }    from "./tabs.js";
import { showHabPreview, hidePreview } from "./preview.js";
import { claimCard, resetCard } from "./shared-card.js";
import { CREDITS_HTML, TAB_SWITCH_DELAY, FOCUS_DELAY } from "./ui-constants.js";

// ── Module state ─────────────────────────────────────────────────────────────

let _detailIdx         = null;
let _visibleIndices    = [];
let _justOpenedDetail  = false;
let _hhSelectMode      = false;
let _hhSelection       = new Set();

// Derived from LOCATION_DATA so it stays in sync if locations are added/renamed.
const LOC_CLASSES = LOCATION_DATA.map(l => "loc-" + l.key);

// Max Pokémon selectable in HH mode = largest capacity across all home types.
// Derived so it stays correct if TYPE_MAX ever gains a larger type.
const HH_SELECT_MAX = Math.max(...Object.values(TYPE_MAX));

// Cross-module accessors — keep state private but reachable.
export function isDetailJustOpened()   { return _justOpenedDetail; }

// ── Header counter ───────────────────────────────────────────────────────────

export function updateReg() {
  const { acq } = queryAllState();
  const n = POKEMON_DATA.filter(p => p.canonical && acq[p.no]).length;
  document.getElementById("registered-count").textContent = `${n} Registered`;
}

// ── Tracker label ────────────────────────────────────────────────────────────
//   Natural:   "All Pokémon (309 / 309)"
//   Filtered:  "[status] Pokémon in [loc] with the [spec] ability ..."
//   Searching: "Searching '[q]' among [filtered sentence]"

function _buildTrackerLabel(q, af, lf, sf, hf, visibleCount) {
  const total = POKEMON_DATA.length;
  const noFilters = !q && (af === "all" || !af) && !lf && !sf && !hf;
  if (noFilters) return `All Pokémon (${total} / ${total})`;

  const STATUS = { acquired: "acquired", missing: "unacquired", unhoused: "location-less acquired" };
  const parts = [];
  if (af && af !== "all") parts.push(STATUS[af] || af);
  parts.push("Pokémon");
  if (sf) parts.push(`with the ${sf} ability`);
  if (hf) parts.push(`that prefer ${hf} habitats`);
  if (lf) parts.push(`in ${lf}`);

  const sentence = parts.join(" ");

  if (q) {
    return `Searching '${q}' among ${sentence} (${visibleCount} / ${total})`;
  }
  const cap = sentence.charAt(0).toUpperCase() + sentence.slice(1);
  return `${cap} (${visibleCount} / ${total})`;
}

// ── Location badges (right rail) ─────────────────────────────────────────────

function _buildLocBadges(no, curLoc) {
  return LOCATION_DATA.map(ld => {
    const active = curLoc === ld.name;
    const style  = active ? `background:${ld.color};color:#fff;border-color:${ld.color};` : "";
    const target = active ? "" : ld.name;
    return `<div class="poke-loc-badge${active ? " active" : ""}"
        style="${style}"
        onclick="event.stopPropagation();app.setLocByNo('${no}','${target}')"
        title="${active ? "Currently: " : "Set to: "}${ld.name}">${LOC_ABBR[ld.key]}</div>`;
  }).join("");
}

// ── Grid render ──────────────────────────────────────────────────────────────

export function renderPokedex() {
  const { acq, locs } = queryAllState();
  const hhMap         = queryHouseholdMembership();

  document.getElementById("poke-grid").innerHTML = POKEMON_DATA.map((p, i) => {
    const isAcq   = !!acq[p.no];
    const curLoc  = locs[p.no] || "";
    const hhEntry = hhMap[p.no];
    const locKey  = isAcq && curLoc && LKEY[curLoc] ? LKEY[curLoc] : "";
    const locCls  = locKey ? " loc-" + locKey : "";

    const cardTitle = hhEntry
      ? `In ${hhEntry.hhName}${hhEntry.hhLoc ? " · " + hhEntry.hhLoc : ""}`
      : (isAcq ? "Acquired — no household" : "Not acquired");

    const badgeRail = isAcq
      ? `<div class="poke-badge-rail" onclick="event.stopPropagation()">${_buildLocBadges(p.no, curLoc)}</div>`
      : "";

    const selectCls   = _hhSelectMode ? " selectable" : "";
    const selectedCls = _hhSelectMode && _hhSelection.has(p.no) ? " hh-selected" : "";
    const cardClick   = _hhSelectMode
      ? `onclick="app.toggleHHSelect('${p.no}')"`
      : `onclick="app.openDetail(${i})"`;
    const ringClick   = _hhSelectMode
      ? `app.toggleHHSelect('${p.no}')`
      : `app.toggleAcqByIdx(${i})`;

    return `<div class="poke-card${isAcq ? " acquired" : ""}${locCls}${selectCls}${selectedCls}"
        data-i="${i}" data-no="${p.no}"
        data-acq="${isAcq ? "1" : "0"}"
        data-hh="${hhEntry ? "1" : "0"}"
        data-curloc="${curLoc}"
        ${cardClick}
        title="${cardTitle}">
      <div class="check-ring" onclick="event.stopPropagation();${ringClick}"></div>
      <div class="poke-card-inner">
        <div class="poke-card-left">
          <div class="sprite-wrap">
            <img src="${SP(p)}" alt="${p.name}" loading="lazy" onerror="this.style.opacity='.05'">
          </div>
          <div class="poke-no">${p.no}</div>
          <div class="poke-name">${p.name}</div>
        </div>
        ${badgeRail}
      </div>
    </div>`;
  }).join("");

  updateReg();
  filterPokemon();
  // Restore the detail card if a Pokémon was previously selected
  if (_detailIdx !== null) openDetail(_detailIdx);
}

// ── Filter ───────────────────────────────────────────────────────────────────
// Scoped to #poke-grid only — dashboard cards share the .poke-card class but
// have no data-i attribute. They must not be counted or filtered here.

export function filterPokemon() {
  const q  = (document.getElementById("poke-search").value      || "").toLowerCase().trim();
  const af =  document.getElementById("filter-acquired").value  || "all";
  const lf =  document.getElementById("filter-loc").value       || "";
  const hf =  document.getElementById("filter-hab").value       || "";
  const sf =  document.getElementById("filter-spec").value      || "";

  _visibleIndices = [];
  let v = 0;

  document.querySelectorAll("#poke-grid .poke-card").forEach(c => {
    const p     = POKEMON_DATA[+c.dataset.i];
    if (!p) return;
    const isAcq = c.dataset.acq === "1";
    const hasHH = c.dataset.hh  === "1";
    let show = true;

    if (q  && !p.name.toLowerCase().includes(q) && !p.no.includes(q)) show = false;
    if (af === "acquired"  && !isAcq)             show = false;
    if (af === "missing"   &&  isAcq)             show = false;
    if (af === "unhoused"  && !(isAcq && !hasHH)) show = false;
    if (lf && effectivePrefLoc(p) !== lf)         show = false;
    if (hf && p.idealHab !== hf)                  show = false;
    if (sf && !p.specs.includes(sf))              show = false;

    c.style.display = show ? "" : "none";
    if (show) { v++; _visibleIndices.push(+c.dataset.i); }
  });

  document.getElementById("grid-count").textContent =
    _buildTrackerLabel(q, af, lf, sf, hf, v);

  const clearBtn = document.getElementById("poke-clear-filter");
  if (clearBtn) clearBtn.style.display = (q || af !== "all" || lf || hf || sf) ? "inline-flex" : "none";
}

export function clearPokeFilters() {
  document.getElementById("poke-search").value     = "";
  document.getElementById("filter-acquired").value = "all";
  document.getElementById("filter-loc").value      = "";
  document.getElementById("filter-hab").value      = "";
  document.getElementById("filter-spec").value     = "";
  filterPokemon();
}

// ── Inline acquisition / location toggles ────────────────────────────────────

function _patchCardAcq(card, p, nowAcq) {
  card.classList.toggle("acquired", nowAcq);
  card.dataset.acq    = nowAcq ? "1" : "0";
  card.dataset.hh     = "0";
  card.dataset.curloc = "";
  LOC_CLASSES.forEach(c => card.classList.remove(c));

  const inner = card.querySelector(".poke-card-inner");
  if (!inner) return;
  const existingRail = inner.querySelector(".poke-badge-rail");
  if (existingRail) existingRail.remove();
  if (nowAcq) {
    const rail = document.createElement("div");
    rail.className = "poke-badge-rail";
    rail.setAttribute("onclick", "event.stopPropagation()");
    rail.innerHTML = _buildLocBadges(p.no, "");
    inner.appendChild(rail);
  }
}

export function toggleAcqByIdx(idx) {
  const p   = POKEMON_DATA[idx];
  const was = !!queryAllState().acq[p.no]; // read pre-toggle state from single store scan
  toggleAcquired(p.no);
  if (was) setLocation(p.no, null);
  const nowAcq = !was;

  // Patch the clicked card by its unique data-i index
  const card = document.querySelector(`#poke-grid .poke-card[data-i="${idx}"]`);
  if (card) _patchCardAcq(card, p, nowAcq);

  // Patch sibling cards that share data-no (cosmetic variants:
  // Tatsugiri ×3, Shellos ×2, Gastrodon ×2, Toxtricity ×2). They share
  // acquisition state but have distinct data-i values.
  document.querySelectorAll(`#poke-grid .poke-card[data-no="${p.no}"]`).forEach(sibling => {
    if (sibling === card) return;
    const sibIdx = +sibling.dataset.i;
    const sibP   = POKEMON_DATA[sibIdx];
    if (sibP) _patchCardAcq(sibling, sibP, nowAcq);
  });

  if (_detailIdx === idx) openDetail(idx);
  updateReg();
  filterPokemon();
}

export function setLocByNo(no, loc) {
  setLocation(no, loc || null);
  document.querySelectorAll(`#poke-grid .poke-card[data-no="${no}"]`).forEach(card => {
    LOC_CLASSES.forEach(c => card.classList.remove(c));
    if (loc && LKEY[loc]) card.classList.add("loc-" + LKEY[loc]);
    card.dataset.curloc = loc || "";
    const rail = card.querySelector(".poke-badge-rail");
    if (rail) rail.innerHTML = _buildLocBadges(no, loc);
  });
  if (_detailIdx !== null && POKEMON_DATA[_detailIdx].no === no) openDetail(_detailIdx);
}

// ── Detail panel ─────────────────────────────────────────────────────────────

/**
 * Builds the full innerHTML for the shared detail card given a Pokémon and
 * its current state. Pure template function — no DOM access, no side effects.
 */
function _buildDetailCardHTML(p, acq, curLoc, hhEntry, vi) {
  const ep       = effectivePrefLoc(p);
  const habNames = POKE_HABS[p.no] || [];
  const habHtml  = habNames.map(h => {
    const hi = HABITAT_DATA.findIndex(x => x.name === h);
    return hi >= 0
      ? `<span class="hab-tag" onmouseenter="app.showHabPreview(event,${hi})" onmouseleave="app.hidePreview()" onclick="app.goToHabitat(${hi})">${h}</span>`
      : `<span class="hab-tag">${h}</span>`;
  }).join("") || "—";

  const specsHtml = p.specs.length
    ? p.specs.map(s => `<span class="spec-tag">${s}</span>`).join("")
    : "—";

  const plannedLoc = hhEntry ? hhEntry.hhLoc  : "";
  const hhName     = hhEntry ? hhEntry.hhName : "";

  const locOptions = LOCATION_DATA.map(ld =>
    `<option value="${ld.name}"${curLoc === ld.name ? " selected" : ""}>${ld.name}</option>`
  ).join("");

  const locRowHtml = acq ? `
    <div class="card-row">
      <div class="card-label">Location</div>
      <div class="card-val">
        <select class="loc-select" onchange="app.setLocationFromDetail(this.value)" style="font-size:12px;padding:3px 6px;">
          <option value="">— none —</option>
          ${locOptions}
        </select>
      </div>
    </div>` : "";

  const plannedRowHtml = (acq && plannedLoc && plannedLoc !== curLoc) ? `
    <div class="card-row">
      <div class="card-label">Planned</div>
      <div class="card-val">
        <span class="loc-badge" style="background:${LCOLOR[plannedLoc] || "#888"}">${plannedLoc}</span>
        <span style="font-size:11px;color:var(--muted);margin-left:5px;">via ${hhName}</span>
      </div>
    </div>` : "";

  const prevDis = vi <= 0                                ? "disabled" : "";
  const nextDis = vi < 0 || vi >= _visibleIndices.length - 1 ? "disabled" : "";

  return `
    <div class="card-hero">
      <img src="${SP(p)}" alt="${p.name}" onerror="this.style.opacity='.05'" style="width:72px;height:72px;object-fit:contain;">
      <div class="card-no">${p.no}</div>
      <div class="card-name">${p.name}</div>
    </div>
    <div class="card-body">
      <div class="card-row">
        <div class="card-label">Status</div>
        <div class="card-val">
          <button class="detail-toggle${acq ? " on" : ""}" onclick="app.toggleAcquiredFromDetail()" style="font-size:12px;padding:4px 10px;border-radius:8px;border:none;cursor:pointer;background:${acq ? "#4a7c59" : "var(--border)"};color:${acq ? "#fff" : "var(--text)"};font-family:inherit;font-weight:700;">
            ${acq ? "Acquired ✓" : "Not Acquired"}
          </button>
        </div>
      </div>
      ${locRowHtml}
      ${plannedRowHtml}
      <div class="card-row">
        <div class="card-label">Pref. Loc.</div>
        <div class="card-val"><span class="loc-badge" style="background:${LCOLOR[ep]}">${ep}</span></div>
      </div>
      <div class="card-row">
        <div class="card-label">Ideal Hab.</div>
        <div class="card-val">${p.idealHab || "—"}</div>
      </div>
      <div class="card-row">
        <div class="card-label">Abilities</div>
        <div class="card-val" style="flex-wrap:wrap;gap:4px;display:flex;">${specsHtml}</div>
      </div>
      <div class="card-row" style="flex-direction:column;align-items:stretch;">
        <div class="card-label" style="width:100%;padding-bottom:6px;">Habitats</div>
        <div style="padding:4px 12px 8px;display:flex;flex-wrap:wrap;gap:5px;">${habHtml}</div>
      </div>
    </div>
    ${CREDITS_HTML}
    <div style="display:flex;gap:6px;padding:8px 12px;border-top:1px solid var(--border);">
      <button ${prevDis} onclick="app.navDetail(-1)" style="flex:1;font-family:inherit;font-size:12px;padding:5px;border-radius:8px;border:1px solid var(--border);background:var(--panel2);cursor:pointer;">← Prev</button>
      <button ${nextDis} onclick="app.navDetail(1)"  style="flex:1;font-family:inherit;font-size:12px;padding:5px;border-radius:8px;border:1px solid var(--border);background:var(--panel2);cursor:pointer;">Next →</button>
    </div>`;
}

export function openDetail(idx) {
  _justOpenedDetail = true;
  setTimeout(() => { _justOpenedDetail = false; }, 0);
  _detailIdx = idx;

  const p              = POKEMON_DATA[idx];
  const { acq, locs }  = queryAllState(); // single scan covers acq + loc
  const isAcq          = !!acq[p.no];
  const curLoc         = isAcq ? (locs[p.no] || "") : "";
  const hhEntry        = isAcq ? (queryHouseholdMembership()[p.no] ?? null) : null;
  const vi             = _visibleIndices.indexOf(idx);

  const cardEl = document.getElementById("shared-detail-card");
  if (!cardEl) return;

  claimCard(0); // Pokédex owns the shared card
  cardEl.innerHTML = _buildDetailCardHTML(p, isAcq, curLoc, hhEntry, vi);
}

export function navDetail(dir) {
  const vi = _visibleIndices.indexOf(_detailIdx);
  if (vi < 0) return;
  const ni = vi + dir;
  if (ni < 0 || ni >= _visibleIndices.length) return;
  openDetail(_visibleIndices[ni]);
}

export function closeDetail() {
  _detailIdx = null;
  resetCard();
}

export function toggleAcquiredFromDetail() {
  if (_detailIdx === null) return;
  toggleAcqByIdx(_detailIdx);
}

export function setLocationFromDetail(loc) {
  if (_detailIdx === null) return;
  setLocByNo(POKEMON_DATA[_detailIdx].no, loc);
}

export function goToPokemon(no) {
  const idx = POKEMON_DATA.findIndex(p => p.no === no);
  if (idx < 0) return;
  switchTab(0);
  setTimeout(() => openDetail(idx), TAB_SWITCH_DELAY);
}

// ── Household formation (multi-select on Pokédex) ────────────────────────────

export function toggleHHSelectMode() {
  if (_hhSelectMode) exitHHSelectMode();
  else               enterHHSelectMode();
}

function enterHHSelectMode() {
  _hhSelectMode = true;
  _hhSelection  = new Set();
  const btn = document.getElementById("btn-form-hh");
  btn.classList.add("active");
  btn.textContent = "✕ Exit Selection";
  document.getElementById("hh-select-tray").style.display = "block";
  renderPokedex();
}

export function exitHHSelectMode() {
  _hhSelectMode = false;
  _hhSelection  = new Set();
  const btn = document.getElementById("btn-form-hh");
  if (btn) { btn.classList.remove("active"); btn.innerHTML = "&#127968; Form Household"; }
  document.getElementById("hh-select-tray").style.display = "none";
  const chipsEl = document.getElementById("hh-tray-chips");
  if (chipsEl) chipsEl.innerHTML = "";
  const createBtn = document.getElementById("btn-tray-create");
  if (createBtn) createBtn.disabled = true;
  closeHHFormModal();
  renderPokedex();
}

export function toggleHHSelect(no) {
  const { acq } = queryAllState();
  if (!acq[no]) return;

  if (_hhSelection.has(no)) {
    _hhSelection.delete(no);
    _clearHHTrayError();
    _updateSelectionTray();
    _patchSelectionCards();
    return;
  }

  const hhMap = queryHouseholdMembership();
  if (hhMap[no]) {
    const p    = POKE_BY_NO[no];
    const name = p ? p.name : no;
    _showHHTrayError(`${name} is in "${hhMap[no].hhName}" Household. Please remove them from this household before continuing.`);
    return;
  }

  if (_hhSelection.size >= HH_SELECT_MAX) return;
  _clearHHTrayError();
  _hhSelection.add(no);
  _updateSelectionTray();
  _patchSelectionCards();
}

function _showHHTrayError(msg) {
  const err = document.getElementById("hh-tray-error");
  if (!err) return;
  err.textContent = msg;
  err.style.display = "block";
  clearTimeout(err._timer);
  err._timer = setTimeout(_clearHHTrayError, 5000);
}

function _clearHHTrayError() {
  const err = document.getElementById("hh-tray-error");
  if (err) err.style.display = "none";
}

function _updateSelectionTray() {
  const count     = _hhSelection.size;
  const createBtn = document.getElementById("btn-tray-create");
  const chipsEl   = document.getElementById("hh-tray-chips");
  if (createBtn) createBtn.disabled = (count === 0);
  if (!chipsEl) return;
  chipsEl.innerHTML = count === 0
    ? `<span style="color:#4a7c5988;font-size:12px;align-self:center;">No Pokémon selected yet</span>`
    : [..._hhSelection].map(no => {
        const p = POKE_BY_NO[no];
        if (!p) return "";
        return `<div class="hh-tray-chip">
          <img src="${SP(p)}" alt="${p.name}" onerror="this.style.display='none'">
          ${p.name}
          <span class="chip-remove" onclick="app.toggleHHSelect('${no}')">✕</span>
        </div>`;
      }).join("");
}

function _patchSelectionCards() {
  document.querySelectorAll("#poke-grid .poke-card.selectable").forEach(card => {
    const no = card.dataset.no;
    card.classList.toggle("hh-selected", _hhSelection.has(no));
    const ring = card.querySelector(".check-ring");
    if (ring) ring.setAttribute("onclick", `event.stopPropagation();app.toggleHHSelect('${no}')`);
  });
}

// ── HH formation modal ───────────────────────────────────────────────────────

export function openHHFormModal() {
  if (_hhSelection.size === 0) return;

  const preview = document.getElementById("hh-form-preview");
  if (preview) {
    preview.innerHTML = [..._hhSelection].map(no => {
      const p = POKE_BY_NO[no];
      if (!p) return "";
      return `<div class="hh-form-preview-chip">
        <img src="${SP(p)}" alt="${p.name}" onerror="this.style.display='none'">
        ${p.name}
      </div>`;
    }).join("");
  }

  const habInfoEl = document.getElementById("hh-form-hab-info");
  if (habInfoEl) {
    const habSet   = new Set();
    const idealSet = new Set();
    [..._hhSelection].forEach(no => {
      const p = POKE_BY_NO[no];
      if (!p) return;
      (POKE_HABS[no] || []).forEach(h => habSet.add(h));
      if (p.idealHab) idealSet.add(p.idealHab);
    });
    let html = "";
    if (idealSet.size) {
      html += `<div class="hh-form-hab-row">
        <span class="hh-form-hab-label">Ideal Habitats</span>
        <span class="hh-form-hab-val">${[...idealSet].join(" · ")}</span>
      </div>`;
    }
    if (habSet.size) {
      const tags = [...habSet].map(h => {
        const hi = HABITAT_DATA.findIndex(x => x.name === h);
        return hi >= 0
          ? `<span class="hh-hab-tag" style="cursor:pointer;" onmouseenter="app.showHabPreview(event,${hi})" onmouseleave="app.hidePreview()" onclick="app.closeHHFormModal();app.exitHHSelectMode();app.goToHabitat(${hi})">${h}</span>`
          : `<span class="hh-hab-tag">${h}</span>`;
      }).join("");
      html += `<div class="hh-form-hab-row" style="align-items:flex-start;">
        <span class="hh-form-hab-label">Assoc. Habitats</span>
        <div style="display:flex;flex-wrap:wrap;gap:3px;">${tags}</div>
      </div>`;
    }
    habInfoEl.innerHTML = html;
    habInfoEl.style.display = html ? "block" : "none";
  }

  const nameEl = document.getElementById("hh-form-name");
  if (nameEl) nameEl.value = "";
  const typeEl = document.getElementById("hh-form-type");
  if (typeEl) typeEl.value = "block";
  const locEl = document.getElementById("hh-form-loc");
  if (locEl) locEl.value = "";

  updateHHFormWarning();
  document.getElementById("hh-form-modal").style.display = "flex";
  setTimeout(() => nameEl && nameEl.focus(), FOCUS_DELAY);
}

export function closeHHFormModal() {
  document.getElementById("hh-form-modal").style.display = "none";
}

export function updateHHFormWarning() {
  const typeEl = document.getElementById("hh-form-type");
  const warnEl = document.getElementById("hh-form-warning");
  if (!typeEl || !warnEl) return;
  const type  = typeEl.value;
  const max   = TYPE_MAX[type] ?? 4;
  const count = _hhSelection.size;
  if (count > max) {
    const excess = count - max;
    warnEl.style.display = "flex";
    warnEl.innerHTML = `<span style="font-size:15px;">⚠</span>
      <span>You have ${count} Pokémon selected, but <strong>${typeEl.options[typeEl.selectedIndex].text.split('·')[0].trim()}</strong>
      only holds <strong>${max}</strong>.
      Remove ${excess} Pokémon from the selection, or choose a larger home type.
      Only the first ${max} will be saved.</span>`;
  } else {
    warnEl.style.display = "none";
  }
}

export function saveHHFromSelection() {
  const nameEl = document.getElementById("hh-form-name");
  const typeEl = document.getElementById("hh-form-type");
  const locEl  = document.getElementById("hh-form-loc");
  const name   = (nameEl ? nameEl.value.trim() : "") || "Unnamed";
  const type   = typeEl ? typeEl.value : "doubles";
  const loc    = locEl  ? locEl.value  : "";

  const id = addHousehold(name, type);
  if (loc) setHouseholdLoc(id, loc);
  const max = TYPE_MAX[type] ?? 4;
  [..._hhSelection].slice(0, max).forEach(no => addMember(id, no));

  closeHHFormModal();
  exitHHSelectMode();

  // Cross-module call via window.app — direct import would be circular (render-pokedex ↔ render-households).
  if (window.app?.renderHH) window.app.renderHH();
}


