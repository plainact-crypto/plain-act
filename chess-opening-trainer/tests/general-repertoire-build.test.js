import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migration = await readFile(new URL('../scripts/migrate-player-repertoire.mjs', import.meta.url), 'utf8');
const installer = await readFile(new URL('../scripts/install-repertoire-selection.mjs', import.meta.url), 'utf8');

test('build no longer rewrites the product into D4/C6 personas',()=>{
  assert.equal(migration.includes("replaceAll('London System','D4 Player')"),false);
  assert.equal(migration.includes('migrateD4PlayerReplies(lp)'),false);
  assert.equal(migration.includes('D4_PLAYER_FIRST_REPLIES='),false);
});

test('general repertoire persistence remains installed after source restore',()=>{
  assert.equal(installer.includes('repertoireSelection:normalizeRepertoireSelection()'),true);
  assert.equal(installer.includes('setRepertoireSelection('),true);
  assert.equal(installer.includes('availableRepertoires(side)'),true);
});
