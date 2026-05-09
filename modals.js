// js/ui/modals.js
// -----------------------------------------------------------------------------
// Modal open/close helpers. Centralizing them keeps inline HTML handlers
// symmetrical: every modal has matching open/close functions exposed by name.
//
// confirmReset is included here because reset is triggered through a modal
// confirmation dialog. It performs the reset, closes the modal, and forces
// a full re-render.
// -----------------------------------------------------------------------------

import { performReset } from "../store/actions.js";
import { renderAll }    from "./render-coordinator.js";


function _show(id) { const el = document.getElementById(id); if (el) el.style.display = "flex"; }
function _hide(id) { const el = document.getElementById(id); if (el) el.style.display = "none"; }

// ── How-to modal ─────────────────────────────────────────────────────────────

export function openHowToModal()  { _show("how-to-modal"); }
export function closeHowToModal() { _hide("how-to-modal"); }

export function switchHowToTab(i) {
  document.querySelectorAll(".howto-tab").forEach(   (t, idx) => t.classList.toggle("active", idx === i));
  document.querySelectorAll(".howto-panel").forEach( (p, idx) => p.classList.toggle("active", idx === i));
}

// ── Reset modal ──────────────────────────────────────────────────────────────

export function openResetModal()  { _show("reset-confirm-modal"); }
export function closeResetModal() { _hide("reset-confirm-modal"); }

export function confirmReset() {
  performReset();
  closeResetModal();
  renderAll();
}
