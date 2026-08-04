#!/usr/bin/env node
/**
 * Vercel Ignored Build Step helper (runs with Root Directory = this package).
 *
 * Exit 0 → skip build (saves Hobby deploy quota)
 * Exit 1 → proceed with build
 *
 * Skips when:
 *  - branch is not `main` (preview deploys burn the 100/day Hobby cap)
 *  - no app source changed under this package (vercel.json-only edits skip)
 */
const { execSync } = require('node:child_process');
const path = require('node:path');

const ref = process.env.VERCEL_GIT_COMMIT_REF || '';
const rel = path.basename(process.cwd());

if (ref && ref !== 'main') {
  console.log(`skip ${rel}: branch "${ref}" (production-only deploys)`);
  process.exit(0);
}

try {
  // Quiet = no diff → exit 0 → skip. Changes → non-zero → build.
  // Ignore vercel.json-only commits so deploy-config PRs do not burn quota.
  execSync('git diff --quiet HEAD^ HEAD -- . ":!vercel.json"', { stdio: 'inherit' });
  console.log(`skip ${rel}: no app source changes`);
  process.exit(0);
} catch {
  console.log(`build ${rel}: package source changed on ${ref || 'unknown'}`);
  process.exit(1);
}
