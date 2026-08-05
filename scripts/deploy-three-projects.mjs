#!/usr/bin/env node
/**
 * Provision + deploy the three StatVibe Vercel projects (separate Root Directories).
 *
 * Usage:
 *   export VERCEL_TOKEN=...          # required (Illuminary Peak or Jay Harold account)
 *   export VERCEL_ORG_ID=team_...    # optional; defaults to Illuminary Peak team from repo
 *   export VERCEL_GIT_REPO=HaroldMars/StatVibe
 *   node scripts/deploy-three-projects.mjs
 *
 * Creates (if missing) then deploys production for:
 *   - statvibe-server  (rootDirectory: statvibe-server)
 *   - stat-vibe        (rootDirectory: statvibe-client)  — keeps canonical domain name
 *   - statvibe-landing (rootDirectory: statvibe-landing)
 *   - statvibe-admin   (rootDirectory: statvibe-admin)   — Admin Dashboard
 */
'use strict';

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const TOKEN = process.env.VERCEL_TOKEN || '';
const ORG = process.env.VERCEL_ORG_ID || 'team_56sac0z1bDHP7CYWI68gf9b5';
const REPO = process.env.VERCEL_GIT_REPO || 'HaroldMars/StatVibe';
const ROOT = path.resolve(__dirname, '..');

if (!TOKEN) {
  console.error('Missing VERCEL_TOKEN. Create one at https://vercel.com/account/tokens');
  process.exit(1);
}

const PROJECTS = [
  {
    name: 'statvibe-server',
    rootDirectory: 'statvibe-server',
    framework: null,
    env: [
      { key: 'CLIENT_URL', value: 'https://stat-vibe.vercel.app', target: ['production', 'preview', 'development'] },
      { key: 'JWT_SECRET', value: process.env.JWT_SECRET || 'change-me-' + Date.now(), target: ['production', 'preview', 'development'] },
    ],
  },
  {
    name: 'stat-vibe',
    rootDirectory: 'statvibe-client',
    framework: null,
    env: [
      {
        key: 'NEXT_PUBLIC_API_URL',
        value: 'https://statvibe-server.vercel.app',
        target: ['production', 'preview', 'development'],
      },
      {
        key: 'VITE_API_URL',
        value: 'https://statvibe-server.vercel.app',
        target: ['production', 'preview', 'development'],
      },
    ],
  },
  {
    name: 'statvibe-landing',
    rootDirectory: 'statvibe-landing',
    framework: 'nextjs',
    env: [
      {
        key: 'NEXT_PUBLIC_CLIENT_URL',
        value: 'https://stat-vibe.vercel.app',
        target: ['production', 'preview', 'development'],
      },
      {
        key: 'NEXT_PUBLIC_API_URL',
        value: 'https://statvibe-server.vercel.app',
        target: ['production', 'preview', 'development'],
      },
    ],
  },
  {
    name: 'statvibe-admin',
    rootDirectory: 'statvibe-admin',
    framework: 'nextjs',
    env: [
      {
        key: 'ADMIN_JWT_SECRET',
        value: process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET || 'change-me-admin-jwt',
        target: ['production', 'preview', 'development'],
      },
      {
        key: 'ADMIN_CEO_USERNAME',
        value: process.env.ADMIN_CEO_USERNAME || 'GenAdmin',
        target: ['production', 'preview', 'development'],
      },
      {
        key: 'ADMIN_CEO_PASSWORD',
        value: process.env.ADMIN_CEO_PASSWORD || process.env.ADMIN_PASSWORD || 'genadmin-2026',
        target: ['production', 'preview', 'development'],
      },
      {
        key: 'ADMIN_CEO_NAME',
        value: process.env.ADMIN_CEO_NAME || 'Jay Harold Mars Abejar',
        target: ['production', 'preview', 'development'],
      },
    ],
  },
];

async function api(method, pathname, body) {
  const url = new URL(pathname, 'https://api.vercel.com');
  if (ORG) url.searchParams.set('teamId', ORG);
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* ignore */
  }
  if (!res.ok) {
    const msg = (json && (json.error?.message || json.message)) || text || res.statusText;
    const err = new Error(`${method} ${pathname} → ${res.status}: ${msg}`);
    err.status = res.status;
    err.json = json;
    throw err;
  }
  return json;
}

async function ensureProject(spec) {
  let existing = null;
  try {
    existing = await api('GET', `/v9/projects/${encodeURIComponent(spec.name)}`);
  } catch (e) {
    if (e.status !== 404) throw e;
  }

  if (!existing) {
    console.log(`Creating project ${spec.name} (root=${spec.rootDirectory})…`);
    existing = await api('POST', '/v11/projects', {
      name: spec.name,
      framework: spec.framework,
      rootDirectory: spec.rootDirectory,
      gitRepository: { type: 'github', repo: REPO },
      environmentVariables: (spec.env || []).map((e) => ({
        key: e.key,
        value: e.value,
        type: 'encrypted',
        target: e.target,
      })),
    });
    console.log(`  created id=${existing.id}`);
  } else {
    console.log(`Project ${spec.name} exists id=${existing.id}`);
    // Ensure root directory is set for monorepo isolation
    try {
      await api('PATCH', `/v9/projects/${existing.id}`, {
        rootDirectory: spec.rootDirectory,
        framework: spec.framework,
      });
      console.log(`  rootDirectory → ${spec.rootDirectory}`);
    } catch (e) {
      console.warn(`  warn: could not PATCH rootDirectory: ${e.message}`);
    }
    for (const e of spec.env || []) {
      try {
        await api('POST', `/v10/projects/${existing.id}/env`, {
          key: e.key,
          value: e.value,
          type: 'encrypted',
          target: e.target,
          upsert: true,
        });
        console.log(`  env upsert ${e.key}`);
      } catch (err) {
        console.warn(`  warn: env ${e.key}: ${err.message}`);
      }
    }
  }
  return existing;
}

function vercelBin() {
  try {
    execFileSync('npx', ['--yes', 'vercel@41', '--version'], { stdio: 'pipe' });
    return ['npx', '--yes', 'vercel@41'];
  } catch {
    return ['npx', '--yes', 'vercel'];
  }
}

function deployProject(spec, project) {
  const dir = path.join(ROOT, spec.rootDirectory);
  const vercelDir = path.join(dir, '.vercel');
  fs.mkdirSync(vercelDir, { recursive: true });
  fs.writeFileSync(
    path.join(vercelDir, 'project.json'),
    JSON.stringify({ projectId: project.id, orgId: ORG, projectName: spec.name }, null, 2)
  );

  const [cmd, ...baseArgs] = vercelBin();
  const env = {
    ...process.env,
    VERCEL_TOKEN: TOKEN,
    VERCEL_ORG_ID: ORG,
    VERCEL_PROJECT_ID: project.id,
  };

  console.log(`Deploying ${spec.name} from ${spec.rootDirectory}…`);
  execFileSync(cmd, [...baseArgs, 'deploy', '--prod', '--yes', '--token', TOKEN], {
    cwd: dir,
    env,
    stdio: 'inherit',
  });
}

(async () => {
  console.log(`Org=${ORG} repo=${REPO}`);
  const created = [];
  for (const spec of PROJECTS) {
    const project = await ensureProject(spec);
    created.push({ spec, project });
  }
  for (const { spec, project } of created) {
    deployProject(spec, project);
  }
  console.log('\nDone. Expected URLs:');
  console.log('  https://statvibe-server.vercel.app');
  console.log('  https://stat-vibe.vercel.app');
  console.log('  https://statvibe-landing.vercel.app');
  console.log('  https://statvibe-admin.vercel.app');
  console.log('\nSet DATABASE_URL / MONGO_URI / AI_* on statvibe-server in the Vercel dashboard if not already present.');
  console.log('Hobby repos are limited to 3 Git-linked projects — Admin may need Pro or a free slot.');
})().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
