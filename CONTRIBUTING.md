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

    Use the Node.js version in [`.nvmrc`](.nvmrc). `npm install` rejects
    unsupported versions.

3.  **Run the tests:**

    ```bash
    npm test               # unit and UI tests
    npm run test:coverage  # same tests with a coverage report
    ```

4.  **Lint and format:**

    The project uses ESLint and Prettier. Run the read-only checks first:

    ```bash
    npm run lint
    npm run format:check
    ```

    Apply fixes with:

    ```bash
    npm run lint:fix
    npm run format
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

3.  **Write tests:**
    Add or update tests for behavior changes. New tests go in
    [`tests/unit/`](tests/unit/) or [`tests/ui/`](tests/ui/); use the UI suite
    when a test needs real streaming-service markup. Live-API integration tests
    live in [`tests/integration/`](tests/integration/).

4.  **Run the checks:**
    Run the local equivalents of the [CI checks](.github/workflows/ci.yml) before
    you push:

    ```bash
    npm run type-check \
      && npm run lint \
      && npm run format:check \
      && npm run audit \
      && npm run build \
      && npm run test:coverage
    ```

    If you changed the Firefox manifest, also run:

    ```bash
    npm run build:firefox
    npx --yes web-ext@10.7.0 lint --source-dir dist/firefox
    ```

5.  **Submit your PR:**
    Push your branch and open a Pull Request against the `main` branch. Follow the
    [body template](.github/PULL_REQUEST_TEMPLATE.md) and its inline guidance.

    Issue templates for [bugs](.github/ISSUE_TEMPLATE/bug-report.md) and
    [feature requests](.github/ISSUE_TEMPLATE/enhancement.md) live in `.github/`.
    Choose the template that matches your report and fill in the requested details.

## AI Agents

If you are an AI agent, please refer to [AGENTS.md](./AGENTS.md) for specialized instructions on codebase conventions, architectural patterns, and tool usage.

## Store publishing

Store publishing is a separate manual deployment from the GitHub release. See
[docs/STORE_PUBLISHING.md](docs/STORE_PUBLISHING.md) for the workflow, required
secrets, and AMO source-build instructions.

## License

By contributing to FlixMonkey, you agree that your contributions will be licensed under GPL-3.0-only.
