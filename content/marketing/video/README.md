# StatVibe product ad

Gemini-class pacing (logo bloom → wordmark → UI → features → CTA) with **StatVibe indigo theme and shipped features only**.

## Output

- `out/statvibe-ad.mp4` — 1920×1080 H.264 (~30s)
- Artifact copy: `/opt/cursor/artifacts/statvibe-ad.mp4`

## Render

```bash
cd content/marketing/video
npm install playwright@1.49.0
npx playwright install chromium
node render-ad.mjs
```

## Source

- `statvibe-ad.html` — timed scenes
- `../assets/logo-main.png` — official StatVibe star mark (source of truth)
- `../assets/statvibe-logo-enhanced.png` — hi-res enhancement of the same star (not the old “S” SVG)

## Reference

User-supplied reference (`ba847374-…mp4`) lived on a local Mac path and was **not available** in the cloud agent environment. Structure follows premium AI product-ad beats; branding/UI are original StatVibe.
