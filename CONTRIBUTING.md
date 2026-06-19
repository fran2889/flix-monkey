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

    Note: Requires Node.js >= 22.

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
    Always create a new branch for your changes:

    ```bash
    git checkout -b feature/my-new-feature
    ```

2.  **Conventional Commits:**
    We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification. Husky hooks are in place to enforce this.
    Example commit message: `feat: add support for new streaming service`

3.  **Write Tests:**
    Ensure your changes are covered by unit or UI tests.

4.  **Submit PR:**
    Push your branch and open a Pull Request against the `main` branch.

## AI Agents

If you are an AI agent, please refer to [AGENTS.md](./AGENTS.md) for specialized instructions on codebase conventions, architectural patterns, and tool usage.

## License

By contributing to FlixMonkey, you agree that your contributions will be licensed under the GNU General Public License v3.0.
