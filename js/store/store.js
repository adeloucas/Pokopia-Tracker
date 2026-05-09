// js/store/store.js
// -----------------------------------------------------------------------------
// N3 triplestore singleton: holds two named graphs.
//
//   game graph — immutable game data, populated once at startup
//   user graph — mutable application state, persisted to localStorage
//
// Other store modules import getStore() / getDF() rather than touching
// these globals directly. Initialization is split from access so render
// modules can't accidentally read from an uninitialized store.
//
// This module doesn't import persistence.js so as to keep the init step 
// separate from the persistence step. This means main.js drives the order, 
// and store/persistence dependency graph stays a tree, rather than a cycle.
// -----------------------------------------------------------------------------

import { buildGameQuads }        from "./graph-builder.js";
import { NS, USER_GRAPH_URI }    from "./namespaces.js";

let _store = null;
let _N3    = null;

// Initializes the store with the game graph (Pokémon, habitats, locations).
// Must be called exactly once at application startup. 
// Idempotent: calling twice is a no-op.
// Afterwards, caller uses persisted user state via persistence.loadUserState
// to complete store setup.
export function initStore(N3) {
  if (_store) return _store;
  _N3    = N3;
  _store = new N3.Store();
  _store.addQuads(buildGameQuads(N3));
  return _store;
}

// Get the live store. Throws if init hasn't run yet.
export function getStore() {
  if (!_store) throw new Error("store not initialized — call initStore(N3) first");
  return _store;
}

// Get N3's DataFactory. Most reads/writes need it.
export function getDF() {
  if (!_N3) throw new Error("store not initialized — call initStore(N3) first");
  return _N3.DataFactory;
}

// ── Shared DataFactory helpers ────────────────────────────────────────────────
// Imported by actions.js and queries.js to avoid duplicating the one-liners.
// Named node for the user graph: the graph argument on every user quad.
export const UG    = () => getDF().namedNode(USER_GRAPH_URI);
// Named node for a relationship predicate, e.g. rel("isAcquired").
export const rel   = pred => getDF().namedNode(NS.rel + pred);
// Named node for an arbitrary URI.
export const named = uri  => getDF().namedNode(uri);
