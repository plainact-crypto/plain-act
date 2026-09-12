import fs from 'node:fs';
import path from 'node:path';

const distDir = path.resolve('dist');
let changedFiles = 0;
let removedHeadings = 0;
let insertedBylines = 0;
let removedArtifacts = 0;
let softenedClaims = 0;

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

const articleDir = path.join(distDir, 'articles');
const articleFiles = fs.existsSync(articleDir)
  ? fs.readdirSync(articleDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(articleDir, entry.name, 'index.html'))
      .filter((file) => fs.existsSync(file))
  : [];

const claimReplacements = [
  [
    'If you are still doing individual contributor work on top of managing, you will burn out by day 20. That is not sustainable.',
    'If you are still doing individual contributor work on top of managing, your workload can become unsustainable very quickly.'
  ],
  [
    'Inconsistent standards kill morale faster than anything.',
    'Inconsistent standards can erode morale quickly.'
  ],
  [
    'That is 50% of authority.',
    'That is a large part of how authority becomes visible.'
  ],
  [
    'Authority compounds. Day 5, no one notices. Day 25, the team adjusts to your pace without thinking about it.',
    'Authority compounds. At first the effect may be subtle; over time, the team starts to adjust to a clear and consistent management pattern.'
  ],
  [
    'Likability follows clarity. It never works the other way around.',
    'Clarity matters more than trying to be liked in the room.'
  ]
];

for (const file of walk(distDir).filter((file) => file.endsWith('.html'))) {
  const original = fs.readFileSync(file, 'utf8');
  let updated = original;

  updated = updated.replace(/(<article\b[^>]*class=["'][^"']*\barticle-body\b[^"']*["'][^>]*>\s*)<h1(?:\s[^>]*)?>[\s\S]*?<\/h1>/i, (_match, prefix) => {
    removedHeadings += 1;
    return prefix;
  });

  if (!updated.includes('class="article-byline"')) {
    updated = updated.replace(/(<header\b[^>]*class=["'][^"']*\barticle-hero\b[^"']*["'][^>]*>[\s\S]*?<h1(?:\s[^>]*)?>[\s\S]*?<\/h1>)/i, (match) => {
      insertedBylines += 1;
      return `${match}\n      <p class="article-byline small">Published by <a href="/about/">PlainAct Publishing</a></p>`;
    });
  }

  if (file.includes(`${path.sep}articles${path.sep}`)) {
    const beforeArtifacts = updated;
    updated = updated
      .replace(/<p>\s*---\s*<\/p>/gi, '')
      .replace(/<p>This article is based on the Plain Act approach to early management pressure\.<\/p>/gi, '');
    if (updated !== beforeArtifacts) removedArtifacts += 1;

    for (const [from, to] of claimReplacements) {
      if (updated.includes(from)) {
        updated = updated.split(from).join(to);
        softenedClaims += 1;
      }
    }
  }

  if (updated !== original) {
    fs.writeFileSync(file, updated);
    changedFiles += 1;
  }
}

const qaFailures = [];
if (articleFiles.length !== 11) {
  qaFailures.push(`Expected 11 current article pages, found ${articleFiles.length}.`);
}

for (const file of articleFiles) {
  const html = fs.readFileSync(file, 'utf8');
  const slug = path.basename(path.dirname(file));
  const checks = [
    ['visible publisher byline', /class=["']article-byline["'][^>]*>[\s\S]*PlainAct Publishing/i],
    ['example section', /<h2[^>]*>\s*Example\s*<\/h2>/i],
    ['application section', /<h2[^>]*>\s*How to apply this this week\s*<\/h2>/i],
    ['practical action list', /<ol[\s>]/i],
    ['final note', /<h2[^>]*>\s*Final note\s*<\/h2>/i]
  ];

  for (const [label, pattern] of checks) {
    if (!pattern.test(html)) qaFailures.push(`${slug}: missing ${label}.`);
  }

  if (/<p>\s*---\s*<\/p>/i.test(html)) qaFailures.push(`${slug}: drafting separator still rendered.`);
  if (/This article is based on the Plain Act approach to early management pressure\./i.test(html)) {
    qaFailures.push(`${slug}: repeated editorial boilerplate still rendered.`);
  }

  const riskyClaims = [
    'you will burn out by day 20',
    'Inconsistent standards kill morale faster than anything',
    'That is 50% of authority',
    'Likability follows clarity. It never works the other way around.'
  ];
  for (const claim of riskyClaims) {
    if (html.includes(claim)) qaFailures.push(`${slug}: unsupported absolute claim remains: ${claim}`);
  }
}

if (qaFailures.length) {
  console.error('Editorial article QA failed:');
  for (const failure of qaFailures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Editorial QA PASS: ${articleFiles.length} current articles checked for distinct practical structure and drafting artifacts.`);
console.log(`Normalized article markup in ${changedFiles} built file(s); removed ${removedHeadings} duplicate article H1(s); inserted ${insertedBylines} publisher byline(s); cleaned artifacts in ${removedArtifacts} article file(s); softened ${softenedClaims} unsupported absolute claim(s).`);
