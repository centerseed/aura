# /implement — Implement from Spec

**Usage:** `/implement <feature-name>`

**Example:** `/implement iap-apple-purchase`

---

## What This Command Does

Reads the spec, implements the feature, verifies against AC, then writes a review brief.
The review session will use this brief — write it as if explaining to a senior engineer who has zero context.

## Steps

1. **Load spec** — Read `.claude/specs/<feature-name>/spec.md`. This is your contract.
2. **Implement** — Write code. Follow CLAUDE.md architecture constraints.
3. **Verify** — Run `npm run lint && npm run test && npm run build` (or the appropriate stack commands). Fix all failures.
4. **AC check** — Go through each AC item in the spec. Mark `[x]` for completed items.
5. **Write review brief** — Create `.claude/specs/<feature-name>/review-brief.md` using the template below.

## Review Brief Template

```markdown
# Review Brief: <feature-name>

## What Was Built
One paragraph summary of the implementation approach.

## AC Status
- [x] AC1: <what was done to satisfy this>
- [x] AC2: <what was done to satisfy this>
- [ ] AC3: <if not satisfied, explain why>

## Key Decisions
- Decision 1: I chose X over Y because...
- Decision 2: ...

## Changed Files
- `path/to/file.ts` — what changed and why
- `path/to/test.ts` — what tests were added

## Known Risks / Reviewer Focus Areas
- Area 1: <something that might need closer review>
- Area 2: <edge case I'm not 100% sure about>

## Verification Commands Run
```bash
npm run lint    # result: PASS / n warnings
npm run test    # result: X passed, Y failed
npm run build   # result: PASS
```
```

## CRITICAL BOUNDARIES

**Do NOT declare done if:**
- Any AC item is unchecked without explanation
- `npm run test` has failures
- `npm run build` fails

**Next step:** Start a fresh session and run `/review <feature-name>`
