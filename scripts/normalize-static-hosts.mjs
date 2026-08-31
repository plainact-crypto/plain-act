import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const distDir = new URL('../dist/', import.meta.url);
const replacements = [
  ['https://plainact-crypto.github.io/plain-act/', 'https://plain-act.com/'],
  ['https://plain-act.pages.dev/', 'https://plain-act.com/'],
  ['https://plain-act.pages.dev', 'https://plain-act.com'],
  ['plainact-crypto.github.io/plain-act', 'plain-act.com']
];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(fullPath));
    else files.push(fullPath);
  }
  return files;
}

let changedFiles = 0;
let replacementCount = 0;
for (const file of await walk(distDir.pathname)) {
  if (!/\.(?:html|xml|txt)$/i.test(file)) continue;
  let text = await readFile(file, 'utf8');
  const before = text;
  for (const [from, to] of replacements) {
    const pieces = text.split(from);
    if (pieces.length > 1) {
      replacementCount += pieces.length - 1;
      text = pieces.join(to);
    }
  }
  if (text !== before) {
    await writeFile(file, text, 'utf8');
    changedFiles += 1;
  }
}

console.log(`Normalized stale deployment hosts in ${changedFiles} built files (${replacementCount} replacements).`);
