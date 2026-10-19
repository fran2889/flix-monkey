# Contributing to FlixMonkey

Thank you for your interest in contributing to FlixMonkey! This document provides guidelines for human contributors to ensure a smooth development process.

## Development Setup

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/fran2889/flix-monkey.git
    cd flix-monkey
    ```

2.  **Install dependencies:**

    ```bash
    npm install
    ```

    Note: Requires Node.js >= 24.

3.  **Local Testing:**
    Run the test suite to ensure everything is working correctly:

    ```bash
    npm test
    ```

    To run tests with coverage:

    ```bash
    npm run test:coverage
    ```

4.  **Linting and Formatting:**
    The project uses ESLint and Prettier. You can run them manually:
    ```bash
    npm run lint
    ```

## Pull Request Process

1.  **Create a feature branch:**
    Name branches `type/kebab-case-slug`, where `type` is a Conventional Commits type
    (for example `feat`, `fix`, `docs`, or `test`). Match the branch prefix to the
    type in your PR title.

    ```bash
    git checkout -b feat/add-metacritic-fallback
    ```

2.  **Conventional Commits:**
    We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification. Husky hooks are in place to enforce this.
    PR titles follow the same format, since PRs are squash-merged and the title becomes
    the commit message.
    Example commit message: `feat: add support for new streaming service`

3.  **Write Tests:**
    Ensure your changes are covered by unit or UI tests.

4.  **Run the checks:**
    CI enforces formatting, lint, type-check, audit, build, and tests with coverage.
    Run those checks locally before you push.

5.  **Submit PR:**
    Push your branch and open a Pull Request against the `main` branch. The
    [body template](.github/PULL_REQUEST_TEMPLATE.md) defines the body shape,
    including the test plan and the inline `Resolves #123` form.

Issue templates for [bugs](.github/ISSUE_TEMPLATE/bug-report.md) and
[feature requests](.github/ISSUE_TEMPLATE/enhancement.md) live in `.github/`.
The bug template asks for the service, the UI location, the target, and console
and network errors, because behavior differs per service and per build target.

## AI Agents

If you are an AI agent, please refer to [AGENTS.md](./AGENTS.md) for specialized instructions on codebase conventions, architectural patterns, and tool usage.

## Store publishing

Releases are published to the Chrome Web Store and Firefox Add-ons by manually
running the `Publish to Stores` workflow for a chosen release tag; it reuses the
artifacts attached to that GitHub Release. For the required repository secrets
and the AMO source-build instructions, see
[docs/STORE_PUBLISHING.md](docs/STORE_PUBLISHING.md).

## License

By contributing to FlixMonkey, you agree that your contributions will be licensed under GPL-3.0-only.
