# Battery Power Monitor for GNOME Shell

[![Extension CI](https://github.com/DarkPhilosophy/batt-watt-power-monitor/actions/workflows/ci.yml/badge.svg)](https://github.com/DarkPhilosophy/batt-watt-power-monitor/actions/workflows/ci.yml)
[![GNOME Extensions](https://img.shields.io/badge/GNOME-Extensions-orange.svg)](https://extensions.gnome.org/extension/9023/battery-power-monitor/)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![GNOME 45-49](https://img.shields.io/badge/GNOME-45--49-blue.svg)](https://www.gnome.org/)
[![Version 18](https://img.shields.io/badge/Version-18-green.svg)](https://github.com/DarkPhilosophy/batt-watt-power-monitor)

**Battery Power Monitor** - A GNOME Shell extension showing battery percentage, time remaining, and real-time power consumption.

**Status**: **Live** on GNOME Extensions (ID: 9023).

<!-- EGO-VERSION-START -->
[![Status: Pending](https://img.shields.io/badge/Status-Pending-yellow)](https://extensions.gnome.org/extension/9023/batt-watt-power-monitor/) ![GitHub](https://img.shields.io/badge/GitHub-v18-blue) ![GNOME](https://img.shields.io/badge/GNOME-v14-green)
<!-- EGO-VERSION-END -->

## Validation Status

<!-- LINT-RESULT-START -->
### Linting Status
> **Status**: ✅ **Passing**  
> **Last Updated**: 2026-01-17 12:04:36 UTC  
> **Summary**: 0 errors, 0 warnings

<details>
<summary>Click to view full lint output</summary>

```
> batt-watt-power-monitor@18.0.0 lint:fix
> eslint --fix extension .scripts --format stylish
```

</details>
<!-- LINT-RESULT-END -->

<!-- LATEST-VERSION-START -->
<details open>
<summary><strong>Latest Update (v18)</strong></summary>

- **Synchronous Core Architecture**:
    - **The Change**: We completely removed the asynchronous `idle_add` pattern used in v17. The UI `updateUI` function is now fully synchronous.
    - **Why Better (Determinism)**: Asynchronous updates introduced "desync" race conditions where the internal state (battery level) and visual state (icon) could drift apart during rapid changes. Sync updates ensure atomic consistency—what you see is exactly what the system reports, instantly.
    - **Trade-off Mitigation**: While synchronous drawing on the main thread carries a risk of UI lag, we mitigated this by enforcing strict **SVG Caching**. Since heavy rendering is cached, the synchronous update is extremely lightweight (~microsecond scale), giving us the best of both worlds: instant updates with zero performance penalty.
- **Global Visibility Logic Refactor**:
    - **Previous Flaw**: Hiding the indicator in v17 occasionally left "phantom" spacing or failed to override GNOME's native icon fully because the override hook wasn't strictly enforced.
    - **The Fix**: The `sync.js` module now enforces a strict "nothing to show" contract. When "Hide when Charging" is active, the extension explicitly returns false to GNOME Shell's visibility checks, ensuring a cleaner panel layout.
- **Modular Library Architecture**:
    - **Refactor**: We have moved away from the monolithic `extension.js` design. Core logic is now split into specific modules under `extension/library/`: `drawing` (Cairo/SVG), `sync` (GNOME overrides), `indicators` (Battery/Circle), `system` (Panel), and `upower` (Device).
    - **Why**: This separation of concerns allows for safer feature additions, easier debugging, and reusable components (like the new `Logger` and `Settings` modules) without risking the stability of the main extension entry point.
- **Memory Prevention Strategy**:
    - **Refactor**: Wired the v17 `SVG_CACHE` logic directly into the main update loop via `purgeSvgCache()`.
    - **Why**: Caching without cleanup is just a memory leak by another name. v18 actively prunes unused surfaces (every 60s) and forces a deep clean on disable. This makes the extension robust enough for weeks of continuous runtime without bloating the heap.
- **Visual Refinement**:
    - **Centered Bolt**: The charging bolt icon is now perfectly centered within the battery bar.
    - **Dynamic Text Sizing**: Percentage text in the battery bar now adapts to both width and height, maximizing readability while preventing overflow on narrow configurations.
- **Build & Integrity System**:
    - **Schema Validation**: Introduced `.build-schema.json` to enforce strict file inclusion rules. The build pipeline now recursively scans the `extension/` directory and fails if any unknown or unexpected files are present.
    - **EGO Compliance**: This mechanism guarantees that release artifacts are clean, containing only the files explicitly required by GNOME Shell, adhering to Extension.gnome.org (EGO) review guidelines.
- **Cleanup**:
    - **Renamed**: 
        - `scripts/` to `.scripts/` 
        - `screenshot/` to `.screenshot/`
    - **Why**: To de-clutter the root directory.
- **Defaults**:
    - **Updated default dimensions** to 34x40 (Bar) and 36 (Circle) for better out-of-the-box aesthetics.
    - **Why**: These dimensions provide a good balance between visibility and minimalism, ensuring the extension is both functional and aesthetically pleasing.
- **Refactoring settings**:
    - **Added icons and vertical settings** panel to use the new `Settings` module.
    - **Why**: This refactoring improves the maintainability and scalability of the settings panel, making it easier to add new options and features in the future.
- **Upgrading the ESLint config**:
    - **ESLint 9.0.0**: Upgraded to the latest version of ESLint.
    - **Why**: This upgrade ensures that the codebase adheres to the latest best practices and standards, improving code quality and maintainability.
- **Upgrading the build pipeline**:
    - **Why**: This upgrade ensures that the codebase adheres to the latest best practices and standards, improving code quality and maintainability.

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
