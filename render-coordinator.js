// js/ui/render-coordinator.js
// -----------------------------------------------------------------------------
// One place that knows how to redraw the whole app, and one place that knows
// how to redraw "the current tab".
//
// renderAll() is called after state-changing events like import and reset.
// It resets the shared card, switches to the Dashboard, and redraws everything.
// -----------------------------------------------------------------------------

import { renderPokedex, updateReg }  from "./render-pokedex.js";
import { renderHabitats }            from "./render-habitats.js";
import { renderHH }                  from "./render-households.js";
import { renderLoc }                 from "./render-locations.js";
import { renderDashboard }           from "./render-dashboard.js";
import { resetCard }                 from "./shared-card.js";
import { switchTab }                 from "./tabs.js";

/**
 * Redraw every tab and refresh the header counter. Call this whenever the
 * full state may have changed underneath us (reset, import, app boot).
 *
 * Resets the shared detail card and switches back to the Dashboard, matching
 * the behaviour in app.js where reset/import always lands the user on tab 4.
 */
export function renderAll() {
  resetCard();      // clear shared card on full re-render (import/reset)
  switchTab(4);     // revert to Dashboard on reset / import
  renderPokedex();
  renderHabitats();
  renderHH();
  renderLoc();
  renderDashboard();
  updateReg();
}

// Tab index → render function. Keep in sync with the tab order in index.html.
//   0 = Pokédex, 1 = Households, 2 = Locations, 3 = Habitats, 4 = Dashboard
const TAB_RENDERERS = [
  renderPokedex,   // 0
  renderHH,        // 1
  renderLoc,       // 2
  renderHabitats,  // 3
  renderDashboard, // 4
];

export function renderTab(index) {
  const fn = TAB_RENDERERS[index];
  if (fn) fn();
}
