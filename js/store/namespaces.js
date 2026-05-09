// js/store/namespaces.js
// -----------------------------------------------------------------------------
// Centralizes all RDF namespaces, URI builders, and reverse lookups; URI scheme 
// definitions and ID generation. Both writes (actions, graph builder) and reads
// (queries) depend on these helpers for entity identification.
// -----------------------------------------------------------------------------

import { POKEMON_DATA } from "../data/game-data.js";

export const NS = {
  poke: "http://pokopia.local/pokemon/",
  hab:  "http://pokopia.local/habitat/",
  hh:   "http://pokopia.local/household/",
  loc:  "http://pokopia.local/location/",
  spec: "http://pokopia.local/spec/",
  rel:  "http://pokopia.local/rel/",
  rdf:  "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  xsd:  "http://www.w3.org/2001/XMLSchema#",
};

export const GAME_GRAPH_URI = "http://pokopia.local/game";
export const USER_GRAPH_URI = "http://pokopia.local/user";

// localStorage key for persisted user state.
export const STATE_KEY = "pokopia_tracker_state";

// ── URI builders ─────────────────────────────────────────────────────────────
// Canonical-first lookup helper: prefers canonical entry for a Pokémon,
// falls back to any match if no canonical one exists.
function _findEntry(pred) {
  return POKEMON_DATA.find(x => pred(x) && x.canonical)
      || POKEMON_DATA.find(x => pred(x));
}

// Pokemon URI builder
export function pokeUri(no) {
  const p = _findEntry(x => x.no === no);
  return p ? (NS.poke + encodeURIComponent(p.serebiiNo)) : null;
}

// Reverse of pokeUri(): given a Serebii image ID, recover the full Pokémon object.
// Used by queries to deserialize RDF URIs (which contain serebiiNo) back into data.
// Prefers canonical entries, falls back to any match.
export function pokeBySerebiiNo(serebiiNo) {
  return _findEntry(x => x.serebiiNo === serebiiNo);
}

// Household URI builder.
export function hhUri(id) {
  return NS.hh + id;
}

// Reverse of hhUri(): strips the prefix to recover bare household id.
export function hhIdFromUri(uri) {
  return uri.replace(NS.hh, "");
}

// Takes LKEY (looked up by location name) so module doesn't
// need to import lookups.js. Callers pass the key directly.
export function locUriFromKey(key) {
  return key ? (NS.loc + key) : null;
}

// ── ID generation ────────────────────────────────────────────────────────────
// Used for new household IDs. Falls back to a timestamp + counter when
// crypto.randomUUID isn't available (old browsers). Replaces the bare
// Date.now() approach which collides if two HHs are made at the same time. 

let _idCounter = 0;
export function newId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${(++_idCounter).toString(36)}`;
}
