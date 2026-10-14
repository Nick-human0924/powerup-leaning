# Engineering rules

When available locally, read `docs/private/AGENTS.local.md` and the private master prompt before major work. They provide local context and are excluded from the public repository. Follow these baseline rules on a fresh clone.

- Keep materials, actual lessons, and observations as distinct entities.
- Never infer teaching, dates, or mastery from uploaded content alone.
- Preserve source traceability, unknown states, existing observations, and original evidence.
- Imports must be idempotent and update the UI through validated data rather than frontend content constants.
- Hint-assisted or answer-revealed responses must never become independent mastery.
- Voice feedback produces editable candidate observations requiring confirmation. Transcription is not pronunciation assessment.
- Scanned input needs real OCR or an explicit assisted-manual path; never fabricate successful analysis.
- Keep personal data, textbook originals, source images, audio, secrets, and internal notes out of public commits. Do not upload private audio without permission.
- Preserve readable mobile layouts, accessible controls, typed schemas, migrations, and explicit errors.
- Run appropriate regression checks for evidence preservation, duplicate imports, negation handling, and unknown versus incorrect outcomes.
- Stop an owned production server before rebuilding its output; verify startup and hydration after restart.
- Use isolated browser contexts for tests and never reset a normal user archive.
