# Standardize GPL v3 License Headers

## Goal

Replace the verbose per-file GPL notices with SPDX identifiers and change the
project's licensing designation from GPL-3.0-or-later to GPL-3.0-only.

## Scope

- Replace the header template and every enforced JavaScript source and test
  header with a three-line SPDX comment.
- Set the package license metadata to `GPL-3.0-only` so generated userscript
  metadata uses the strict GPL v3 identifier.
- Remove license comments from HTML fixtures. They remain covered by the
  repository-level `LICENSE` file and are not subject to header linting.

## Header Format

```js
/**
 * SPDX-FileCopyrightText: <year> Fran
 * SPDX-License-Identifier: GPL-3.0-only
 */
```

The lint template retains its year placeholder, allowing each existing source
file to preserve its current copyright year.

## Verification

Run the formatter check and linter to confirm that every enforced JavaScript
header matches the template. Search the active source, tests, package metadata,
and fixture set to confirm no obsolete long notices or `GPL-3.0-or-later`
identifiers remain.
