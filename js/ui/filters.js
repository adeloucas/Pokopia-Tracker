// js/ui/filters.js
// -----------------------------------------------------------------------------
// Populates filter <select> dropdowns from game-data.js at startup, replacing
// hardcoded options in index.html. Ensures single source for locations,
// specialties, habitats, and household types. Each function targets a specific
// <select> by id, adds a placeholder option first, then data-driven options.
// Run once before first render.
// -----------------------------------------------------------------------------

import { LOCS } from "../data/lookups.js";
import { SPECS, IDEAL_HABS, TYPE_MAX, TYPE_LABEL, TYPE_SLOTS } from "../data/game-data.js";

// The main function.
function _populate(selectId, options, placeholder) {
  const el = document.getElementById(selectId);
  if (!el) return;
  const opts = [`<option value="">${placeholder}</option>`];
  options.forEach(o => {
    if (typeof o === "string") {
      opts.push(`<option value="${o}">${o}</option>`);
    } else {
      opts.push(`<option value="${o.value}">${o.label}</option>`);
    }
  });
  el.innerHTML = opts.join("");
}

// sets filters for all tabs and modals. Called once at startup.
export function populateAllFilterOptions() {
  // Pokédex tab
  _populate("filter-loc",  LOCS,       "All Locations");
  _populate("filter-spec", SPECS,      "All Specialties");
  _populate("filter-hab",  IDEAL_HABS, "All Ideal Habitats");

  // Habitats tab
  _populate("filter-hab-loc",   LOCS,       "All Locations");
  _populate("filter-hab-ideal", IDEAL_HABS, "All Ideal Environments");

  // Households tab — has a special "Unassigned" sentinel
  _populate(
    "filter-hh-loc",
    [{ value: "__none__", label: "Unassigned" }, ...LOCS],
    "All Locations"
  );

  // HH formation modal — type dropdown (default: doubles).
  // Populated here so that game-data.js is the single source for type labels.
  const hhFormType = document.getElementById("hh-form-type");
  if (hhFormType) {
    hhFormType.innerHTML = Object.keys(TYPE_MAX).map(v =>
      `<option value="${v}"${v === "doubles" ? " selected" : ""}>${TYPE_LABEL[v]} · ${TYPE_SLOTS[v]}</option>`
    ).join("");
  }

  // Pokémon detail panel — location selector
  const detailLoc = document.getElementById("detail-loc-select");
  if (detailLoc) detailLoc.innerHTML = `<option value="">— Select Location —</option>` + LOCS.map(l => `<option value="${l}">${l}</option>`).join("");

  // HH formation modal — location dropdown
  const formLoc = document.getElementById("hh-form-loc");
  if (formLoc)  formLoc.innerHTML  = `<option value="">— No Location —</option>` + LOCS.map(l => `<option value="${l}">${l}</option>`).join("");
}
