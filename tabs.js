// js/ui/tabs.js
// -----------------------------------------------------------------------------
// Handles tab navigation: switches visible panel, shows correct left-section,
// releases shared detail card if new tab doesn't own it, and re-renders tab
// content via window.app.renderTab.
//
// Avoids circular import (render-coordinator → render-households → tabs → render-coordinator)
// by routing re-render through global window.app.renderTab, wired by main.js.
// -----------------------------------------------------------------------------

import { hidePreview }            from "./preview.js";
import { releaseCardIfNotOwner }  from "./shared-card.js";

// Which left-section to show for each tab index
const LEFT_SECTION = {
  0: "left-detail",
  1: "left-detail",
  2: "left-loc",
  3: "left-detail",
  4: "left-dash",
};

// Called by tab buttons in index.html. Switches tab and triggers re-render.
export function switchTab(i) {
  // Clear the shared card if the new tab doesn't own it
  releaseCardIfNotOwner(i);

  document.querySelectorAll(".tab").forEach(t => {
    t.classList.toggle("active", t.dataset.tab === String(i));
  });
  document.querySelectorAll(".tab-panel").forEach(t => t.classList.remove("active"));
  const rightPanel = document.getElementById("tab-" + i);
  if (rightPanel) rightPanel.classList.add("active");

  document.querySelectorAll(".left-section").forEach(s => { s.style.display = "none"; });
  const leftId = LEFT_SECTION[i];
  if (leftId) {
    const leftEl = document.getElementById(leftId);
    if (leftEl) leftEl.style.display = "flex";
  }

  if (window.app?.renderTab) window.app.renderTab(i);
  hidePreview();
}
