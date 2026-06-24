#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);

if (args.includes("--help") || args.length === 0) {
  console.log("Usage: check-static-report-site.mjs <deployable-folder>");
  process.exit(args.length === 0 ? 1 : 0);
}

const root = path.resolve(args[0]);
const errors = [];
const warnings = [];

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    if (entry.isFile()) return [full];
    return [];
  });
}

function addFinding(list, file, message) {
  list.push(`${path.relative(root, file) || "."}: ${message}`);
}

if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
  console.error(`[error] deployable folder not found: ${root}`);
  process.exit(1);
}

const indexPath = path.join(root, "index.html");
if (!fs.existsSync(indexPath)) {
  errors.push("index.html is missing at the deployable folder root");
}

const files = walk(root);
const textFilePattern = /\.(html|css|js|mjs|json|md|txt|xml|svg)$/i;
const htmlFiles = files.filter((file) => /\.html$/i.test(file));

if (htmlFiles.length === 0) {
  errors.push("no .html files found");
}

for (const file of files) {
  const stat = fs.statSync(file);
  if (stat.size > 5 * 1024 * 1024) {
    addFinding(warnings, file, `large file (${(stat.size / 1024 / 1024).toFixed(1)} MB)`);
  }

  if (!textFilePattern.test(file)) continue;
  const text = fs.readFileSync(file, "utf8");

  const blockedPatterns = [
    [/https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?/i, "local-only URL"],
    [/file:\/\//i, "file:// URL"],
    [/\/Users\/[A-Za-z0-9._-]+/i, "absolute macOS user path"],
    [/[A-Z]:\\Users\\/i, "absolute Windows user path"],
    [/-----BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY-----/i, "private key material"],
    [/\b(sk-[A-Za-z0-9_-]{20,}|xox[baprs]-[A-Za-z0-9-]{20,})\b/, "secret-looking token"],
  ];

  for (const [pattern, label] of blockedPatterns) {
    if (pattern.test(text)) addFinding(errors, file, `contains ${label}`);
  }

  if (/\b(OPENAI_API_KEY|CODEX_API_KEY|GITHUB_TOKEN|AWS_SECRET_ACCESS_KEY)\b/.test(text)) {
    addFinding(warnings, file, "mentions secret environment variable names; confirm no values are exposed");
  }
}

for (const file of htmlFiles) {
  const html = fs.readFileSync(file, "utf8");
  if (!/<title>[^<]+<\/title>/i.test(html)) {
    addFinding(warnings, file, "missing non-empty <title>");
  }
  if (!/<meta\s+name=["']viewport["']/i.test(html)) {
    addFinding(warnings, file, "missing viewport meta tag");
  }
}

if (errors.length) {
  console.error("Static report site check failed:");
  for (const error of errors) console.error(`- ${error}`);
}

if (warnings.length) {
  console.error("Warnings:");
  for (const warning of warnings) console.error(`- ${warning}`);
}

if (!errors.length && !warnings.length) {
  console.log("Static report site check passed with no warnings.");
} else if (!errors.length) {
  console.log("Static report site check passed with warnings.");
}

process.exit(errors.length ? 1 : 0);
