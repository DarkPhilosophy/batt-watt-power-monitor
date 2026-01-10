# Changelog

## v17 (2026-01-10) - EMERGENCY MEMORY LEAK FIX

> **CRITICAL SECURITY & STABILITY PATCH**

- **Memory Leak Fix**: SVG surfaces were reloaded on every repaint (~5 sec cycle) causing unbounded memory growth, leading to GNOME Shell crash (3.5GB accumulation). Now cached.
- **SVG Caching System**: Introduced `SVG_CACHE` Map with TTL (5min) and automatic purge mechanism. Surfaces cached by color+path hash, preventing reload cycles.
- **Memory Prevention Framework**: Added `purgeSvgCache()` with periodic cleanup (max 1x/min) to prevent cache unbounded growth.
- **Safe Cleanup**: `disable()` now explicitly clears SVG cache to prevent memory retention after unload.
- **Logging**: Added `[Memory Prevention]` debug logs for cache hit/purge events to monitor memory health.
- **Hard Cache Guard**: Added LRU-style cap, surface `finish()` on eviction, and color quantization to prevent unbounded SVG variants.
- **Performance Refactor**: DRY helpers for indicator status, Cairo clear, widget sizing, and cached sysfs path/status reads to reduce hot-path work.
- **Lint Pipeline**: Root ESLint config now covers `scripts/*.js`; CI lint output is plumbed into lint status updates.
- **Bug Fix**: Persisted "Show Colored" styling now resets on disable by restoring cached GNOME theme color.

> **Bug Fixes**:

- **Segmentation Fault (SIGSEGV)**: Fixed crash occurring after 37+ minutes of operation due to memory exhaustion.
- **Runaway Cairo Allocation**: SVG surfaces no longer re-allocated per frame; cached surfaces are reused.
- **Cache TTL Bounds**: Automatic expiry of unused SVG surfaces prevents indefinite memory accumulation.

## v16 (2026-01-09)

- **Logging**: Added structured log levels with timestamps, a UI log-level selector, and file logging with per-session rotation.
- **Visibility**: Respect hide-when-charging/full/idle by syncing indicator visibility with the override hook.
- **Display**: Avoid showing infinity when full; use percentage or blank depending on settings.
- **Show Battery Icon**: Hide only the icon/circular indicator without hiding text labels.
- **Show Colored**: Optional monochrome mode for the circular indicator ring/text.
- **Disable Cleanup**: Clear custom styles and restore default label visibility when disabling.
- **Icon Sizes**: Added size controls for battery and circular indicators.
- **Icon Percentage**: Option to show percentage inside the icon or outside as text.
- **Charging Bolt**: Show a bolt inside the battery icon while charging.
- **Settings Pages**: Added General and mode-specific settings pages with dynamic switching.
- **Battery Dimensions**: Separate width/height controls for the battery icon.
- **Debug Page**: Moved debug settings into a dedicated page.
- **Percentage Outside**: Percentage text now appears outside the icon even with circular mode enabled.
- **Circular Icon**: Larger inner battery icon with a visible, outlined charging bolt.
- **Overlay Layout**: The charging bolt is now an overlay badge, ensuring strict adherence to the configured battery width without expansion.
- **Procedural Stroke**: Implemented high-quality procedural outline for the charging bolt to ensure perfect visibility on all backgrounds.
- **Circular Text Outline**: Added a black outline to the circular percentage text to match the battery stroke.
- **Independent Sizing**: Battery Bar Width and Height settings are now fully decoupled, allowing precise aspect ratio control. Battery Circular Size setting controls the diameter of the circular indicator.
- **Settings Organization**: Preferences are now fracmented and restructured into dedicated **General**, **Battery Bar / Circular** (dynamic change), and **Debug** pages for better navigation.

> **Bug Fixes**:

- **Layout**: Fixed "Double Width" issue where specific combinations of settings caused the widget to expand incorrectly.
- **Rendering**: Fixed "Ghosting" and "Fill Outside" glitches caused by conflicting layout logic.
- **Z-Index**: Corrected drawing order so the charging bolt properly overlays the battery icon instead of being covered by it.
- **Alignment**: Fixed shifting issues when toggling text labels, ensuring the battery icon remains perfectly stable.
- **Logging Cleanup**: Removed legacy raw `console.log` traces. Better logging with structured log levels and timestamps.

## v15 (2026-01-04)

- **License Change**: Switched from MIT to **GNU GPLv3** to better align with the GNOME ecosystem's ideology of software freedom and ensure the project remains open-source forever.
- **Automatic Version Sync**: Version is now managed in `package.json` and automatically synchronized to all files (metadata, prefs, README, VERSION) during build/package.
- **CI/CD Enhancement**: Added GitHub Actions workflow to automatically lint code, validate GSettings schemas, and build release packages.
- **EGO Compliance**: Improved asynchronous file reading and fixed `gettext` definition.
- **Improved Battery Detection**: Refactored automatic path detection to support BAT0, BAT1, and BAT2 more robustly.
- **Version Status Tracking**: Added automated GNOME Extensions version comparison with visual badges (green for synced, yellow for pending release).
- **Circular Indicator**: Added optional color ring battery indicator with charging icon and percentage-in-ring support.
- **Display Behavior**: Fixed label visibility logic so time remaining and watts behave independently of percentage.
- **Visual Polish**: Improved spacing and sizing when the circular indicator is enabled.
- **Maintenance**: Fully cleaned up project root and removed obsolete/duplicate files.

## v14 (2025-12-27)

- Added debug mode toggle to show build info and enable logs
- Bumped version-name to 14 (skipped 13)
- Big restructure: moved extension sources into `extension/` as the single source of truth
- Updated build/package scripts to use the new layout
- Removed duplicate extension folder
