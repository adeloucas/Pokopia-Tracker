// js/data/lookups.js
// -----------------------------------------------------------------------------
// Constants derived from game-data.js. Computed once at module load and
// imported wherever an O(1) lookup beats searching an array.
// -----------------------------------------------------------------------------

import { LOCATION_DATA, POKEMON_DATA, HABITAT_DATA } from "./game-data.js";

// -----------------------------------------------------------------------------
// Location loopups
// -----------------------------------------------------------------------------

// Ordered list of location names (used for display order in dropdowns).
export const LOCS = LOCATION_DATA.map(l => l.name);

// Lookup maps for name → key, name → color
export const LKEY   = Object.fromEntries(LOCATION_DATA.map(l => [l.name, l.key]));
export const LCOLOR = Object.fromEntries(LOCATION_DATA.map(l => [l.name, l.color]));

// Short two-letter abbreviations for the per-card location badges.
// Derived from the location key, uppercased.
export const LOC_ABBR = Object.fromEntries(
  LOCATION_DATA.map(l => [l.key, l.key.toUpperCase()])
);

// Canonical sort order for households grouped by location.
// Matches order locations in LOCATION_DATA.
export const LOC_ORDER = Object.fromEntries(
  LOCATION_DATA.map((l, i) => [l.name, i])
);

// -----------------------------------------------------------------------------
// Pokémon lookups
// -----------------------------------------------------------------------------  

// Total count of canonical Pokémon used by the registered counter.
export const CANONICAL_COUNT = POKEMON_DATA.filter(p => p.canonical).length;

// no → POKEMON_DATA entry.
export const POKE_BY_NO = Object.fromEntries(
  POKEMON_DATA.map(p => [p.no, p])
);

// -----------------------------------------------------------------------------
// Habitat lookups
// -----------------------------------------------------------------------------  

// no → [habitat 1, habitat 2, and so on]. Used by the Pokédex detail panel and
// household cards.
export const POKE_HABS = (() => {
  const map = {};
  HABITAT_DATA.forEach(h => {
    (h.pokemon || []).forEach(no => {
      if (!map[no]) map[no] = [];
      if (!map[no].includes(h.name)) map[no].push(h.name);
    });
  });
  return map;
})();

// Public Serebii image URLs.
// Pokémon with an empty prefLoc default to Withered Wastelands.
export const SP = p => `https://www.serebii.net/pokemonpokopia/pokemon/small/${p.serebiiNo}.png`;
export const SH = h => `https://www.serebii.net/pokemonpokopia/habitatdex/${parseInt(h.num, 10)}.png`;
export function effectivePrefLoc(p) {
  return p.prefLoc || "Withered Wastelands";
}
