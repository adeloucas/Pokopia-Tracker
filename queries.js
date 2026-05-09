// js/store/queries.js
// -----------------------------------------------------------------------------
// Read-only queries against the user graph. Render modules and other store code
// import from here rather than calling store.getQuads() directly. This centralizes
// data retrieval logic, maintains layer boundaries, and allows optimization (e.g.,
// single-pass queries for multiple related facts). Mirror of actions.js for writes.
// -----------------------------------------------------------------------------

import { LOCATION_DATA } from "../data/game-data.js";
import { LKEY }          from "../data/lookups.js";
import { NS, pokeUri, hhUri, hhIdFromUri, pokeBySerebiiNo } from "./namespaces.js";
import { getStore, getDF, UG as _UG, rel as _rel, named as _named } from "./store.js";

// ── Internal helpers ─────────────────────────────────────────────────────────

function _serebii(uri) { return decodeURIComponent(uri.replace(NS.poke, "")); }
function _locKey(uri)  { return uri.replace(NS.loc, ""); }
function _locByKey(k)  { return LOCATION_DATA.find(l => l.key === k); }

// ── Pokémon: acquisition + location ──────────────────────────────────────────
// Asks if a Pokémon is acquired, and if so, where it currently is.
export function isAcquired(no) {
  const pu = pokeUri(no);
  if (!pu) return false;
  return getStore().getQuads(_named(pu), _rel("isAcquired"), null, _UG()).length > 0;
}

export function getCurrentLoc(no) {
  const pu = pokeUri(no);
  if (!pu) return null;
  const qs = getStore().getQuads(_named(pu), _rel("currentLoc"), null, _UG());
  if (!qs.length) return null;
  const loc = _locByKey(_locKey(qs[0].object.value));
  return loc ? loc.name : null;
}

// This is a single-pass build for acquisition and location maps.
// When a renderer needs both, it's better to call this once and get both maps
// than iterate twice.
export function queryAllState() {
  const store = getStore();
  const UG    = _UG();
  const acq   = {};
  const locs  = {};

  store.getQuads(null, _rel("isAcquired"), null, UG).forEach(q => {
    const p = pokeBySerebiiNo(_serebii(q.subject.value));
    if (p) acq[p.no] = true;
  });

  store.getQuads(null, _rel("currentLoc"), null, UG).forEach(q => {
    const p   = pokeBySerebiiNo(_serebii(q.subject.value));
    const loc = _locByKey(_locKey(q.object.value));
    if (p && loc) locs[p.no] = loc.name;
  });

  return { acq, locs };
}

// ── Habitat completion ────────────────────────────────────────────────────────
// Takes a habitat object and the acq map from queryAllState. Returns true if 
// the habitat has at least one Pokémon and every one of them appears in acq.
// !!acq[no] converts that key into a boolean.
export function isHabComplete(h, acq) {
  return h.pokemon.length > 0 && h.pokemon.every(no => !!acq[no]);
}

// ── Households ───────────────────────────────────────────────────────────────
// Returns no → { hhId, hhName, hhLoc } for every Pokémon currently in a
// household. Used by the Pokédex grid to show "in HH" tooltips.
export function queryHouseholdMembership() {
  const store = getStore();
  const UG    = _UG();
  const map   = {};

  store.getQuads(null, _rel("member"), null, UG).forEach(q => {
    const hu = q.subject.value;
    const p  = pokeBySerebiiNo(_serebii(q.object.value));
    if (!p) return;
    const nameQ   = store.getQuads(_named(hu), _rel("hhName"), null, UG);
    const locQ    = store.getQuads(_named(hu), _rel("atLoc"),  null, UG);
    const hhName  = nameQ.length ? nameQ[0].object.value : "";
    const locKey  = locQ.length  ? _locKey(locQ[0].object.value) : "";
    const locData = _locByKey(locKey);
    map[p.no] = {
      hhId:   hhIdFromUri(hu),
      hhName,
      hhLoc:  locData ? locData.name : ""
    };
  });
  return map;
}

// A private helper that takes a household URI string and returns assembled 
// household object. Called by both getAllHouseholds and getHouseholdById so 
// neither has to repeat this logic.
function _buildHHObject(hu) {
  const store = getStore();
  const UG    = _UG();
  const get   = pred => {
    const qs = store.getQuads(_named(hu), _rel(pred), null, UG);
    return qs.length ? qs[0].object.value : "";
  };
  const locUriVal = get("atLoc");
  const locData   = LOCATION_DATA.find(l => NS.loc + l.key === locUriVal);
  const memberNos = store.getQuads(_named(hu), _rel("member"), null, UG)
    .map(q => pokeBySerebiiNo(_serebii(q.object.value)))
    .filter(Boolean)
    .map(p => p.no);

  return {
    id:   hhIdFromUri(hu),
    name: get("hhName"),
    type: get("hhType"),
    loc:  locData ? locData.name : "",
    m:    memberNos,
    _uri: hu
  };
}

// Find every quad where predicate is rdf:type and object is Household. 
// For each one, build and return the full household object.
export function getAllHouseholds() {
  const typePred = getDF().namedNode(NS.rdf + "type");
  const hhType   = getDF().namedNode(NS.rel + "Household");
  return getStore().getQuads(null, typePred, hhType, _UG())
                   .map(q => _buildHHObject(q.subject.value));
}

// Takes a bare ID, builds the full URI, checks if any triples exist for it. 
// If they do, build and return the household object. 
// If nothing exists for that URI, return null.
export function getHouseholdById(id) {
  const hu = hhUri(id);
  const qs = getStore().getQuads(_named(hu), null, null, _UG());
  return qs.length ? _buildHHObject(hu) : null;
}

// Set of all `no` values that are currently in some household. Used to 
// check "is this Pokémon in a household?" with set.has(no) rather 
// than scanning the whole membership map.
export function householdedNos() {
  const set = new Set();
  getStore().getQuads(null, _rel("member"), null, _UG()).forEach(q => {
    const p = pokeBySerebiiNo(_serebii(q.object.value));
    if (p) set.add(p.no);
  });
  return set;
}
