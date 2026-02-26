# /spec — Write Feature Spec

**Usage:** `/spec <feature-name> [brief description]`

**Example:** `/spec iap-apple-purchase Implement Apple In-App Purchase verification`

---

## What This Command Does

Explores the codebase, then writes a structured spec to `.claude/specs/<feature-name>/spec.md`.
The implement session will read this file as its sole source of truth.

## Steps

1. **Explore** — Use Glob/Grep to understand affected areas. Read relevant existing files.
2. **Clarify** — If any requirement is ambiguous, ask the user ONE focused question before proceeding.
3. **Write spec** — Create `.claude/specs/<feature-name>/spec.md` using the template below.
4. **Confirm** — Print a summary of the AC checklist to the user.

## Spec File Template

```markdown
# Spec: <feature-name>

## Goal
One sentence describing what this feature achieves for the user.

## Context
- Affected files/modules: (list them)
- Dependencies: (other features or services this relies on)
- Architecture layer: (domain / application / infrastructure / interface)

## Acceptance Criteria
Each item must be verifiable — point to a specific behavior, not "it should work".

- [ ] AC1: <specific behavior>
- [ ] AC2: <error case that must be handled>
- [ ] AC3: <performance or security requirement if applicable>

## Out of Scope
- <what must NOT be changed>
- <what is deferred to a future task>

## Files Expected to Change
- `path/to/file.ts` — reason
- `path/to/test.ts` — reason

## Files That Must NOT Change
- `path/to/other.ts` — reason
```

## CRITICAL BOUNDARIES

**STOP after writing the spec file. Do NOT write any implementation code.**

This session's only output is `.claude/specs/<feature-name>/spec.md`.

**Next step:** Start a fresh session and run `/implement <feature-name>`
