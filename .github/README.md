# Battery Power Monitor for GNOME Shell

[![Extension CI](https://github.com/DarkPhilosophy/batt-watt-power-monitor/actions/workflows/ci.yml/badge.svg)](https://github.com/DarkPhilosophy/batt-watt-power-monitor/actions/workflows/ci.yml)
[![GNOME Extensions](https://img.shields.io/badge/GNOME-Extensions-orange.svg)](https://extensions.gnome.org/extension/9023/battery-power-monitor/)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![GNOME 45-49](https://img.shields.io/badge/GNOME-45--49-blue.svg)](https://www.gnome.org/)
[![Version 17](https://img.shields.io/badge/Version-17-green.svg)](https://github.com/DarkPhilosophy/batt-watt-power-monitor)

**Battery Power Monitor** - A GNOME Shell extension showing battery percentage, time remaining, and real-time power consumption.

**Status**: **Live** on GNOME Extensions (ID: 9023).

<!-- EGO-VERSION-START -->
[![Status: Pending](https://img.shields.io/badge/Status-Pending-yellow)](https://extensions.gnome.org/extension/9023/batt-watt-power-monitor/) ![GitHub](https://img.shields.io/badge/GitHub-v17-blue) ![GNOME](https://img.shields.io/badge/GNOME-v14-green)
<!-- EGO-VERSION-END -->

## Validation Status

<!-- LINT-RESULT-START -->
### Linting Status
> **Status**: ✅ **Passing**  
> **Last Updated**: 2026-01-10 03:44:12 UTC  
> **Summary**: 0 errors, 0 warnings

<details>
<summary>Click to view full lint output</summary>

```
> batt-watt-power-monitor@17.0.0 lint
> eslint --config .eslintrc.yml extension scripts --format stylish --format stylish
```

</details>
<!-- LINT-RESULT-END -->

<!-- LATEST-VERSION-START -->
### Latest Update (v17)
- **Memory Leak Fix**: SVG surfaces were reloaded on every repaint (~5 sec cycle) causing unbounded memory growth, leading to GNOME Shell crash (3.5GB accumulation). Now cached.
- **SVG Caching System**: Introduced `SVG_CACHE` Map with TTL (5min) and automatic purge mechanism. Surfaces cached by color+path hash, preventing reload cycles.
- **Memory Prevention Framework**: Added `purgeSvgCache()` with periodic cleanup (max 1x/min) to prevent cache unbounded growth.
- **Safe Cleanup**: `disable()` now explicitly clears SVG cache to prevent memory retention after unload.
- **Logging**: Added `[Memory Prevention]` debug logs for cache hit/purge events to monitor memory health.
- **Hard Cache Guard**: Added LRU-style cap, surface `finish()` on eviction, and color quantization to prevent unbounded SVG variants.
- **Performance Refactor**: DRY helpers for indicator status, Cairo clear, widget sizing, and cached sysfs path/status reads to reduce hot-path work.
- **Lint Pipeline**: Root ESLint config now covers `scripts/*.js`; CI lint output is plumbed into lint status updates.
- **Bug Fix**: Persisted "Show Colored" styling now resets on disable by restoring cached GNOME theme color.
- **Segmentation Fault (SIGSEGV)**: Fixed crash occurring after 37+ minutes of operation due to memory exhaustion.
- **Runaway Cairo Allocation**: SVG surfaces no longer re-allocated per frame; cached surfaces are reused.
- **Cache TTL Bounds**: Automatic expiry of unused SVG surfaces prevents indefinite memory accumulation.
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
