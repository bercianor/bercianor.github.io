# List the available commands.
default:
    @just --list

# Install the locked dependencies, validate and build production output.
build:
    pnpm install --frozen-lockfile
    pnpm run check
    pnpm test
    pnpm run build
    pnpm run verify:routes

# Run all checks, including isolated configuration, PDF and browser tests.
check: build
    pnpm run test:home
    pnpm run test:e2e

# Build and serve production output locally; stop with Ctrl+C.
preview: build
    pnpm run preview --host 127.0.0.1 --port 4321 --ignore-lock
