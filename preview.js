// js/ui/preview.js
// -----------------------------------------------------------------------------
// This module is read-only: looks up data and renders it as a floating element.
// Floating hover-preview card for habitat tags and Pokémon chips.
// POKE_BY_NO for Pokémon lookups, SP/SH for sprite URLs, 
// HABITAT_DATA for habitat lookups by index.
// Shows information then hides shortly after mouse leave.
// -----------------------------------------------------------------------------

import { POKE_BY_NO, SP, SH } from "../data/lookups.js";
import { HABITAT_DATA } from "../data/game-data.js";

let _previewEl    = null;
let _previewTimer = null;

// If the element already exists, return it immediately. 
// Otherwise create it, give it its CSS class, append it to <body> 
// (so it sits above all other content in the stacking context), store it, 
// and return it. After first hover, subsequent call hits the if and returns.
function _ensure() {
  if (_previewEl) return _previewEl;
  _previewEl = document.createElement("div");
  _previewEl.className = "tag-preview";
  document.body.appendChild(_previewEl);
  return _previewEl;
}
// Positions the preview card relative to the mouse. 
// The default is 12px to the right of the cursor, vertically centered on it.
function _position(e, el) {
  const pw = 220, ph = 120;
  let x = e.clientX + 12;
  let y = e.clientY - ph / 2;
  if (x + pw > window.innerWidth)  x = e.clientX - pw - 12;
  if (y < 4)                       y = 4;
  if (y + ph > window.innerHeight) y = window.innerHeight - ph - 4;
  el.style.left = x + "px";
  el.style.top  = y + "px";
}

// Shows a habitat preview. 
export function showHabPreview(e, habIdx) {
  clearTimeout(_previewTimer);
  const h  = HABITAT_DATA[habIdx];
  if (!h) return;
  const el = _ensure();
  el.innerHTML = `<img src="${SH(h)}" onerror="this.style.display='none'">
    <div class="tp-no">${h.no}</div>
    <div class="tp-name">${h.name}</div>
    <div class="tp-sub">${h.prefLoc || "No pref. location"}</div>`;
  _position(e, el);
  el.classList.add("visible");
}

// Shows a pokemon preview. 
export function showPokePreview(e, no) {
  clearTimeout(_previewTimer);
  const p  = POKE_BY_NO[no];
  if (!p) return;
  const el = _ensure();
  el.innerHTML = `<img src="${SP(p)}" onerror="this.style.display='none'">
    <div class="tp-no">${p.no}</div>
    <div class="tp-name">${p.name}</div>
    <div class="tp-sub">${p.prefLoc || "No pref. location"}</div>`;
  _position(e, el);
  el.classList.add("visible");
}

// Hides the preview after a short delay.
export function hidePreview() {
  if (!_previewEl) return;
  _previewTimer = setTimeout(() => _previewEl.classList.remove("visible"), 80);
}
