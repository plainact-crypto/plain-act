import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const distDir = new URL('../dist/', import.meta.url);
const replacements = [
  ['https://plainact-crypto.github.io/plain-act/', 'https://plain-act.com/'],
  ['https://plain-act.pages.dev/', 'https://plain-act.com/'],
  ['https://plain-act.pages.dev', 'https://plain-act.com'],
  ['plainact-crypto.github.io/plain-act', 'plain-act.com'],
  ['/plain-act/', '/']
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

  if (file === join(distDir.pathname, 'index.html') && !/<link\s+rel=["']canonical["']/i.test(text)) {
    text = text.replace('</head>', '  <link rel="canonical" href="https://plain-act.com/" />\n</head>');
    replacementCount += 1;
  }

  if (file === join(distDir.pathname, 'manager-toolkit', 'index.html')) {
    const canonicalFrom = '<link rel="canonical" href="https://plain-act.com/">';
    const canonicalTo = '<link rel="canonical" href="https://plain-act.com/manager-toolkit/">';
    const ogFrom = '<meta property="og:url" content="https://plain-act.com/">';
    const ogTo = '<meta property="og:url" content="https://plain-act.com/manager-toolkit/">';
    if (text.includes(canonicalFrom)) { text = text.replace(canonicalFrom, canonicalTo); replacementCount += 1; }
    if (text.includes(ogFrom)) { text = text.replace(ogFrom, ogTo); replacementCount += 1; }
  }

  if (text !== before) {
    await writeFile(file, text, 'utf8');
    changedFiles += 1;
  }
}

console.log(`Normalized stale deployment hosts/paths in ${changedFiles} built files (${replacementCount} replacements).`);
