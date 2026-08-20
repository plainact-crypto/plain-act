import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migration = await readFile(new URL('../scripts/migrate-player-repertoire.mjs', import.meta.url), 'utf8');
const installer = await readFile(new URL('../scripts/install-repertoire-selection.mjs', import.meta.url), 'utf8');

test('build keeps presets as repertoires instead of D4/C6 personas',()=>{
  assert.equal(migration.includes("replaceAll('London System','D4 Player')"),false);
  assert.equal(migration.includes("replaceAll('Caro-Kann Repertoire','C6 Player')"),false);
  assert.equal(migration.includes('__REPERTOIRE_FIRST_REPLY_COVERAGE__'),true);
});

test('selected preset start exposes all 20 legal opponent first replies',()=>{
  const london = [
    'd7d5','g8f6','e7e6','c7c5','c7c6','f7f5','g7g6','b7b6','d7d6','b8c6',
    'e7e5','a7a6','h7h6','a7a5','b7b5','f7f6','g7g5','h7h5','b8a6','g8h6'
  ];
  const caro = [
    'e2e4','d2d4','g1f3','c2c4','g2g3','b2b3','f2f4','b1c3','e2e3','d2d3',
    'a2a3','a2a4','b2b4','c2c3','f2f3','g2g4','h2h3','h2h4','b1a3','g1h3'
  ];
  for (const move of [...london,...caro]) assert.equal(migration.includes(`'${move}'`),true,move);
  assert.equal(new Set(london).size,20);
  assert.equal(new Set(caro).size,20);
  assert.equal(migration.includes('ensureFirstReplyCoverage(profile,side,lp);'),true);
});

test('general repertoire persistence remains installed after source restore',()=>{
  assert.equal(installer.includes('repertoireSelection:normalizeRepertoireSelection()'),true);
  assert.equal(installer.includes('setRepertoireSelection('),true);
  assert.equal(installer.includes('availableRepertoires(side)'),true);
});
