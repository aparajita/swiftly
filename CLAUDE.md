# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is `@aparajita/swiftly`, a Node.js CLI tool that wraps SwiftLint and SwiftFormat to provide unified linting and formatting for Swift code. The tool aggregates errors from both tools, sorts them, and formats output similar to ESLint's stylish format.

## Architecture

The codebase is minimal but well-structured:

- **`lib/cli.mjs`**: Entry point that imports and runs the main function
- **`lib/swiftly.mjs`**: Core implementation containing all logic for:
  - Command-line argument parsing using yargs
  - File globbing and expansion using fast-glob
  - Spawning child processes for `node-swiftlint` and `swiftformat`
  - Error collection and aggregation from JSON output
  - Formatting and display of results in either stylish or unix format
  - Exit code handling

The tool operates by:

1. Parsing command-line arguments and expanding glob patterns
2. Running SwiftLint and/or SwiftFormat on specified files
3. Collecting JSON output from both tools
4. Normalizing and aggregating errors by file
5. Formatting output with colorization and proper sorting
6. Displaying summary statistics

## Development Commands

### Linting and Formatting

```bash
pnpm lint           # Run ESLint
pnpm lint.fix       # Run ESLint with --fix
pnpm prettier       # Check Prettier formatting
pnpm prettier.fix   # Fix Prettier formatting
pnpm check          # Run both lint and prettier checks
pnpm check.fix      # Fix both lint and prettier issues
```

### Testing

```bash
pnpm test           # Run swiftly on test files (expects problems)
pnpm test.fix       # Copy test files and run with --fix flag
pnpm swiftly        # Run the CLI directly
```

### Release

```bash
pnpm release.check  # Dry run of release process
pnpm release        # Create release, tag, push, and publish
```

## Configuration

- **ESLint**: Uses flat config with `neostandard` preset
- **Prettier**: Uses `@aparajita/prettier-config`
- **SwiftLint**: Can use `.swiftlint.yml` or npm package configs via `node-swiftlint`
- **SwiftFormat**: Uses standard `.swiftformat` config files

## Key Dependencies

- **Runtime**: `chalk`, `yargs`, `fast-glob`, `thenby`, `compare-func`
- **Peer dependency**: `swiftlint` package (wraps native SwiftLint binary)
- **Development**: Standard ESLint/Prettier toolchain with TypeScript types

## Error Handling

The tool expects both SwiftLint and SwiftFormat to be installed globally. It handles:

- Child process failures with proper exit codes
- JSON parsing of tool outputs
- Temporary file management for SwiftFormat reports
- Path normalization (SwiftLint escapes forward slashes)

## Output Formats

- **Stylish** (default): Groups errors by file, similar to ESLint
- **Unix** (`--single-line`): Single-line format with clickable file paths for VS Code
- **Quiet** (`--quiet`): Suppresses all output but preserves exit codes
