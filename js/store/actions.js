// js/store/actions.js
// -----------------------------------------------------------------------------
// Stores mutations. Each function does a thing, persists it to localSorage,
// and returns a value (true on success, or a domain-specific result).
// Actions never call render functions; UI handler decides this.
// -----------------------------------------------------------------------------

import { TYPE_MAX, HABITAT_DATA } from "../data/game-data.js";
import { LKEY }                   from "../data/lookups.js";
import {
  NS, pokeUri, locUriFromKey, hhUri, newId
} from "./namespaces.js";
import { getStore, getDF, UG as _UG, rel as _rel } from "./store.js";
import { saveState, resetUserState } from "./persistence.js";
import { getHouseholdById } from "./queries.js";

// ── Internal helpers ─────────────────────────────────────────────────────────
// Creates a typed boolean literal.
function _bool(v) {
  const df = getDF();
  return df.literal(v ? "true" : "false", df.namedNode(NS.xsd + "boolean"));
}

// Replace all triples matching (subject, predicate, *) with a single triple.
// Enforces that a subject can only have one value for a given predicate.
// Used by every "set X" action.
function _setSingle(subject, predicate, object) {
  const store = getStore();
  const UG    = _UG();
  const df    = getDF();
  store.removeQuads(store.getQuads(subject, predicate, null, UG));
  if (object !== null && object !== undefined) {
    store.addQuad(df.quad(subject, predicate, object, UG));
  }
}

// ── Reset ────────────────────────────────────────────────────────────────────
// Layer boundary: UI modules import from actions, not from persistence directly.
// This wrapper keeps modals.js out of the persistence dependency.
export function performReset() {
  resetUserState();
}

// ── Trainer name ─────────────────────────────────────────────────────────────
// Trainer metadata is stored as a quad in user graph under "app" node.
// This groups app-level settings (like trainer name) in one location to ensure
// they persist through export/import/reset. 
// Subject: app metadata node; predicate: rel:trainerName.
const TRAINER_SUBJECT_URI = "http://pokopia.local/app/meta";

export function getTrainerName() {
  const df    = getDF();
  const store = getStore();
  const q = store.getQuads(df.namedNode(TRAINER_SUBJECT_URI), _rel("trainerName"), null, _UG());
  return q.length ? q[0].object.value : "";
}

export function setTrainerName(name) {
  const df = getDF();
  const s  = df.namedNode(TRAINER_SUBJECT_URI);
  _setSingle(s, _rel("trainerName"), name ? df.literal(name) : null);
  saveState();
}

// ── Pokémon acquisition ──────────────────────────────────────────────────────
// Takes a dex number, builds its URI, bails if it doesn't exist. 
// Sets up the subject node and the predicate node for isAcquired.
export function toggleAcquired(no) {
  const pu = pokeUri(no);
  if (!pu) return false;
  const df    = getDF();
  const store = getStore();
  const UG    = _UG();
  const s     = df.namedNode(pu);
  const acq   = _rel("isAcquired");

  if (store.getQuads(s, acq, null, UG).length) {
    store.removeQuads(store.getQuads(s, acq, null, UG));
    // Clear current location too — un-acquired Pokémon can't have a location.
    store.removeQuads(store.getQuads(s, _rel("currentLoc"), null, UG));
  } else {
    store.addQuad(df.quad(s, acq, _bool(true), UG));
  }
  saveState();
  return true;
}
// sets acquired to true or false rather than flipping the current state. 
// Used when you want to set a known target state rather than just flip.
export function setAcquired(no, isAcq) {
  const pu = pokeUri(no);
  if (!pu) return false;
  _setSingle(getDF().namedNode(pu), _rel("isAcquired"), isAcq ? _bool(true) : null);
  saveState();
  return true;
}

// ── Pokémon location assignment ──────────────────────────────────────────────
// Takes a dex number and a location name string like "Palette Town". 
// LKEY["Palette Town"] gives us "pt"; locUriFromKey("pt") gives us the URI. 
// That becomes the object node, or null if no location name was passed.
export function setLocation(no, locName) {
  const pu = pokeUri(no);
  if (!pu) return false;
  const obj = locName
    ? getDF().namedNode(locUriFromKey(LKEY[locName]))
    : null;
  _setSingle(getDF().namedNode(pu), _rel("currentLoc"), obj);
  saveState();
  return true;
}

// ── Habitat completion ───────────────────────────────────────────────────────
// Bulk-acquire every Pokémon in a habitat. Returns the list of `no`s that
// were not already acquired (so the caller can decide what to highlight).
export function markHabitatComplete(habIdx) {
  const h = HABITAT_DATA[habIdx];
  if (!h) return [];
  const df    = getDF();
  const store = getStore();
  const UG    = _UG();
  const acq   = _rel("isAcquired");
  const newly = [];

  h.pokemon.forEach(no => {
    const pu = pokeUri(no);
    if (!pu) return;
    const s = df.namedNode(pu);
    if (!store.getQuads(s, acq, null, UG).length) {
      store.addQuad(df.quad(s, acq, _bool(true), UG));
      newly.push(no);
    }
  });
  saveState();
  return newly;
}

// ── Households ───────────────────────────────────────────────────────────────
// Generate a fresh ID, build the household URI node from it.
export function addHousehold(name, type) {
  const id = newId();
  const df = getDF();
  const hu = df.namedNode(hhUri(id));
  const UG = _UG();

  getStore().addQuads([
    df.quad(hu, df.namedNode(NS.rdf + "type"), df.namedNode(NS.rel + "Household"), UG),
    df.quad(hu, _rel("hhName"), df.literal((name || "").trim() || "Unnamed"), UG),
    df.quad(hu, _rel("hhType"), df.literal(type || "block"), UG),
  ]);
  saveState();
  return id;
}

// Remove every quad where this household is the subject.
export function removeHousehold(id) {
  const hu = getDF().namedNode(hhUri(id));
  getStore().removeQuads(getStore().getQuads(hu, null, null, _UG()));
  saveState();
  return true;
}

// Uses _setSingle to replace hhName triple with the new value. 
export function renameHousehold(id, name) {
  const df = getDF();
  _setSingle(
    df.namedNode(hhUri(id)),
    _rel("hhName"),
    df.literal((name || "").trim() || "Unnamed")
  );
  saveState();
  return true;
}

// Convert the location name to a URI node, or null to clear. 
// Uses _setSingle to replace any existing location assignment.
export function setHouseholdLoc(id, locName) {
  const obj = locName
    ? getDF().namedNode(locUriFromKey(LKEY[locName]))
    : null;
  _setSingle(getDF().namedNode(hhUri(id)), _rel("atLoc"), obj);
  saveState();
  return true;
}

// Update the type triple first.
export function setHouseholdType(id, type) {
  const df    = getDF();
  const store = getStore();
  const UG    = _UG();
  const hu    = df.namedNode(hhUri(id));

  _setSingle(hu, _rel("hhType"), df.literal(type));

  // Trim members to fit the new max member count for this type.
  const max = TYPE_MAX[type] ?? 4;
  const hh  = getHouseholdById(id);
  if (hh && hh.m.length > max) {
    store.removeQuads(store.getQuads(hu, _rel("member"), null, UG));
    hh.m.slice(0, max).forEach(no => {
      const pu = pokeUri(no);
      if (pu) store.addQuad(df.quad(hu, _rel("member"), df.namedNode(pu), UG));
    });
  }
  saveState();
  return true;
}

// Four guard clauses before doing anything: 1) household must exist, 
// 2) household must not be full, 3) Pokémon must not already be a member, 
// 4) The dex number must resolve to a real URI. If any fail, return false.
export function addMember(id, no) {
  const hh = getHouseholdById(id);
  if (!hh) return false;
  const max = TYPE_MAX[hh.type] ?? 4;
  if (hh.m.length >= max) return false;
  if (hh.m.includes(no))  return false;
  const pu = pokeUri(no);
  if (!pu) return false;

// Add a member triple connecting the household to the Pokémon. Save.
  const df = getDF();
  getStore().addQuad(df.quad(
    df.namedNode(hhUri(id)),
    _rel("member"),
    df.namedNode(pu),
    _UG()
  ));
  saveState();
  return true;
}

// The reverse. Build the household and Pokémon URIs and remove 
// the specific triple that connects them.
export function removeMember(id, no) {
  const pu = pokeUri(no);
  if (!pu) return false;
  const df = getDF();
  const hu = df.namedNode(hhUri(id));
  getStore().removeQuads(
    getStore().getQuads(hu, _rel("member"), df.namedNode(pu), _UG())
  );
  saveState();
  return true;
}
