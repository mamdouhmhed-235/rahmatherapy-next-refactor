# Context Recovery Prompt

Use this prompt if the session is compacted, Codex loses context, or a new session needs to continue remediation.

You are continuing Rahma Therapy planned-site remediation.

Read first:

- `docs/audits/planned-site-quality-audit/00-audit-brief.md`
- `docs/audits/planned-site-quality-audit/09-master-issue-register.md`
- `docs/audits/planned-site-quality-audit/10-remediation-implementation-plan.md`
- `docs/audits/planned-site-quality-audit/11-verification-and-deployment-checklist.md`
- the current phase prompt in `docs/audits/planned-site-quality-audit/remediation-prompts/`

Important context:

- The old prompt pack `docs/planned-site-audit/` was intentionally deleted. Do not recreate it.
- The active prompt pack is `docs/audits/planned-site-quality-audit/remediation-prompts/`.
- The previous dual-homepage comparison workflow is being retired.
- Before deleting or redirecting anything, identify the current canonical planned homepage route and confirmed legacy/dead routes.

Non-negotiable overrides:

1. Home keeps the short disclaimer: "Rahma Therapy provides complementary wellness treatments and does not diagnose or replace medical care."
2. Full disclaimer remains on Services, focused package pages, and FAQs/Aftercare.
3. Review excerpts may be exact canonical excerpts or exact canonical `shortExcerpt` values. Do not paraphrase/rewrite/correct/normalize reviews.
4. Current `/images/home/home-hero.avif` is approved unless a matching approved WebP is provided.
5. Do not reduce Reviews wall below 24 initial visible reviews unless measured performance proves it necessary.
6. Retire confirmed legacy/dead routes only in the dedicated cleanup phase after identifying the current canonical planned homepage.
7. Do not redesign booking popup.
8. Do not remove planned copy, prices, package names, gender wording, or safety/suitability content.
9. Never add `/book-now`, `?package=`, or `/services/mobile-massage-therapy`.
10. Use approved assets only; otherwise keep labelled placeholders.

Recovery steps:

1. Run `git status --short`.
2. Run `git log -5 --oneline`.
3. Identify the last completed remediation phase from commit history and user messages.
4. Reread the next unfinished phase prompt.
5. Continue only that phase.
6. Do not redo completed phases unless validation failed or the user asks.

Final response after recovery:

- Current branch and git status
- Last relevant remediation commit
- Phase believed to be next
- Any uncertainty or blocker
- Exact next action
