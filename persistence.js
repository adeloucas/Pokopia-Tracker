// js/store/persistence.js
// -----------------------------------------------------------------------------
// localStorage save/load and JSON export/import. Handles quad serialization, 
// backup creation, and version-aware restoration. This module is the only 
// part of the store layer that touches localStorage or the file system.
//
// Layer rule: persistence functions never call render functions. Callers 
// (main.js, ui handlers) are responsible for triggering re-render after 
// importState() resolves — that is what `onSuccess` is for. This prevents the
//  cross-layer violation where importState reaches directly into render layer.
// -----------------------------------------------------------------------------

import { NS, USER_GRAPH_URI, STATE_KEY } from "./namespaces.js";
import { getStore, getDF } from "./store.js";

// ── Internal serialization helpers ───────────────────────────────────────────
// Serializes quads to a JSON-friendly format.
function _serializeQuads(quads) {
  return quads.map(q => ({
    s: q.subject.value,
    p: q.predicate.value,
    o: q.object.termType === "Literal"
        ? { v: q.object.value, dt: q.object.datatype?.value }
        : { n: q.object.value }
  }));
}

// Takes an array of plain objects and puts them into the live store as quads.
function _deserializeUserQuads(serialized) {
  const df = getDF();
  const UG = df.namedNode(USER_GRAPH_URI);
  getStore().addQuads(serialized.map(item => {
    const s = df.namedNode(item.s);
    const p = df.namedNode(item.p);
    const o = item.o.n
      ? df.namedNode(item.o.n)
      : (item.o.dt ? df.literal(item.o.v, df.namedNode(item.o.dt))
                   : df.literal(item.o.v));
    return df.quad(s, p, o, UG);
  }));
}

// Fetches every quad in the user graph.
function _userQuads() {
  const df = getDF();
  return getStore().getQuads(null, null, null, df.namedNode(USER_GRAPH_URI));
}

// ── Save / Load (localStorage) ───────────────────────────────────────────────
// called after every mutation. It gets all user quads, serializes them to 
// plain objects, turns that into a JSON string, and saves it 
// to localStorage under STATE_KEY.
export function saveState() {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(_serializeQuads(_userQuads())));
  } catch (e) {
    console.warn("pokopia: saveState failed", e);
  }
}

// Called once at startup. Reads the JSON string back out of localStorage. 
// If there's nothing there (first ever run, or after a reset), bail.
export function loadUserState() {
  const saved = localStorage.getItem(STATE_KEY);
  if (!saved) return;
  try {
    _deserializeUserQuads(JSON.parse(saved));
  } catch (e) {
    console.warn("pokopia: failed to load saved state", e);
  }
}

// ── Reset ────────────────────────────────────────────────────────────────────
// Wipe all user quads from the store, then delete the localStorage entry. 
export function resetUserState() {
  const df    = getDF();
  const store = getStore();
  store.removeQuads(store.getQuads(null, null, null, df.namedNode(USER_GRAPH_URI)));
  localStorage.removeItem(STATE_KEY);
}

// ── Export (JSON download) ───────────────────────────────────────────────────
// Builds the export object.
export function exportState() {
  const payload = {
    version:  "sparql_v1",
    exported: new Date().toISOString(),
    quads:    _serializeQuads(_userQuads())
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  const ts   = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  a.href     = url;
  a.download = `pokopia-backup-${ts}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Import (JSON upload) ─────────────────────────────────────────────────────
// Asynchronously reads and imports a JSON backup file. Validates the file 
// format and version before replacing user state. Calls `onSuccess` after 
// the store is updated and saved, or `onError` with a message if validation 
// or parsing fails. Caller is responsible for re-rendering — this module 
// deliberately does not import render functions.
export function importState(file, { onSuccess, onError } = {}) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const payload  = JSON.parse(e.target.result);
      const rawQuads = payload.quads || payload;

      // Validate shape before touching the store. A valid backup is either:
      //   { version: "sparql_v1", quads: [...] }   (current export format)
      //   [...]                                      (legacy bare-array format)
      if (!Array.isArray(rawQuads)) {
        onError?.("Invalid backup file: expected a quads array.");
        return;
      }
      if (payload.version && payload.version !== "sparql_v1") {
        onError?.(`Unrecognised backup version "${payload.version}". This file may be from an incompatible version.`);
        return;
      }

      const df    = getDF();
      const store = getStore();
      const UG    = df.namedNode(USER_GRAPH_URI);
      // Wipe existing user state, then replay the imported quads.
      store.removeQuads(store.getQuads(null, null, null, UG));
      _deserializeUserQuads(rawQuads);
      saveState();
      onSuccess?.();
    } catch (err) {
      console.error("pokopia: importState failed", err);
      onError?.("Could not read file. Is this a valid Pokopia backup?");
    }
  };
  reader.onerror = () => onError?.("Could not read file.");
  reader.readAsText(file);
}
