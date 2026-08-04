#!/usr/bin/env node
/**
 * Point https://stat-vibe.vercel.app at the newest READY deployment for the
 * Illuminary Peak `stat-vibe` project (rootDirectory: statvibe-client).
 *
 * Use when Git deploys succeed but Instant Rollback / a pinned alias leaves
 * production on an older commit (CSS/SW fingerprint lag).
 *
 * Env:
 *   VERCEL_TOKEN          required
 *   VERCEL_ORG_ID         optional (default: Illuminary Peak team)
 *   VERCEL_PROJECT_ID     optional (default: Illuminary Peak stat-vibe)
 *   DEPLOYMENT_ID         optional explicit dpl_… to alias
 */
const TOKEN = process.env.VERCEL_TOKEN;
const ORG = process.env.VERCEL_ORG_ID || 'team_56sac0z1bDHP7CYWI68gf9b5';
const PROJECT = process.env.VERCEL_PROJECT_ID || 'prj_49rkcXYZ5vrUO3UsJRY0R5lAR8l0';
const ALIAS = 'stat-vibe.vercel.app';

if (!TOKEN) {
  console.error('Missing VERCEL_TOKEN');
  process.exit(1);
}

async function api(path, opts = {}) {
  const url = new URL(path, 'https://api.vercel.com');
  if (!url.searchParams.has('teamId')) url.searchParams.set('teamId', ORG);
  const res = await fetch(url, {
    ...opts,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.error?.message || res.statusText;
    throw new Error(`${res.status} ${path}: ${msg}`);
  }
  return body;
}

async function main() {
  let dpl = process.env.DEPLOYMENT_ID || '';
  if (!dpl) {
    const list = await api(`/v6/deployments?projectId=${PROJECT}&limit=20&state=READY`);
    const ready = (list.deployments || []).filter((d) => d.state === 'READY' || d.readyState === 'READY');
    if (!ready.length) throw new Error('No READY deployments found');
    // Prefer newest with a github commit on main / merge, else newest READY.
    dpl = ready[0].uid;
    console.log(
      'Selected',
      dpl,
      ready[0].meta?.githubCommitSha?.slice(0, 7) || '(no sha)',
      ready[0].url
    );
  }

  const result = await api(`/v2/deployments/${dpl}/aliases`, {
    method: 'POST',
    body: JSON.stringify({ alias: ALIAS }),
  });
  console.log('Aliased', ALIAS, '→', dpl);
  console.log('Previous deployment:', result.oldDeploymentId || '(none)');

  // Smoke: hashed CSS should include Messages shell styles after PR #25.
  const html = await fetch(`https://${ALIAS}/`).then((r) => r.text());
  const cssPath = (html.match(/\/assets\/styles-[^"]+\.css/) || [])[0];
  const sw = await fetch(`https://${ALIAS}/sw.js`).then((r) => r.text());
  const cache = (sw.match(/statvibe-v\d+/) || [])[0] || '?';
  let cssOk = false;
  if (cssPath) {
    const css = await fetch(`https://${ALIAS}${cssPath}`).then((r) => r.text());
    cssOk = css.includes('msg-shell') && css.includes('my-qr-card');
  }
  console.log('Verify:', { cssPath, cache, messagesCss: cssOk });
  if (!cssOk) {
    console.warn('Warning: production CSS missing msg-shell/my-qr-card — alias may still be stale.');
    process.exit(2);
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
