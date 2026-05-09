// js/ui/ui-constants.js
// -----------------------------------------------------------------------------
// Shared UI constants — named delay values and reusable HTML snippets.
//
// Items 12 + 15: previously scattered setTimeout magic numbers, and
// CREDITS_HTML (which lived in shared-card.js despite being unrelated to
// card-ownership logic), are consolidated here.
//
// Delay rationale:
//   TAB_SWITCH_DELAY (50ms) — minimum time for the tab panel to become
//     visible before a scroll or openDetail call takes effect.
//   FOCUS_DELAY (80ms) — comfortable margin for a newly-rendered input
//     element to be fully in the DOM before calling .focus().
//   DEFERRED_TASK (0ms) — pushes a callback to the next microtask tick,
//     letting the current synchronous render path finish first.
//
// The 30ms outlier in addHouseholdFromUI and the 60ms outlier in
// openDetailFromDash / render-locations chips are intentional exceptions:
//   30ms is intentionally shorter (the form is local, no tab switch needed).
//   60ms is a rounded-up TAB_SWITCH_DELAY used where the extra margin helps
//   on slower devices; documented inline at each callsite.
// -----------------------------------------------------------------------------

export const TAB_SWITCH_DELAY = 50; // wait for tab panel to become visible
export const FOCUS_DELAY      = 80; // wait for rendered input to be in DOM
export const DEFERRED_TASK    =  0; // push to next microtask (no real wait)

// ── Credits footer ────────────────────────────────────────────────────────────
// Imported by render-pokedex, render-habitats, render-households.
export const CREDITS_HTML = `<div class="dash-credits dash-credits-compact"><strong>Pokopia Tracker</strong><br><br>Pokémon data courtesy of <strong><a href="https://www.serebii.net">Serebii.net</a></strong><br>Developed by <strong><a href="https://www.aandeloucas.com">AANDeloucas</a></strong><br>Donations accepted via <strong><a href="https://ko-fi.com/aandeloucas">ko-fi</a>!</strong></div>`;
