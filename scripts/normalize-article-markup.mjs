import fs from 'node:fs';
import path from 'node:path';

const distDir = path.resolve('dist');
let changedFiles = 0;
let removedHeadings = 0;

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

for (const file of walk(distDir).filter((file) => file.endsWith('.html'))) {
  const original = fs.readFileSync(file, 'utf8');
  let updated = original;

  updated = updated.replace(/(<article\s+class=["']article-body["']>\s*)<h1(?:\s[^>]*)?>[\s\S]*?<\/h1>/i, (_match, prefix) => {
    removedHeadings += 1;
    return prefix;
  });

  if (updated !== original) {
    fs.writeFileSync(file, updated);
    changedFiles += 1;
  }
}

console.log(`Normalized article markup in ${changedFiles} built file(s); removed ${removedHeadings} duplicate article H1(s).`);
