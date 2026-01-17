# Contributing to Battery Power Monitor

Thanks for considering a contribution.

## Code of Conduct

This project follows the [Contributor Covenant](https://www.contributor-covenant.org/) code of conduct. Please report unacceptable behavior to [DarkPhilosophy](https://github.com/DarkPhilosophy).

## How to Contribute

### Bugs

- Use the issue templates
- Include GNOME version, extension version, and clear repro steps
- Provide logs from `journalctl -f` or Looking Glass

### Enhancements

- Use the feature request template
- Describe the problem and proposed solution
- Consider alternatives and trade-offs

## Development Setup

### Project Structure (v18+)

- **extension/**: Contains the extension source.
  - **extension.js**: Main entry point (enable/disable/unlock).
  - **prefs.js**: Preferences window logic.
  - **library/**: Core logic modules (`drawing`, `sync`, `system`, etc.).
  - **schemas/**: GSettings schemas.
- **.scripts/**: Build and maintenance tooling.
- **.github/**: Documentation and workflows.

### Prerequisites

- GNOME Shell 45+
- Node.js 18+
- Git
- glib-compile-schemas (glib2)

### Setup

```bash
git clone https://github.com/DarkPhilosophy/batt-watt-power-monitor.git
cd batt-watt-power-monitor
npm install  # Installs ESLint 9+ and dependencies
./build.sh   # Builds, lints, and installs locally
```

### Workflow

1. Create a branch: `git checkout -b feature/your-feature`
2. **Linting**: We use **ESLint 9** with Flat Config (`eslint.config.mjs`). Run `npm run lint` frequently.
3. **Validation**: The project enforces strict file structure via `.build-schema.json`. New files must be added to this schema or the build will fail.
4. Update `/.github/CHANGELOG.md` for user-facing changes.
5. Run `./build.sh` to sync versions, validate schema, lint, and build.
6. Commit: `git commit -m "feat: add feature"`
7. Push: `git push origin feature/your-feature`
8. Open a Pull Request

## Coding Guidelines

- **ESNext**: Use modern JavaScript features supported by GJS.
- **Synchronous UI**: v18+ uses a synchronous core for `updateUI` to ensure determinism. Avoid `idle_add` for drawing logic.
- **Strict Typing**: All functions must have JSDoc with specific types (no `any` or generic `Function`).
- **Clean Resources**: Explicitly destroy signals and objects in `disable()`.
- **SVG Caching**: Use the `library/drawing.js` caching mechanism for all new assets.

## Testing

- Manual: build and verify in GNOME Shell
- Continuous Integration: GitHub Actions will auto-lint and build your PR.

## Documentation

- Docs live in `/.github/`
- `/.github/README.md` and `/.github/CHANGELOG.md` are updated by `./build.sh`.

## Recognition

Contributors are recognized in CONTRIBUTORS.md and in release notes when appropriate.
