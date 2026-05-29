#!/usr/bin/env node
// Sanity check: each api/*.js file should parse and `require` without throwing.
// This is not a full type check, but catches obvious syntax errors and
// missing imports before they reach a Vercel deploy.

const { readdirSync } = require("fs");
const { join } = require("path");

const apiDir = join(process.cwd(), "api");
const files = readdirSync(apiDir).filter((name) => name.endsWith(".js"));

const failures = [];

for (const file of files) {
  const path = join(apiDir, file);
  try {
    require(path);
  } catch (error) {
    failures.push({ file, message: error.message });
  }
}

if (failures.length) {
  console.error(`check-api-syntax: ${failures.length} file(s) failed:`);
  for (const failure of failures) {
    console.error(`  - api/${failure.file}: ${failure.message}`);
  }
  process.exit(1);
}

console.log(`check-api-syntax: OK (${files.length} files)`);
