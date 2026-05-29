#!/usr/bin/env node
// Validate every committed JSON file parses cleanly.
// Skips node_modules, .git, and the giant generated SQL outputs folder.

const { readdirSync, statSync, readFileSync } = require("fs");
const { join, sep } = require("path");

const ROOT = process.cwd();
const SKIP_DIRS = new Set(["node_modules", ".git", ".next", "dist", "build", ".vercel"]);

const failures = [];
let scanned = 0;

function walk(dir) {
  let entries;
  try { entries = readdirSync(dir); }
  catch (_) { return; }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    let st;
    try { st = statSync(full); } catch (_) { continue; }
    if (st.isDirectory()) {
      walk(full);
    } else if (st.isFile() && entry.endsWith(".json")) {
      scanned += 1;
      try {
        JSON.parse(readFileSync(full, "utf8"));
      } catch (error) {
        failures.push({ file: full.replace(ROOT + sep, ""), message: error.message });
      }
    }
  }
}

walk(ROOT);

if (failures.length) {
  console.error(`check-json: ${failures.length} invalid JSON file(s):`);
  for (const failure of failures) {
    console.error(`  - ${failure.file}: ${failure.message}`);
  }
  process.exit(1);
}

console.log(`check-json: OK (${scanned} files)`);
