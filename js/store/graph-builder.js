// js/store/graph-builder.js
// -----------------------------------------------------------------------------
// Builds game graph as RDF quads via POKEMON_DATA, HABITAT_DATA, LOCATION_DATA.
// Called once at startup by store.js. 
// -----------------------------------------------------------------------------

import { LOCATION_DATA, POKEMON_DATA, HABITAT_DATA } from "../data/game-data.js";
import { LKEY } from "../data/lookups.js";
import { NS, GAME_GRAPH_URI } from "./namespaces.js";

export function buildGameQuads(N3) {
  const { DataFactory } = N3;
  const { namedNode, literal, quad } = DataFactory;
  const GAME_GRAPH = namedNode(GAME_GRAPH_URI);
  const quads = [];

  const n       = (prefix, local) => namedNode(NS[prefix] + encodeURIComponent(local));
  const rel     = pred            => n("rel", pred);
  const xsdBool = v               => literal(v ? "true" : "false", namedNode(NS.xsd + "boolean"));
  const str     = v               => literal(String(v));
  const q4      = (s, p, o)       => quad(s, p, o, GAME_GRAPH);

  // --- Locations ---
  // Converts location to an RDF node with type, name, key, & color properties.
  LOCATION_DATA.forEach(loc => {
    const s = n("loc", loc.key);
    quads.push(q4(s, rel("type"),  n("rel", "Location")));
    quads.push(q4(s, rel("name"),  str(loc.name)));
    quads.push(q4(s, rel("key"),   str(loc.key)));
    quads.push(q4(s, rel("color"), str(loc.color)));
  });

  // --- Pokémon ---
  // Converts pokemon to an RDF node with  type, dex number, name, specs, 
  // ideal habitat, and preferred location properties. Entries use serebiiNo 
  // as their URI slug so game-graph URIs match pokeUri() in queries.
  POKEMON_DATA.forEach(p => {
    const s = n("poke", p.serebiiNo);
    quads.push(q4(s, rel("type"),      n("rel", "Pokemon")));
    quads.push(q4(s, rel("dexNo"),     str(p.no)));
    quads.push(q4(s, rel("name"),      str(p.name)));
    quads.push(q4(s, rel("serebiiNo"), str(p.serebiiNo)));
    quads.push(q4(s, rel("canonical"), xsdBool(p.canonical)));
    (p.specs || []).forEach(sp => quads.push(q4(s, rel("hasSpec"), n("spec", sp))));
    if (p.idealHab)              quads.push(q4(s, rel("idealHabType"), str(p.idealHab)));
    if (p.prefLoc && LKEY[p.prefLoc])
      quads.push(q4(s, rel("prefLoc"), n("loc", LKEY[p.prefLoc])));
  });

  // --- Habitats ---
  // Converts habitat to an RDF node with type, number, name, type, and
  // description properties. Also links to contained Pokémon.
  HABITAT_DATA.forEach(h => {
    const s = n("hab", h.num);
    quads.push(q4(s, rel("type"),    n("rel", "Habitat")));
    quads.push(q4(s, rel("habNum"),  str(h.num)));
    quads.push(q4(s, rel("habNo"),   str(h.no)));
    quads.push(q4(s, rel("name"),    str(h.name)));
    quads.push(q4(s, rel("habType"), str(h.type || "")));
    quads.push(q4(s, rel("desc"),    str(h.desc || "")));
    if (h.prefLoc && LKEY[h.prefLoc])
      quads.push(q4(s, rel("prefLoc"), n("loc", LKEY[h.prefLoc])));
    (h.pokemon || []).forEach(no => {
      // Find entry for this no — canonical first, then any variant
      const entry = POKEMON_DATA.find(x => x.no === no && x.canonical)
                 || POKEMON_DATA.find(x => x.no === no);
      if (entry) quads.push(q4(s, rel("contains"), n("poke", entry.serebiiNo)));
    });
  });

  return quads;
}
