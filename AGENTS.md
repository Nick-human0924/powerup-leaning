# Andy English Companion · Persistent Engineering Rules

**Read** the private `Codex_Andy_English_Companion_Master_Prompt_V1.md` before major work when available locally. It is excluded from the public repository; on a fresh clone follow this AGENTS.md and README.md. These long-term invariants remain in force.

## Product invariants
- Optimize for a parent's short, unpredictable 2–5 minute review opportunities, total around 30 min/week. Home must open quickly into parent-guided and child-guided modes.
- Treat `Material` (available textbook), `LessonSession` (actually taught), and `Observation` (what Andy demonstrated) as different entities. Material upload alone is not proof of teaching or mastery.
- Current imported physical PDFs are Cambridge **Power Up 1 Second Edition**, available through printed p.89 (Unit 7 partial). Do not silently substitute `Power Up 2` when prior conversation calls it “L2”. Unknown actual class dates stay unknown.
- Practice mode shares one skill registry and evidence history. Unknown/unobserved remains unobserved; prompt-assisted success is never independent mastery.
- Parent voice feedback creates **candidate** observations requiring review; raw text remains editable and retained. Do not conflate Web Speech recognition with reliable pronunciation grading.
- The existing V3 HTML is a UX/reference prototype only. Only three Unit 4 tasks are functional examples; build data-driven ingestion and task generation for future units.

## Ingestion invariants
- PDF/images may be scanned. Test for extractable text; use a real OCR/vision provider if needed. With no provider credentials, show an explicit setup/assisted-manual path, never “successfully analyzed” fiction.
- Store source filename, content hash, actual PDF page index and independently observed printed page number. Preserve source traceability.
- Reimports must be idempotent; imports must not delete previous learning observations or rewrite established mastery from mere content changes.
- Newly imported, verified skills become available to the UI/recommendations without hand-editing front-end JavaScript/TypeScript constants.

## Privacy, engineering and design
- Child audio/data are private by default; no cloud audio upload without permission. Never expose secrets in client code. Never commit textbook originals, embedded page images, audio, or personal learning archives to a public repo.
- Favor typed schemas, migrations, small modules, tests, and explicit error states. Keep README and ingestion SOP aligned with the actual UI, not intended features.
- Preserve the warm V3 mobile aesthetic (off-white, deep teal/green, restrained coral accents) and improve tap-target accessibility, screen density and clarity.
- After any schema/import logic change run unit/integration regression cases for evidence preservation, duplicate pages, negative expressions (e.g. “完全不用提示”), and unknown vs. incorrect.

## Current implementation (2026-10-14)
- Run `scripts/start.ps1 -Port 3001` or `node node_modules/next/dist/bin/next dev --port 3001`; production is `next build` then `next start --port 3001`. Node/pnpm are bundled on this computer; see README for exact fallback paths.
- Development outputs `.next-dev`; production outputs `.next`. Never rebuild production while its server is running: stop the owned server, build, restart and verify hydration before browser tests.
- User subsequently supplied 9 real PDFs in imports/materials. All 90 pages were rendered and locally OCR'd with RapidOCR; the curated seed now has Hello plus Units 1–7, 82 sections, 196 skills, and 197 tasks through printed p89. Unit7 is partial. Preserve raw OCR/footer candidates and visually verified corrections. No teaching dates or observations are inferred from this import.
- `schemas/initial-reference.json` and public reference previews are private, ignored by Git, and required for the local sample. Runtime educational content comes from validated JSON/IndexedDB, not frontend constants.
- Run `node node_modules/vitest/vitest.mjs run`, `node node_modules/typescript/bin/tsc --noEmit`, and `node node_modules/@playwright/test/cli.js test` for a substantial release. Playwright uses isolated contexts and port3001; avoid writing to a user's normal browser archive.
- Preserve unknown legacy skills as pending mappings and keep original outcome/evidence. Do not silently drop old observations. Schema rejects hint/reveal contradictory independent results, including imported backups.
