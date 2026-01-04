# Battery Power Monitor for GNOME Shell

[![Extension CI](https://github.com/DarkPhilosophy/batt-watt-power-monitor/actions/workflows/ci.yml/badge.svg)](https://github.com/DarkPhilosophy/batt-watt-power-monitor/actions/workflows/ci.yml)
[![GNOME Extensions](https://img.shields.io/badge/GNOME-Extensions-orange.svg)](https://extensions.gnome.org/extension/9023/battery-power-monitor/)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![GNOME 45-49](https://img.shields.io/badge/GNOME-45--49-blue.svg)](https://www.gnome.org/)
[![Version 14](https://img.shields.io/badge/Version-15-green.svg)](https://github.com/DarkPhilosophy/batt-watt-power-monitor)

**Battery Power Monitor** - A clean GNOME Shell extension showing battery percentage, time remaining, and real-time power consumption in the panel.

**Status**: **Live** on GNOME Extensions (ID: 9023).
[![Extension CI](https://github.com/DarkPhilosophy/batt-watt-power-monitor/actions/workflows/ci.yml/badge.svg)](https://github.com/DarkPhilosophy/batt-watt-power-monitor/actions/workflows/ci.yml)

## 🛡️ Validation Status
<!-- LINT-RESULT-START -->
### Latest Linting Result
> **Status**: ✅ **Passing**  
> **Date**: 2026-01-04 01:56:27 UTC  
> **Summary**: 0 errors, 0 warnings

<details>
<summary>Click to view full lint output</summary>

```
> batt-watt-power-monitor@15.0.0 lint
> eslint extension/
```

</details>
<!-- LINT-RESULT-END -->

## 🔋 Features

### Core Display
- **Battery Percentage**: Displays current battery charge level (%)
- **Time Remaining**: Shows estimated time to full charge or time remaining on battery (enabled by default)
- **Real-time Power Consumption**: Shows actual charging/discharging in Watts (+/-)
- **Battery Icon**: Visual indicator in GNOME Shell panel

### New in v14
- **Decimal Precision**: Toggle between integer (e.g., 16W) and precise 2-digit decimal (e.g., 15.75W) display.
- **Smart Formatting**: Hides 0.00W readings (idle/calculating).
- **Stability Fixes**: Resolved stuck power readings on certain hardware by enforcing synchronous file reads.

### Smart Controls
- **Update Interval**: Adjust refresh rate from 1 to 15 seconds (default: 10s)
- **Battery Selection**: Automatic or manual (BAT0, BAT1, BAT2)
- **Display Toggles**: Show/hide percentage, time, watts, or icon
- **Smart Hiding**: Hide indicator when charging, full, or idle

### GNOME Compatibility
- ✅ **GNOME 45** - Fully supported
- ✅ **GNOME 46** - Fully supported  
- ✅ **GNOME 47** - Fully supported
- ✅ **GNOME 48** - Fully supported
- ✅ **GNOME 49** - Fully supported

## 📸 Screenshot

![Batt-Watt Power Monitor Screenshot](Screenshot.png)

## ⚠️ Requirements

**GNOME Battery Percentage Must Be Enabled**

This extension requires GNOME's built-in battery percentage display to be enabled:

```bash
# Enable battery percentage in GNOME settings
gsettings set org.gnome.desktop.interface show-battery-percentage true

# Verify it's enabled
gsettings get org.gnome.desktop.interface show-battery-percentage
```

Without this setting enabled, the extension may not display correctly.

**Note**: After enabling, log out and log back in for changes to take effect.

## 🚀 Installation

### From GNOME Extensions Website (Recommended)
1. Visit: https://extensions.gnome.org/extension/9023/batt-watt-power-monitor/
2. Click the toggle to install
3. Restart GNOME Shell (Alt+F2, then type 'r' and press Enter)

### Manual Installation
1. Clone this repository:
   ```bash
   git clone https://github.com/DarkPhilosophy/batt-watt-power-monitor.git
   cd batt-watt-power-monitor
   ```
2. Build and install locally:
   ```bash
   ./build.sh
   ```
3. Restart GNOME Shell (Alt+F2, then type 'r' and press Enter)
4. Enable the extension using GNOME Tweaks or:
   ```bash
   gnome-extensions enable batt-watt-power-monitor@DarkPhilosophy
   ```

## ⚙️ Configuration

Access settings through:
- **GNOME Extensions App** (recommended)
- **GNOME Tweaks** → Extensions → Battery Consumption Watt Meter
- **Command line**: `gnome-extensions prefs batt-watt-power-monitor@DarkPhilosophy`

## 📂 Project Layout

Single source of truth for extension files lives in `extension/`:
- `extension/extension.js`
- `extension/prefs.js`
- `extension/metadata.json`
- `extension/schemas/`

Root directory keeps scripts and repo files only.

### Available Settings

| Setting | Description | Default |
|---------|-------------|---------|
| **Interval** | Update frequency in seconds (1-15) | 10s |
| **Show battery icon** | Display battery icon in panel | ON |
| **Show percentage** | Show battery charge percentage | ON |
| **Show time remaining** | Display estimated time remaining/to full | ON |
| **Show watts consumption** | Display power consumption in Watts | ON |
| **Enable 2-digit decimal** | Display precise wattage (e.g., 15.75W) | OFF |
| **Choose battery** | Select battery device (AUTOMATIC/BAT0/BAT1/BAT2) | AUTOMATIC |
| **Hide when charging** | Hide indicator when battery is charging | OFF |
| **Hide when full** | Hide indicator when battery is full | OFF |
| **Hide when idle** | Hide indicator when system is idle | OFF |

## 🔧 Building from Source

### Requirements
- GNOME Shell 45+
- Node.js (for version sync)
- glib-compile-schemas (glib2)

### Build Process

#### Fedora Atomic / Bazzite (rpm-ostree)
```bash
# Install dependencies using rpm-ostree
rpm-ostree install nodejs gettext

# Reboot to apply changes
systemctl reboot

# After reboot, build the extension
cd batt-watt-power-monitor
./build.sh
```

#### Traditional Fedora/RHEL
```bash
# Install dependencies
sudo dnf install nodejs gettext

# Build the extension
cd batt-watt-power-monitor
./build.sh
```

#### Debian/Ubuntu
```bash
# Install dependencies
sudo apt install nodejs gettext

# Build the extension
cd batt-watt-power-monitor
./build.sh
```

The build script will:
1. Install the extension locally
2. Compile GSettings schemas

## 📊 Technical Details

### How It Works
- Reads battery information from `/sys/class/power_supply/`
- Calculates real-time power consumption in Watts
- Updates the GNOME panel indicator at configurable intervals
- Uses UPower API for battery status monitoring

### Performance
- **Low CPU usage**: Optimized with rate limiting
- **Memory efficient**: Minimal footprint
- **Smart updates**: Only updates when battery status changes

## 🔍 Troubleshooting

### Common Issues

1. **Extension not showing**:
   - Check `gnome-extensions list`
   - Enable with `gnome-extensions enable batt-watt-power-monitor@DarkPhilosophy`
   - Restart GNOME Shell (Alt+F2, type 'r')

2. **No battery detected**:
   - Check `/sys/class/power_supply/` for battery devices
   - Verify battery is properly connected
   - Check `upower -i /org/freedesktop/UPower/devices/battery_BAT0`

3. **Battery percentage not showing**:
   - Enable GNOME battery percentage:
     ```bash
     gsettings set org.gnome.desktop.interface show-battery-percentage true
     ```
   - Log out and log back in for changes to take effect

4. **Incorrect power readings**:
   - Verify battery supports power reporting
   - Check `cat /sys/class/power_supply/BAT0/{current_now,voltage_now,power_now,status}`
   - Try different battery selection in settings

### Debugging Commands

```bash
# Check extension status
gnome-extensions list

# View extension logs
journalctl -f | grep BattWattPowerMonitor

# Check battery information
upower -i /org/freedesktop/UPower/devices/battery_BAT0

# Check sysfs battery data
cat /sys/class/power_supply/BAT0/{current_now,voltage_now,power_now,status}

# Restart GNOME Shell (safer alternative)
# Option 1: Log out and log back in (recommended)
# Option 2: Restart GNOME Shell (Alt+F2, then type 'r' and press Enter)
```

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/your-feature`
3. **Commit your changes**: `git commit -m 'Add some feature'`
4. **Push to the branch**: `git push origin feature/your-feature`
5. **Open a Pull Request**

### Development Setup
```bash
git clone https://github.com/DarkPhilosophy/batt-watt-power-monitor.git
cd batt-watt-power-monitor
npm install  # Install development dependencies
```

## 📝 Changelog

See [CHANGELOG.md](CHANGELOG.md).

## 📝 License

This project is licensed under the **GNU General Public License v3.0** - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Original author: [wennaspeedy](https://github.com/wennaspeedy)
- Previous maintainer: [ZachGoldberg](https://github.com/ZachGoldberg) for initial updates
- GNOME Shell development team
- All contributors and testers

## 🔮 Future Plans

- [ ] Color-coded warnings for high power consumption
- [ ] Historical power usage graphs
- [ ] Per-application power usage tracking
- [ ] Battery health monitoring
- [ ] Multi-battery system support improvements

## 📬 Contact

For issues, questions, or suggestions:
- **GitHub Issues**: https://github.com/DarkPhilosophy/batt-watt-power-monitor/issues
- **GNOME Extensions**: https://extensions.gnome.org/extension/9023/batt-watt-power-monitor/

## 💡 Tips

- Set a higher interval (8-10 seconds) for better battery life on laptops
- Use "Hide when full" to declutter your panel when battery is charged
- The extension works best with modern laptops that report accurate power data

---

**Maintained with ❤️ by [DarkPhilosophy](https://github.com/DarkPhilosophy)**