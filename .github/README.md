# Battery Power Monitor for GNOME Shell

[![Extension CI](https://github.com/DarkPhilosophy/batt-watt-power-monitor/actions/workflows/ci.yml/badge.svg)](https://github.com/DarkPhilosophy/batt-watt-power-monitor/actions/workflows/ci.yml)
[![GNOME Extensions](https://img.shields.io/badge/GNOME-Extensions-orange.svg)](https://extensions.gnome.org/extension/9023/battery-power-monitor/)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![GNOME 45-49](https://img.shields.io/badge/GNOME-45--49-blue.svg)](https://www.gnome.org/)
[![Version 14](https://img.shields.io/badge/Version-16-green.svg)](https://github.com/DarkPhilosophy/batt-watt-power-monitor)

**Battery Power Monitor** - A GNOME Shell extension showing battery percentage, time remaining, and real-time power consumption.

**Status**: **Live** on GNOME Extensions (ID: 9023).

<!-- EGO-VERSION-START -->
[![Status: Pending](https://img.shields.io/badge/Status-Pending-yellow)](https://extensions.gnome.org/extension/9023/batt-watt-power-monitor/) ![GitHub](https://img.shields.io/badge/GitHub-v16-blue) ![GNOME](https://img.shields.io/badge/GNOME-v14-green)
<!-- EGO-VERSION-END -->

## Validation Status

<!-- LINT-RESULT-START -->
### Latest Linting Result
> **Status**: ✅ **Passing**  
> **Date**: 2026-01-09 13:09:20 UTC  
> **Summary**: 0 errors, 0 warnings

<details>
<summary>Click to view full lint output</summary>

```
> batt-watt-power-monitor@16.0.0 lint
> eslint --config lint/eslintrc-extension.yml extension/
```

</details>
<!-- LINT-RESULT-END -->

<!-- LATEST-VERSION-START -->
### Latest Update (v16)
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
- **Layout**: Fixed "Double Width" issue where specific combinations of settings caused the widget to expand incorrectly.
- **Rendering**: Fixed "Ghosting" and "Fill Outside" glitches caused by conflicting layout logic.
- **Z-Index**: Corrected drawing order so the charging bolt properly overlays the battery icon instead of being covered by it.
- **Alignment**: Fixed shifting issues when toggling text labels, ensuring the battery icon remains perfectly stable.
- **Logging Cleanup**: Removed legacy raw `console.log` traces. Better logging with structured log levels and timestamps.
<!-- LATEST-VERSION-END -->

## Configuration

### General

| Setting | Default | Description |
| :--- | :--- | :--- |
| **Interval** | `10` | Refresh rate in seconds. |
| **Show Icon** | `true` | Toggle the panel icon. |
| **Use Circular Indicator** | `false` | Replace battery icon with a circular meter. |
| **Show Colored** | `false` | Enable colored ring/text. Disable for monochrome. |
| **Show Percentage** | `true` | Show battery percentage text. |
| **Percentage Outside** | `false` | Show percentage text adjacent to the icon. |
| **Time Remaining** | `true` | Show time to full/empty. |
| **Show Watts** | `true` | Show power consumption in Watts. |
| **Show Decimals** | `false` | Show wattage with 2 decimal places. |
| **Hide Charging** | `false` | Hide indicator while charging. |
| **Hide Full** | `false` | Hide indicator when fully charged. |
| **Hide Idle** | `false` | Hide indicator when not charging/discharging. |
| **Battery** | `0` (Auto) | Select battery device (0=Auto, 1=BAT0, etc). |

### Battery Bar / Circular

| Setting | Default | Description |
| :--- | :--- | :--- |
| **Battery Width** | `27` | Width of the battery icon (Bar mode). |
| **Battery Height** | `33` | Height of the battery icon (Bar mode). |
| **Circular Size** | `27` | Diameter of the circular indicator (Circular mode). |

### Debug

| Setting | Default | Description |
| :--- | :--- | :--- |
| **Enable Debug** | `false` | Enable build info and logs. |
| **Force Bolt** | `false` | Always show charging bolt. |
| **Log Level** | `1` | 0=Verbose, 1=Debug, 2=Info, 3=Warn, 4=Error. |
| **Log to File** | `true` | Write debug logs to file. |
| **Log File Path** | `''` | Custom path (empty = default cache). |

## Install

- GNOME Extensions: <https://extensions.gnome.org/extension/9023/batt-watt-power-monitor/>
- Local build:

  ```bash
  ./build.sh
  ```

## Project Docs

- [Changelog](CHANGELOG.md)
- [Contributing](CONTRIBUTING.md)
- [Third-party notices](THIRD_PARTY_NOTICES.md)
- [License](../LICENSE)
