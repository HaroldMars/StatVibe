# StatVibe Admin — Vercel Root Directory: `statvibe-admin`

Next.js App Router admin dashboard for founders (`CEO_FOUNDER`) and employees.

## Local

```bash
cd statvibe-admin
cp .env.example .env.local
npm i
npm run dev
```

Open http://localhost:3000/login

Default seed (override in env):

- Username: `GenAdmin`
- Password: `genadmin-2026`
- Role: `CEO_FOUNDER`

## Vercel

Create a project with **Root Directory** = `statvibe-admin`, framework Next.js.

Required env:

```
ADMIN_JWT_SECRET=long-random-secret
ADMIN_CEO_USERNAME=GenAdmin
ADMIN_CEO_PASSWORD=change-me
ADMIN_CEO_NAME=Jay Harold Mars Abejar
```

Production URL (suggested): https://statvibe-admin.vercel.app

> Note: Vercel Hobby allows **3** Git-linked projects per repo. If you already use server + client + landing, add Admin on Pro or replace an unused project.
