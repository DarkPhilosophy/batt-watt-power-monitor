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

### Prerequisites
- GNOME Shell 45+
- Node.js 18+
- Git
- glib-compile-schemas (glib2)

### Setup
```bash
git clone https://github.com/DarkPhilosophy/batt-watt-power-monitor.git
cd batt-watt-power-monitor
npm install
./build.sh
```

### Workflow
1. Create a branch: `git checkout -b feature/your-feature`
2. Make changes
3. Update `/.github/CHANGELOG.md` for user-facing changes
4. Run `./build.sh` to sync versions and docs
5. Commit: `git commit -m "feat: add feature"`
6. Push: `git push origin feature/your-feature`
7. Open a Pull Request

## Coding Guidelines
- Use ES6+ and GNOME Shell conventions
- Prefer async patterns where needed
- Keep functions small and focused
- Clean up resources in `destroy()`

## Testing
- Manual: build and verify in GNOME Shell
- Optional: `npm test`

## Documentation
- Docs live in `/.github/`
- `/.github/README.md` and `/.github/CHANGELOG.md` are updated by `./build.sh`

## Recognition
Contributors are recognized in CONTRIBUTORS.md and in release notes when appropriate.
