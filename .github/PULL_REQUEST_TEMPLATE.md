<!--
How to use this template

- Tick a box only after running that command, and put the result next to it.
  `test:coverage` supersedes `npm test`: it runs the same unit and UI suites and
  enforces the coverage thresholds. Tick a manual check only if you performed it;
  if someone else did, say who.
- Delete a heading that does not apply. Do not leave one empty or write "None"
  under it.
- Summary is 1-3 bullets, one sentence each, naming one behavior change and,
  where it is not obvious, why the old behavior was wrong. If it needs more than
  three bullets, it is usually two pull requests.
- Keep the body under roughly 1000 characters and 20 lines. Detail that does not
  fit belongs in the issue or a linked note.
- Replace the "Manual:" line with the checks this PR needs, or delete it. Never
  leave a generic "manual testing" placeholder.
- `npm run audit` fails on moderate or higher, dev dependencies included. Fix the
  dependency rather than lowering the level.
- If you use `gh`, templates are not applied automatically. Copy this file, fill
  it in, and pass the copy with `--body-file <path>`.

Issue links are inline, not under a heading. Use `Resolves #123` or
`Resolves #123, #456` for closing links. If nobody filed the work, omit the line
and say what the PR implements in Summary.

Add a "## Notes" section only for context the diff cannot give: something
unverified, a non-obvious decision, or a constraint a follow-up must respect. At
most 3 bullets; omit analysis process and rejected alternatives.
-->

## Summary

- What this PR changes, one bullet per behavior change
- Why the previous behavior was wrong, where it was wrong

## Test Plan

- [ ] Format check passes (`npm run format:check`)
- [ ] Lint passes (`npm run lint`)
- [ ] Type check passes (`npm run type-check`)
- [ ] Dependency audit passes (`npm run audit`)
- [ ] All targets build successfully (`npm run build`)
- [ ] Tests and coverage gate pass (`npm run test:coverage`): record the test count and the coverage percentages
- [ ] Manual: load the affected target and confirm ratings appear on the affected service

## Breaking Changes

<!-- Delete this heading unless something genuinely breaks for a user. -->
