# Battery Power Monitor for GNOME Shell

[![Extension CI](https://github.com/DarkPhilosophy/batt-watt-power-monitor/actions/workflows/ci.yml/badge.svg)](https://github.com/DarkPhilosophy/batt-watt-power-monitor/actions/workflows/ci.yml)
[![GNOME Extensions](https://img.shields.io/badge/GNOME-Extensions-orange.svg)](https://extensions.gnome.org/extension/9023/battery-power-monitor/)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![GNOME 45-49](https://img.shields.io/badge/GNOME-45--49-blue.svg)](https://www.gnome.org/)
[![Version 14](https://img.shields.io/badge/Version-15-green.svg)](https://github.com/DarkPhilosophy/batt-watt-power-monitor)

**Battery Power Monitor** - A GNOME Shell extension showing battery percentage, time remaining, and real-time power consumption.

**Status**: **Live** on GNOME Extensions (ID: 9023).

<!-- EGO-VERSION-START -->
[![Status: Pending](https://img.shields.io/badge/Status-Pending-yellow)](https://extensions.gnome.org/extension/9023/batt-watt-power-monitor/) ![GitHub](https://img.shields.io/badge/GitHub-v15-blue) ![GNOME](https://img.shields.io/badge/GNOME-v14-green)
<!-- EGO-VERSION-END -->

## Validation Status

<!-- LINT-RESULT-START -->
### Latest Linting Result
> **Status**: ✅ **Passing**  
> **Date**: 2026-01-04 06:16:35 UTC  
> **Summary**: 0 errors, 0 warnings

<details>
<summary>Click to view full lint output</summary>

```
> batt-watt-power-monitor@15.0.0 lint
> eslint extension/
```

</details>
<!-- LINT-RESULT-END -->

<!-- LATEST-VERSION-START -->
### Latest Update (v15)
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
<!-- LATEST-VERSION-END -->

## Install

- GNOME Extensions: <https://extensions.gnome.org/extension/9023/batt-watt-power-monitor/>
- Local build:

  ```bash
  ./build.sh
  ```

## Project Docs

- [Changelog](.github/CHANGELOG.md)
- [Contributing](.github/CONTRIBUTING.md)
- [Third-party notices](.github/THIRD_PARTY_NOTICES.md)
- [License](LICENSE)
