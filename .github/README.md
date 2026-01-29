# Battery Power Monitor for GNOME Shell

[![Extension CI](https://github.com/DarkPhilosophy/batt-watt-power-monitor/actions/workflows/ci.yml/badge.svg)](https://github.com/DarkPhilosophy/batt-watt-power-monitor/actions/workflows/ci.yml)
[![GNOME Extensions](https://img.shields.io/badge/GNOME-Extensions-orange.svg)](https://extensions.gnome.org/extension/9023/battery-power-monitor/)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![GNOME 45-49](https://img.shields.io/badge/GNOME-45--49-blue.svg)](https://www.gnome.org/)

**Battery Power Monitor** - A GNOME Shell extension showing battery percentage, time remaining, and real-time power consumption.

**Status**: **Live** on GNOME Extensions (ID: 9023).

<!-- EGO-VERSION-START -->
[![Status: Pending](https://img.shields.io/badge/Status-Pending-yellow)](https://extensions.gnome.org/extension/9023/batt-watt-power-monitor/) ![GitHub](https://img.shields.io/badge/GitHub-v21-blue) ![GNOME](https://img.shields.io/badge/GNOME-v14-green)
<!-- EGO-VERSION-END -->

## Features

-   **Battery Percentage**: Shows the current battery percentage.
-   **Time Remaining**: Displays the estimated time remaining until the battery is fully charged or discharged.
-   **Power Consumption**: Shows the current power consumption in Watts.
-   **Indicator**: Shows a simple percentage indicator in the panel (configurable).
-   **Positioning**: Choose to place the indicator on the Left or Right of the QuickSettings area.

## Validation Status

<!-- LINT-RESULT-START -->
### Linting Status
> **Status**: ✅ **Passing**  
> **Last Updated**: 2026-01-29 14:56:05 UTC  
> **Summary**: 0 errors, 0 warnings

<details>
<summary>Click to view full lint output</summary>

```
> batt-watt-power-monitor@21.0.0 lint:fix
> eslint --fix extension .scripts --format stylish
```

</details>
<!-- LINT-RESULT-END -->

<!-- LATEST-VERSION-START -->
<details open>
<summary><strong>Latest Update (v21)</strong></summary>

- Attach the first real PreferencesPage to the window (avoids Adw warnings without dummy pages).
- Logging UI: Open Log Folder + Clear Log File actions (shown only when debug + file logging enabled).
- Log file path resolution now respects custom paths and defaults to cache directory when empty.

</details>
<!-- LATEST-VERSION-END -->


![Batt-Watt Screenshot](../.screenshot/Screenshot.png)

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
