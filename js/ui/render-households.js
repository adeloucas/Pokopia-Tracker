// js/ui/render-households.js
// -----------------------------------------------------------------------------
// Households tab — household grid, sort buttons, shared-card detail panel,
// inline name/type editing, member-pick modal, and "Add Household" form.
// -----------------------------------------------------------------------------

import { POKEMON_DATA, HABITAT_DATA, TYPE_MAX, TYPE_LABEL, TYPE_SLOTS } from "../data/game-data.js";
import {
  POKE_BY_NO, POKE_HABS,
  LKEY, LOCS, LOC_ORDER,
  effectivePrefLoc,
  SP
} from "../data/lookups.js";

import {
  queryAllState, getAllHouseholds, getHouseholdById, householdedNos
} from "../store/queries.js";
import {
  addHousehold, removeHousehold, renameHousehold,
  setHouseholdLoc, setHouseholdType,
  addMember, removeMember
} from "../store/actions.js";

import { claimCard, resetCard } from "./shared-card.js";
import { CREDITS_HTML, FOCUS_DELAY } from "./ui-constants.js";
import { switchTab } from "./tabs.js";

// ── Module state ─────────────────────────────────────────────────────────────

let _hhSort       = "az";
let _modalHhId    = null;
let _selectedHhId = null;
let _editingHhId  = null;
let _visibleHhIds = []; // ordered list of visible HH ids for nav

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Builds <option> elements for the household type <select>.
 * Derived from TYPE_LABEL and TYPE_SLOTS in game-data.js — single source of truth.
 * @param {string} selected - the currently selected type value, or "" for none
 */
function _typeOptions(selected = "") {
  return Object.keys(TYPE_MAX).map(value =>
    `<option value="${value}"${value === selected ? " selected" : ""}>${TYPE_LABEL[value]} · ${TYPE_SLOTS[value]}</option>`
  ).join("");
}

// ── Public render ────────────────────────────────────────────────────────────

export function renderHH() {
  const grid = document.getElementById("hh-grid");
  if (!grid) return;
  const locF = document.getElementById("filter-hh-loc")?.value || "";
  const q    = (document.getElementById("hh-search")?.value || "").toLowerCase().trim();
  const { locs } = queryAllState();
  const all = getAllHouseholds(); // single call — reused below for total count

  let filtered = all.filter(hh => {
    if (locF === "__none__" && hh.loc)                  return false;
    if (locF && locF !== "__none__" && hh.loc !== locF) return false;
    if (q) {
      const match = (hh.m || []).some(no => {
        const p = POKE_BY_NO[no];
        return p && p.name.toLowerCase().includes(q);
      });
      if (!match) return false;
    }
    return true;
  });

  if (_hhSort === "az")      filtered.sort((a, b) => a.name.localeCompare(b.name));
  else if (_hhSort === "za") filtered.sort((a, b) => b.name.localeCompare(a.name));
  else if (_hhSort === "loc") filtered.sort((a, b) => {
    const ai = a.loc in LOC_ORDER ? LOC_ORDER[a.loc] : 99;
    const bi = b.loc in LOC_ORDER ? LOC_ORDER[b.loc] : 99;
    return ai !== bi ? ai - bi : a.name.localeCompare(b.name);
  });

  if (!filtered.length) {
    const total = all.length;
    grid.innerHTML = `<p style="color:var(--muted);font-size:13px;grid-column:1/-1;text-align:center;padding:30px 0;">${
      total ? "No households match this filter." : "No households yet. Add one above!"
    }</p>`;
    return;
  }

  _visibleHhIds = filtered.map(hh => hh.id);

  grid.innerHTML = filtered.map(hh => {
    const mem   = hh.m || [];
    const max   = TYPE_MAX[hh.type] || 4;
    const locAttr    = hh.loc ? `data-loc="${hh.loc}"` : "";
    const isSelected = _selectedHhId === hh.id ? " selected-card" : "";

    // Mini member slots for the grid card
    const miniSlots = [];
    for (let i = 0; i < Math.min(max, 4); i++) {
      if (i < mem.length) {
        const p = POKE_BY_NO[mem[i]];
        miniSlots.push(`<div class="hh-slot-mini">${p ? `<img src="${SP(p)}" onerror="this.style.display='none'">` : ""}</div>`);
      } else {
        miniSlots.push(`<div class="hh-slot-mini ghost"></div>`);
      }
    }

    return `<div class="hh-card${isSelected}" ${locAttr} onclick="app.selectHH('${hh.id}')">
      <div class="hh-card-top">
        <div class="hh-card-name">${hh.name}</div>
        <div class="hh-card-badge">${TYPE_LABEL[hh.type]} · ${mem.length}/${max} members${hh.loc ? " · " + hh.loc : ""}</div>
      </div>
      <div class="hh-card-slots">${miniSlots.join("")}</div>
    </div>`;
  }).join("");

  // Refresh the detail panel if one is selected — pass the already-fetched object when available
  if (_selectedHhId) {
    claimCard(1);
    const preloaded = filtered.find(h => h.id === _selectedHhId) || null;
    _renderHHDetailCard(_selectedHhId, preloaded);
  }
}

// ── Detail card ──────────────────────────────────────────────────────────────

function _renderHHDetailCard(id, hhData = null) {
  const cardEl = document.getElementById("shared-detail-card");
  if (!cardEl) return;
  // R8: accept pre-fetched hhData to skip a redundant store lookup when the caller already has it
  const hh = hhData ?? getHouseholdById(id);
  if (!hh) { cardEl.innerHTML = _emptyCard(); return; }

  const { locs } = queryAllState();
  const mem       = hh.m || [];
  const max       = TYPE_MAX[hh.type] || 4;
  const isEditing = _editingHhId === id;

  // Member slots
  const gridClass = hh.type === "singles" ? "hh-member-grid singles" : "hh-member-grid";
  let slots = "";
  for (let i = 0; i < max; i++) {
    if (i < mem.length) {
      const no = mem[i];
      const p  = POKE_BY_NO[no];
      if (!p) continue;
      const slotLoc  = locs[no];
      const slotLc   = slotLoc && LKEY[slotLoc] ? " loc-" + LKEY[slotLoc] : "";
      const slotTip  = slotLoc ? `${p.name} (${slotLoc})` : `${p.name}`;
      const prefMatch = hh.loc && effectivePrefLoc(p) === hh.loc;
      slots += `<div class="member-slot filled${slotLc}" onclick="app.goToPokemon('${no}')" style="cursor:pointer;">
        <img src="${SP(p)}" onerror="this.style.display='none'">
        <div class="slot-name">${slotTip}</div>
        ${prefMatch ? `<div class="slot-pref-badge">★</div>` : ""}
        <div class="slot-remove" onclick="event.stopPropagation();app.hhRemoveMember('${hh.id}','${no}')">✕</div>
      </div>`;
    } else if (i === mem.length) {
      slots += `<div class="member-slot add-slot" onclick="app.openMemberModal('${hh.id}')"><span class="plus-icon">+</span></div>`;
    } else {
      slots += `<div class="member-slot ghost"></div>`;
    }
  }

  // Collect specialties, ideal habs, and associated habitats from all members
  const specMap = {};
  const habSet  = new Set();
  const idealSet = new Set();
  mem.forEach(no => {
    const p = POKE_BY_NO[no]; if (!p) return;
    (POKE_HABS[no] || []).forEach(h => habSet.add(h));
    if (p.idealHab) idealSet.add(p.idealHab);
    (p.specs || []).forEach(sp => {
      if (!specMap[sp]) specMap[sp] = [];
      specMap[sp].push(p.name);
    });
  });

  const specsHtml = Object.keys(specMap).length
    ? Object.entries(specMap).map(([sp, names]) =>
        `<span class="spec-tag" title="${names.join(', ')}">${sp}</span>`
      ).join("")
    : '<span style="font-size:11px;color:var(--muted);">No specialties</span>';

  const habTagsHtml = habSet.size ? [...habSet].map(h => {
    const hi = HABITAT_DATA.findIndex(x => x.name === h);
    return hi >= 0
      ? `<span class="hh-hab-tag" style="cursor:pointer;" onclick="app.goToHabitat(${hi})">${h}</span>`
      : `<span class="hh-hab-tag">${h}</span>`;
  }).join("") : "";

  const locOptions  = LOCS.map(l => `<option value="${l}"${hh.loc === l ? " selected" : ""}>${l}</option>`).join("");
  const typeOptions = _typeOptions(hh.type);

  const vi      = _visibleHhIds.indexOf(id);
  const prevDis = vi <= 0                                  ? "disabled" : "";
  const nextDis = vi < 0 || vi >= _visibleHhIds.length - 1 ? "disabled" : "";

  cardEl.innerHTML = `
    <div class="hh-detail-header">
      ${isEditing
        ? `<input class="hh-detail-edit-input" id="hh-edit-name-inp" value="${hh.name.replace(/"/g, "&quot;")}" onkeydown="if(event.key==='Enter')app.saveEditHH('${id}');if(event.key==='Escape')app.cancelEditHH()">`
        : `<div class="hh-detail-title">${hh.name}</div>`}
      ${!isEditing ? `<button class="btn-edit-hh" onclick="app.startEditHH('${id}')" title="Edit">✎</button>` : ""}
      <button class="btn-delete-hh" onclick="app.hhDelete('${id}')" title="Delete">🗑</button>
    </div>
    <div class="hh-detail-body">
      <div class="hh-detail-row">
        <div class="hh-detail-label">Type</div>
        <div class="hh-detail-val">
          ${isEditing
            ? `<select class="hh-loc-select" id="hh-edit-type-inp">${typeOptions}</select>`
            : `${TYPE_LABEL[hh.type]} · ${TYPE_SLOTS[hh.type]}`}
        </div>
      </div>
      <div class="hh-detail-row">
        <div class="hh-detail-label">Location</div>
        <div class="hh-detail-val">
          <select class="hh-loc-select" onchange="app.hhSetLoc('${hh.id}',this.value)">
            <option value="">— No Location —</option>
            ${locOptions}
          </select>
        </div>
      </div>
      <div class="hh-detail-members">
        <div class="hh-detail-members-label">Members (${mem.length}/${max})</div>
        <div class="${gridClass}">${slots}</div>
      </div>
      <div class="hh-detail-row" style="flex-direction:column;align-items:flex-start;gap:4px;">
        <div class="hh-detail-label">Specialties</div>
        <div style="display:flex;flex-wrap:wrap;gap:3px;padding-top:2px;">${specsHtml}</div>
      </div>
      ${habTagsHtml
        ? `<div class="hh-hab-tags-detail">${habTagsHtml}${idealSet.size
            ? `<div style="font-size:9px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin-top:4px;width:100%;">Ideal: ${[...idealSet].join(" · ")}</div>`
            : ""}</div>`
        : ""}
    </div>
    ${isEditing ? `<div class="hh-detail-actions">
      <button class="btn-save-hh" onclick="app.saveEditHH('${id}')">Save</button>
      <button class="btn-cancel-hh" onclick="app.cancelEditHH()">Cancel</button>
    </div>` : ""}
    ${CREDITS_HTML}
    <div style="display:flex;gap:6px;padding:8px 12px;border-top:1px solid var(--border);">
      <button ${prevDis} onclick="app.navHH(-1)" style="flex:1;font-family:inherit;font-size:12px;padding:5px;border-radius:8px;border:1px solid var(--border);background:var(--panel2);cursor:pointer;">← Prev</button>
      <button ${nextDis} onclick="app.navHH(1)"  style="flex:1;font-family:inherit;font-size:12px;padding:5px;border-radius:8px;border:1px solid var(--border);background:var(--panel2);cursor:pointer;">Next →</button>
    </div>`;

  if (isEditing) {
    setTimeout(() => {
      const inp = document.getElementById("hh-edit-name-inp");
      if (inp) { inp.focus(); inp.select(); }
    }, FOCUS_DELAY); // slightly more than TAB_SWITCH_DELAY — card re-render needs to settle
  }
}

function _emptyCard() {
  return `<div class="detail-card-empty"><div class="empty-icon">🏠</div><p>Select a household to view and edit it here.</p></div>`;
}

// ── Public select / edit ─────────────────────────────────────────────────────

export function selectHH(id) {
  _selectedHhId = id;
  _editingHhId  = null;
  document.querySelectorAll(".hh-card").forEach(c => c.classList.remove("selected-card"));
  const card = document.querySelector(`.hh-card[onclick*="${id}"]`);
  if (card) card.classList.add("selected-card");
  claimCard(1); // Households tab owns the card
  _renderHHDetailCard(id);
}

export function navHH(dir) {
  const vi = _visibleHhIds.indexOf(_selectedHhId);
  if (vi < 0) return;
  const ni = vi + dir;
  if (ni < 0 || ni >= _visibleHhIds.length) return;
  selectHH(_visibleHhIds[ni]);
}

export function startEditHH(id) {
  _editingHhId = id;
  _renderHHDetailCard(id);
}

export function cancelEditHH() {
  _editingHhId = null;
  if (_selectedHhId) _renderHHDetailCard(_selectedHhId);
}

export function saveEditHH(id) {
  const nameInp = document.getElementById("hh-edit-name-inp");
  const typeInp = document.getElementById("hh-edit-type-inp");
  if (nameInp && nameInp.value.trim()) renameHousehold(id, nameInp.value.trim());
  if (typeInp) setHouseholdType(id, typeInp.value);
  _editingHhId = null;
  renderHH();
}

export function hhDelete(id) {
  removeHousehold(id);
  if (_selectedHhId === id) {
    _selectedHhId = null;
    _editingHhId  = null;
    const el = document.getElementById("shared-detail-card");
    if (el) el.innerHTML = _emptyCard();
  }
  renderHH();
}

export function hhSetLoc(id, loc)      { setHouseholdLoc(id, loc); renderHH(); }
export function hhRemoveMember(id, no) { removeMember(id, no); _renderHHDetailCard(id); renderHH(); }

// ── Add household — opens "new household" form in the shared card ─────────────

export function addHouseholdFromUI() {
  claimCard(1);
  const cardEl = document.getElementById("shared-detail-card");
  if (!cardEl) return;
  cardEl.innerHTML = _renderNewHHForm();
  setTimeout(() => {
    const inp = document.getElementById("new-hh-name-inp");
    if (inp) {
      inp.focus();
      inp.addEventListener("keydown", e => { if (e.key === "Enter") app.saveNewHH(); });
    }
  }, 30); // intentionally shorter than FOCUS_DELAY — no tab switch, form is local
}

export function saveNewHH() {
  const nameInp = document.getElementById("new-hh-name-inp");
  const typeInp = document.getElementById("new-hh-type-inp");
  const locInp  = document.getElementById("new-hh-loc-inp");
  const name    = nameInp ? nameInp.value.trim() : "";
  if (!name) {
    if (nameInp) { nameInp.style.borderColor = "var(--accent)"; nameInp.focus(); }
    return;
  }
  const type = typeInp ? typeInp.value : "block";
  const loc  = locInp  ? locInp.value  : "";
  const id   = addHousehold(name, type);
  if (loc) setHouseholdLoc(id, loc);
  renderHH();
  selectHH(id);
}

export function cancelNewHH() {
  // Item 11 (Option B): drop the household-specific empty state — generic pokéball is enough.
  // _emptyCard() is still used by hhDelete; do not remove it.
  resetCard();
}

function _renderNewHHForm() {
  const locOptions = LOCS.map(l => `<option value="${l}">${l}</option>`).join("");
  return `
    <div class="hh-detail-header">
      <div class="hh-detail-title" style="font-size:14px;">New Household</div>
    </div>
    <div class="hh-detail-body" style="padding:14px;display:flex;flex-direction:column;gap:10px;overflow-y:auto;">
      <div>
        <div class="hh-detail-label" style="margin-bottom:5px;">Name</div>
        <input class="hh-detail-edit-input"
          id="new-hh-name-inp" type="text" placeholder="Household name..."
          style="width:100%;border:1.5px solid var(--border);border-radius:8px;padding:7px 10px;font-size:13px;outline:none;font-family:'Nunito Sans',sans-serif;">
      </div>
      <div>
        <div class="hh-detail-label" style="margin-bottom:5px;">Type</div>
        <select class="hh-loc-select" id="new-hh-type-inp">
          ${_typeOptions("block")}
        </select>
      </div>
      <div>
        <div class="hh-detail-label" style="margin-bottom:5px;">Location (optional)</div>
        <select class="hh-loc-select" id="new-hh-loc-inp">
          <option value="">— No Location —</option>
          ${locOptions}
        </select>
      </div>
    </div>
    <div class="hh-detail-actions">
      <button class="btn-save-hh" onclick="app.saveNewHH()">+ Create Household</button>
      <button class="btn-cancel-hh" onclick="app.cancelNewHH()">Cancel</button>
    </div>`;
}

// ── Sort ─────────────────────────────────────────────────────────────────────

export function setHHSort(mode) {
  _hhSort = mode;
  ["az", "za", "loc"].forEach(m => {
    const btn = document.getElementById("hh-sort-" + m);
    if (btn) btn.classList.toggle("active", m === mode);
  });
  renderHH();
}

// ── Member-pick modal ────────────────────────────────────────────────────────

export function openMemberModal(hhId) {
  _modalHhId = hhId;
  const modal = document.getElementById("poke-modal");
  if (modal) modal.style.display = "flex";
  const s = document.getElementById("modal-search");
  if (s) s.value = "";
  filterMemberModal();
  setTimeout(() => { const s = document.getElementById("modal-search"); if (s) s.focus(); }, FOCUS_DELAY);
}

export function closeMemberModal() {
  const modal = document.getElementById("poke-modal");
  if (modal) modal.style.display = "none";
  _modalHhId = null;
}

export function filterMemberModal() {
  const q      = document.getElementById("modal-search")?.value.toLowerCase() || "";
  const locked = householdedNos();
  const { acq } = queryAllState();
  const avail  = POKEMON_DATA.filter(p => acq[p.no] && !locked.has(p.no));
  const hits   = q ? avail.filter(p => p.name.toLowerCase().includes(q)) : avail;
  const res    = document.getElementById("modal-results");
  if (!res) return;
  if (!hits.length) {
    res.innerHTML = `<div class="modal-empty">${q ? "No matches" : "No acquired Pokémon available"}</div>`;
    return;
  }
  const hh    = _modalHhId ? getHouseholdById(_modalHhId) : null;
  const hhLoc = hh ? hh.loc : "";
  res.innerHTML = hits.slice(0, 40).map(p => {
    const prefMatch = hhLoc && effectivePrefLoc(p) === hhLoc;
    return `<div class="modal-result" onclick="app.addMemberToHH('${p.no}')">
      <img src="${SP(p)}" onerror="this.style.display='none'"><span>${p.name}</span>
      ${prefMatch ? `<span class="modal-pref-match">★ local</span>` : ""}
    </div>`;
  }).join("");
}

export function addMemberToHH(no) {
  if (!_modalHhId) return;
  addMember(_modalHhId, no);
  closeMemberModal();
  _renderHHDetailCard(_modalHhId);
  renderHH();
}


