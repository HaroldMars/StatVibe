#!/usr/bin/env node
/**
 * Vercel Ignored Build Step helper (runs with Root Directory = this package).
 *
 * Exit 0 → skip build (saves Hobby deploy quota)
 * Exit 1 → proceed with build
 *
 * Skips when:
 *  - branch is not `main` (preview deploys burn the 100/day Hobby cap)
 *  - no files changed under this package vs previous commit
 */
const { execSync } = require('node:child_process');
const path = require('node:path');

const ref = process.env.VERCEL_GIT_COMMIT_REF || '';
const pkgRoot = process.cwd();
const rel = path.basename(pkgRoot);

if (ref && ref !== 'main') {
  console.log(`skip ${rel}: branch "${ref}" (production-only deploys)`);
  process.exit(0);
}

try {
  // Quiet = no diff → exit 0 → skip. Changes → exit 1 → build.
  execSync('git diff --quiet HEAD^ HEAD -- .', { stdio: 'inherit' });
  console.log(`skip ${rel}: no package changes`);
  process.exit(0);
} catch {
  console.log(`build ${rel}: package changed on ${ref || 'unknown'}`);
  process.exit(1);
}
