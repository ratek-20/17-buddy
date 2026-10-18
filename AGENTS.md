# Project Overview

Electron desktop application providing a Magic: The Gathering Arena draft overlay.

## Architecture

- Electron main process handles MTGA log monitoring and parsing.
- Svelte renderer handles UI presentation.
- Communication between main and renderer uses Electron IPC.
- Card ratings are loaded from embedded JSON datasets.

## Development Guidelines

- Follow idiomatic Electron and Svelte conventions.
- Prefer simple, readable code over unnecessary abstractions.
- Keep the main process independent from UI logic.
- Use descriptive names for functions and variables.
- Avoid introducing dependencies unless necessary.
- Treat the repository, its history, issues, pull requests, Actions logs, and
  release artifacts as future public content. Do not publish secrets, personal
  data, machine-specific absolute paths, or unsanitized logs and screenshots.

## Workflow

- Before implementing, inspect existing code and conventions.
- Prefer minimal, focused changes.
- Do not refactor unrelated code.
- Create GitHub issues only for work that has been accepted for implementation.
  Keep tentative ideas outside the issue tracker until their scope is agreed.
