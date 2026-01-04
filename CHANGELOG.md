# Changelog

## v15 (2026-01-04)
- **Automatic Version Sync**: Version is now managed in `package.json` and automatically synchronized to all files (metadata, prefs, README, VERSION) during build/package.
- **CI/CD Enhancement**: Added GitHub Actions workflow to automatically lint code, validate GSettings schemas, and build release packages.
- **EGO Compliance**: Improved asynchronous file reading and fixed `gettext` definition.
- **Improved Battery Detection**: Refactored automatic path detection to support BAT0, BAT1, and BAT2 more robustly.
- **Maintenance**: Fully cleaned up project root and removed obsolete/duplicate files.

## v14 (2025-12-27)
- Added debug mode toggle to show build info and enable logs
- Bumped version-name to 14 (skipped 13)
- Big restructure: moved extension sources into `extension/` as the single source of truth
- Updated build/package scripts to use the new layout
- Removed duplicate extension folder
