#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const htmlPath = process.argv[2] ?? 'reports/latest/index.html';
const html = readFileSync(htmlPath, 'utf8');

const checks = [
  {
    name: 'has mobile viewport metadata',
    pass: /<meta\s+name="viewport"\s+content="width=device-width,\s*initial-scale=1"/.test(html),
  },
  {
    name: 'has mobile theme color metadata',
    pass: /<meta\s+name="theme-color"/.test(html),
  },
  {
    name: 'has quick navigation for phone reading',
    pass: /<nav class="quick-nav"/.test(html) && /href="#daily-itinerary"/.test(html),
  },
  {
    name: 'sections support anchored navigation',
    pass: /<h2 id="daily-itinerary">/.test(html) && /scroll-margin-top/.test(html),
  },
  {
    name: 'tables are horizontally scrollable on phones',
    pass: /table\s*\{[^}]*overflow-x:\s*auto/s.test(html) && /-webkit-overflow-scrolling:\s*touch/.test(html),
  },
  {
    name: 'small phones have a dedicated layout breakpoint',
    pass: /@media\s*\(max-width:\s*640px\)/.test(html),
  },
  {
    name: 'map and trail images avoid cramped phone layout',
    pass: /\.image-grid\s*\{[^}]*grid-template-columns:\s*1fr/s.test(html) && /figure\s*\{[^}]*margin-inline/s.test(html),
  },
];

const failures = checks.filter((check) => !check.pass);

for (const check of checks) {
  console.log(`${check.pass ? 'PASS' : 'FAIL'} ${check.name}`);
}

if (failures.length > 0) {
  console.error(`\n${failures.length} mobile UI check(s) failed for ${htmlPath}`);
  process.exit(1);
}
