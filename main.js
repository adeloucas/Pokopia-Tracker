// js/main.js
// -----------------------------------------------------------------------------
// Application entry point. Loaded as a module from index.html. Responsible for:
//
//   1. Initializing the triplestore (game graph + persisted user state)
//   2. Populating filter dropdowns from data
//   3. Assembling `window.app` — the deliberate public API surface used by
//      inline onclick="" handlers in the HTML (and in HTML strings rendered
//      by the various render modules).
//   4. Wiring click-outside handlers for tab panels
//   5. Firing the initial render and logging readiness
// -----------------------------------------------------------------------------

import { POKEMON_DATA, HABITAT_DATA }     from "./data/game-data.js";
import { CANONICAL_COUNT }                from "./data/lookups.js";

import { initStore, getStore, getDF }     from "./store/store.js";
import { GAME_GRAPH_URI, USER_GRAPH_URI } from "./store/namespaces.js";
import { exportState, importState, loadUserState } from "./store/persistence.js";

import { populateAllFilterOptions }       from "./ui/filters.js";
import { renderAll, renderTab }           from "./ui/render-coordinator.js";
import { switchTab }                      from "./ui/tabs.js";
import { showHabPreview, showPokePreview, hidePreview } from "./ui/preview.js";
import {
  openHowToModal, closeHowToModal, switchHowToTab,
  openResetModal, closeResetModal, confirmReset
} from "./ui/modals.js";
import { resetCard }                      from "./ui/shared-card.js";

import * as Pokedex    from "./ui/render-pokedex.js";
import * as Habitats   from "./ui/render-habitats.js";
import * as Households from "./ui/render-households.js";
import * as Locations  from "./ui/render-locations.js";
import * as Dashboard  from "./ui/render-dashboard.js";

// ── Boot ──────────────────────────────────────────────────────────────────────

function boot() {
  if (!window.N3) {
    console.error("pokopia: N3 not loaded. Ensure the N3 CDN script tag runs before main.js");
    return;
  }

  // 1. Initialize the store: game graph first (synchronous), then replay
  //    persisted user quads from localStorage.
  initStore(window.N3);
  loadUserState();

  // 2. Populate every filter <select> from data.
  populateAllFilterOptions();

  // 3. Build the public API surface. Every name here is either:
  //    - referenced by an onclick="" / oninput="" / onchange="" in index.html, OR
  //    - referenced by a dynamically-generated onclick="" inside a render module.
  window.app = {
    // Tabs + global navigation
    switchTab,
    renderTab,
    renderAll,
    resetCard,

    // Preview hover cards
    showHabPreview, showPokePreview, hidePreview,

    // How-to & reset modals
    openHowToModal, closeHowToModal, switchHowToTab,
    openResetModal, closeResetModal, confirmReset,

    // Pokédex tab
    renderPokedex:            Pokedex.renderPokedex,
    filterPokemon:            Pokedex.filterPokemon,
    clearPokeFilters:         Pokedex.clearPokeFilters,
    openDetail:               Pokedex.openDetail,
    closeDetail:              Pokedex.closeDetail,
    navDetail:                Pokedex.navDetail,
    toggleAcqByIdx:           Pokedex.toggleAcqByIdx,
    setLocByNo:               Pokedex.setLocByNo,
    toggleAcquiredFromDetail: Pokedex.toggleAcquiredFromDetail,
    setLocationFromDetail:    Pokedex.setLocationFromDetail,
    goToPokemon:              Pokedex.goToPokemon,
    toggleHHSelectMode:       Pokedex.toggleHHSelectMode,
    exitHHSelectMode:         Pokedex.exitHHSelectMode,
    toggleHHSelect:           Pokedex.toggleHHSelect,
    openHHFormModal:          Pokedex.openHHFormModal,
    closeHHFormModal:         Pokedex.closeHHFormModal,
    updateHHFormWarning:      Pokedex.updateHHFormWarning,
    saveHHFromSelection:      Pokedex.saveHHFromSelection,
    updateReg:                Pokedex.updateReg,
    isDetailJustOpened:       Pokedex.isDetailJustOpened,

    // Habitats tab
    renderHabitats:           Habitats.renderHabitats,
    filterHabitats:           Habitats.filterHabitats,
    clearHabFilters:          Habitats.clearHabFilters,
    openHabDetail:            Habitats.openHabDetail,
    closeHabDetail:           Habitats.closeHabDetail,
    navHabDetail:             Habitats.navHabDetail,
    habCheckRing:             Habitats.habCheckRing,
    habConfirmYes:            Habitats.habConfirmYes,
    habConfirmNo:             Habitats.habConfirmNo,
    goToHabitat:              Habitats.goToHabitat,
    isHabPanelJustOpened:     Habitats.isHabPanelJustOpened,

    // Households tab
    renderHH:                 Households.renderHH,
    hhDelete:                 Households.hhDelete,
    hhSetLoc:                 Households.hhSetLoc,
    hhRemoveMember:           Households.hhRemoveMember,
    addHouseholdFromUI:       Households.addHouseholdFromUI,
    saveNewHH:                Households.saveNewHH,
    cancelNewHH:              Households.cancelNewHH,
    startEditHH:              Households.startEditHH,
    saveEditHH:               Households.saveEditHH,
    cancelEditHH:             Households.cancelEditHH,
    selectHH:                 Households.selectHH,
    setHHSort:                Households.setHHSort,
    openMemberModal:          Households.openMemberModal,
    closeMemberModal:         Households.closeMemberModal,
    filterMemberModal:        Households.filterMemberModal,
    addMemberToHH:            Households.addMemberToHH,
    navHH:                    Households.navHH,

    // Locations tab
    renderLoc:                Locations.renderLoc,
    switchLoc:                Locations.switchLoc,
    switchSpecTab:            Locations.switchSpecTab,

    // Dashboard tab
    renderDashboard:          Dashboard.renderDashboard,
    renderLeftPanel:          Dashboard.renderLeftPanel,
    showChangeName:           Dashboard.showChangeName,
    saveTrainerName:          Dashboard.saveTrainerName,
    openDetailFromDash:       Dashboard.openDetailFromDash,
    // R9: per-row search helpers — called by oninput on dash-poke-search / dash-hab-search
    filterDashPoke:           Dashboard.filterDashPoke,
    filterDashHab:            Dashboard.filterDashHab,

    // Backup / restore
    exportState,
    importState: file => {
      const status = document.getElementById("import-status");
      importState(file, {
        onSuccess: () => {
          if (status) {
            status.textContent = "✓ Restored";
            setTimeout(() => { status.textContent = ""; }, 3000);
          }
          renderAll();
        },
        onError: msg => {
          if (status) {
            status.textContent = "✗ " + msg;
            status.style.color = "#b84040";
            setTimeout(() => {
              status.textContent = "";
              status.style.color = "";
            }, 5000);
          }
        }
      });
    },
  };

  // 4. Click-outside handlers for Pokédex and Habitats tabs.
  document.getElementById("tab-0").addEventListener("click", e => {
    if (!Pokedex.isDetailJustOpened()) return;
    const panel = document.getElementById("shared-detail-card");
    if (panel && panel.contains(e.target)) return;
    if (e.target.closest(".poke-card"))      return;
    if (e.target.closest(".pokedex-header")) return;
    Pokedex.closeDetail();
  });

  // 5. Initial render: Dashboard is the default tab.
  Dashboard.renderDashboard();
  Pokedex.updateReg();

  // 6. Readiness banner.
  const df    = getDF();
  const store = getStore();
  const gameGraph = df.namedNode(GAME_GRAPH_URI);
  const userGraph = df.namedNode(USER_GRAPH_URI);
  console.log(
    `pokopia: store ready. ` +
    `Game quads: ${store.countQuads(null, null, null, gameGraph)}. ` +
    `User quads: ${store.countQuads(null, null, null, userGraph)}. ` +
    `Pokémon: ${POKEMON_DATA.length}. Habitats: ${HABITAT_DATA.length}. ` +
    `Canonical: ${CANONICAL_COUNT}.`
  );
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}

