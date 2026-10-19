<!--
How to use this template

- Automated checks are enforced by CI: formatting, lint, type-check, audit,
  all-target build, and the unit/UI suites with coverage. Run them locally for
  faster feedback.
- Tick the manual box only after performing the check. If someone else did, say
  who.
- Delete a heading that does not apply rather than leaving it empty.
- Summary is 1-3 bullets, one sentence each, naming one behavior change and,
  where it is not obvious, why the old behavior was wrong. If it needs more than
  three bullets, consider splitting into two pull requests.
- Keep the body under roughly 1000 characters and 20 lines.
- Replace the "Manual:" line with the checks this PR needs, or delete it. Never
  leave a generic "manual testing" placeholder.
- `npm run audit` must pass at moderate or higher. Fix the dependency rather than
  lowering the level.

Use `Resolves #123` or `Resolves #123, #456` for closing links. If no related
issue exists, omit the line and say what the PR implements in Summary.

Add a "## Breaking Changes" section only if something genuinely breaks for a
user.

Add a "## Notes" section only for context the diff cannot give: something
unverified, a non-obvious decision, or a constraint a follow-up must respect. At
most 3 bullets; omit analysis process and rejected alternatives.
-->

## Summary

- What this PR changes, one bullet per behavior change
- Why the previous behavior was wrong, where it was wrong

## Test Plan

- [ ] Manual: `<target>` on `<service>`: ratings for a known title match the selected provider, and the console shows no errors
