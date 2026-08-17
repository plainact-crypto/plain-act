import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_REPERTOIRE_SELECTION,
  normalizeRepertoireSelection,
  availableRepertoires
} from '../src/core/repertoire.js';
import { emptyProfile, setRepertoireSelection } from '../src/core/storage.js';

test('legacy profiles receive compatible default repertoire presets',()=>{
  assert.deepEqual(normalizeRepertoireSelection(),DEFAULT_REPERTOIRE_SELECTION);
  const profile=emptyProfile('player@example.com');
  assert.deepEqual(profile.repertoireSelection,DEFAULT_REPERTOIRE_SELECTION);
});

test('invalid or wrong-side repertoire IDs cannot corrupt selection',()=>{
  assert.deepEqual(
    normalizeRepertoireSelection({white:'caroKann',black:'missing'}),
    DEFAULT_REPERTOIRE_SELECTION
  );
});

test('selection setter changes only the requested side and validates it',()=>{
  const profile=emptyProfile('player@example.com');
  assert.equal(setRepertoireSelection(profile,'white','london'),'london');
  assert.equal(setRepertoireSelection(profile,'black','caroKann'),'caroKann');
  assert.deepEqual(profile.repertoireSelection,DEFAULT_REPERTOIRE_SELECTION);
  assert.equal(setRepertoireSelection(profile,'white','caroKann'),'london');
});

test('preset discovery is side-specific for onboarding UI',()=>{
  assert.deepEqual(availableRepertoires('white').map(x=>x.id),['london']);
  assert.deepEqual(availableRepertoires('black').map(x=>x.id),['caroKann']);
});
