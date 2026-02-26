# /review — Code Review

**Usage:** `/review <feature-name>`

**Example:** `/review iap-apple-purchase`

---

## What This Command Does

Reads the spec and review brief, reviews the implementation, then writes findings to a review report.
Report only issues that are high-confidence and genuinely matter — not style preferences.

## Steps

1. **Load context** — Read both:
   - `.claude/specs/<feature-name>/spec.md` (the contract)
   - `.claude/specs/<feature-name>/review-brief.md` (what was built)

2. **Get the diff** — Run `git diff main` (or `git diff <base-branch>`) to see all changes.

3. **Review** — Check each changed file against the AC and architecture constraints in CLAUDE.md.

4. **Write report** — Create `.claude/specs/<feature-name>/review-report.md` using the template below.

## Review Checklist

For each changed file, check:
- [ ] Does it satisfy the AC it claims to satisfy?
- [ ] Are edge cases and error paths handled?
- [ ] Does it follow Clean Architecture layer boundaries?
- [ ] Any security issues (injection, auth bypass, exposed secrets)?
- [ ] Any unintended side effects on files listed as "Must NOT Change"?
- [ ] Tests cover the AC — not just happy path?

## Review Report Template

```markdown
# Review Report: <feature-name>

## Verdict
PASS / PASS WITH MINOR ISSUES / NEEDS REWORK

## Issues Found

### 🔴 Blocking (must fix before merge)
- [ ] `path/to/file.ts:42` — Description of issue and why it matters

### 🟡 Important (should fix)
- [ ] `path/to/file.ts:87` — Description of issue

### 🟢 Minor (optional)
- [ ] `path/to/file.ts:12` — Suggestion

## AC Verification
- [x] AC1: Verified at `path/to/file.ts:30`
- [x] AC2: Verified at `path/to/test.ts:55`
- [ ] AC3: NOT verified — see blocking issue #1

## Summary
One paragraph explaining overall code quality and confidence level.
```

## CRITICAL BOUNDARIES

**STOP after writing the review report. Do NOT fix any issues in this session.**

Fixing in the same session defeats the purpose — fixes need a clean context to be done properly.

**Next step:**
- If verdict is PASS → merge / deploy
- If issues found → Start a fresh session, read `review-report.md`, and fix blocking items
