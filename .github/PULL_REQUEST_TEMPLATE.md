<!--
How to use this template

- Every box below ships unticked. Tick a box only after running that command, and
  put the result next to it (test count, coverage percentages).
- [x] means you ran it and it passed. [ ] means a human still has to. Never tick
  a manual step on your own; if one is genuinely done, say who did it.
- Delete any heading that does not apply. Do not leave a heading empty and do not
  write "None" under one: an empty "## Breaking Changes" is noise.
- Summary is 1-3 bullets, one sentence each, naming one behaviour change and,
  where it is not obvious, why the old behaviour was wrong. If it will not fit in
  three bullets, that is usually two pull requests, not one long summary.
- Keep the whole body under roughly 1000 characters and 20 lines. The Test Plan
  below is about half of that. Detail that does not fit belongs in the issue or a
  linked note, not in the diff.
- Replace the "Manual:" line below with the specific checks this PR needs, or
  delete it. Never leave a generic "manual testing" placeholder.
- npm run test:coverage supersedes npm test here: it runs the same tests/unit and
  tests/ui suites and additionally enforces the coverage thresholds. Report the
  test count and the coverage numbers. Keep it to a short result, no prose.

Issue links are inline. There is no "## Resolves" heading, and this line is only
ever for closing issues:

Resolves #123

Use "Resolves #123, #456" for several. If the PR implements work nobody filed,
add no such line and say what it implements in Summary instead.

Notes is for what a reviewer of this diff cannot get from the code: something
unverified, a decision that looks wrong without its reason, or a constraint a
follow-up must respect. At most 3 bullets. Leave out your analysis process,
rejected alternatives, and data-quality caveats; those belong in the issue.
-->

## Summary

- What this PR changes, one bullet per behaviour change
- Why the previous behaviour was wrong, where it was wrong

## Test Plan

- [ ] Format check passes (`npm run format:check`)
- [ ] Lint passes (`npm run lint`)
- [ ] Type check passes (`npm run type-check`)
- [ ] Dependency audit passes (`npm run audit`)
- [ ] All targets build successfully (`npm run build`)
- [ ] Tests and coverage gate pass (`npm run test:coverage`): record the test count and the coverage percentages
- [ ] Manual: load the extension and confirm ratings appear on Netflix browse rows

## Breaking Changes

<!-- Delete this heading unless something genuinely breaks for a user. -->
