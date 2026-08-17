// Legacy compatibility checkpoint only.
//
// This script previously rewrote the restored production source into fixed
// "D4 Player" / "C6 Player" personas and forced every White level onto the
// 20 replies after 1.d4. That behavior conflicts with the product contract:
// each user owns a selected repertoire/opening, while London and Caro-Kann
// are only compatible presets.
//
// Keep the script in the build chain temporarily so older deployment configs
// do not break, but deliberately perform no source mutation. Repertoire
// defaults, validation and persistence now live in src/core/repertoire.js and
// src/core/storage.js via install-repertoire-selection.mjs.

console.log('Legacy D4/C6 player migration retired; preserving user-chosen repertoire architecture.');
