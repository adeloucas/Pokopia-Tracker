// js/ui/shared-card.js
// -----------------------------------------------------------------------------
// The shared detail card is owned by one tab at a time.
// Switching tabs always clears the card back to the empty state unless
// the destination tab is the same one that currently owns it.
//
// Ownership:  0 = Pokédex, 1 = Households, 3 = Habitats, null = none
// -----------------------------------------------------------------------------

// which tab currently "owns" the card content.
let _ownerTab = null;

function _emptySharedCard() {
  return `<div class="detail-card-empty">
    <div class="empty-pokeball"></div>
    <p>Select a card from Pokédex, Habitats, or Households<br>to see details and edit information.</p>
  </div>`;
}

// Called by each render module when it populates the card. 
export function claimCard(tabIndex) {
  _ownerTab = tabIndex;
}

//
// Called by tabs.js when switching tabs. Clears the card if the new tab
// doesn't own it, and resets ownership to null.
export function releaseCardIfNotOwner(newTabIndex) {
  if (_ownerTab !== null && _ownerTab !== newTabIndex) {
    _ownerTab = null;
    const el = document.getElementById("shared-detail-card");
    if (el) el.innerHTML = _emptySharedCard();
  }
}

// Clears ownership and writes the empty-state HTML.
// Use this whenever a tab closes its detail view, or on a full re-render
// (import/reset). Callers should never write the empty-state markup directly.
export function resetCard() {
  _ownerTab = null;
  const el = document.getElementById("shared-detail-card");
  if (el) el.innerHTML = _emptySharedCard();
}
