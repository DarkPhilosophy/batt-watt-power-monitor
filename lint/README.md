# GNOME Extension Linting Configuration

Universal, GNOME-compliant ESLint configurations for GNOME Shell extensions.

**Based on**: [GNOME Shell Extensions Guidelines](https://gitlab.gnome.org/GNOME/gnome-shell-extensions/tree/main/lint)

## Configuration Files

### `eslintrc-extension.yml`
**For**: `extension.js`, `prefs.js`, and user-facing extension code

**JSDoc Level**: **WARNING** (relaxed)
- Allows extension code to develop without strict documentation requirements
- Focuses on code formatting and quality checks
- Suitable for rapid development and iteration

**Key Rules**:
- Single quotes, 4-space indent
- Template literals required (`prefer-template`)
- Arrow functions encouraged
- Proper formatting enforced

### `eslintrc-gjs.yml`
**For**: Core/library code, GObject classes, internal systems

**JSDoc Level**: **ERROR** (strict)
- Requires full JSDoc documentation with types and descriptions
- Enforces GNOME Shell extension standards
- Suitable for stable, reusable code

**Key Rules**:
- All rules from `eslintrc-extension.yml`
- **PLUS** strict JSDoc requirements:
  - `@param {Type} name - description` required
  - `@returns {Type}` required for non-void functions
  - JSDoc present on all functions/methods

### `eslintrc-shell.yml`
**For**: GNOME Shell integration code (if modifying Shell itself)

**JSDoc Level**: NONE
- Minimal JSDoc enforcement
- Shell-specific globals and rules

## Usage

### Run All Checks
```bash
bash lint_check.sh
```

### Run Specific Config
```bash
npx eslint --config lint/eslintrc-extension.yml extension/
```

### Auto-Fix Issues
```bash
npx eslint --config lint/eslintrc-gjs.yml --fix extension/
```

## Quick Integration into New Projects

1. **Copy the `lint/` directory**:
   ```bash
   cp -r lint/ /path/to/new-project/
   ```

2. **Copy `lint_check.sh`**:
   ```bash
   cp lint_check.sh /path/to/new-project/
   chmod +x /path/to/new-project/lint_check.sh
   ```

3. **Install dependencies** (if not already done):
   ```bash
   npm install --save-dev eslint eslint-plugin-jsdoc
   ```

4. **Run the linter**:
   ```bash
   ./lint_check.sh
   ```

## GNOME Compliance Summary

| Rule Category | Level | Details |
|---|---|---|
| **Formatting** | STRICT | Spacing, indentation, braces, quotes |
| **Code Quality** | STRICT | No dead code, proper error handling |
| **Naming** | STRICT | camelCase, clear variable names |
| **JSDoc (Extension)** | WARNING | Encouraged but not enforced |
| **JSDoc (GJS/Core)** | STRICT | Full documentation required |

## Extending the Configuration

### For a New Project Type
Create `eslintrc-custom.yml`:
```yaml
extends: "eslint:recommended"
plugins:
  - jsdoc
rules:
  # Inherit from extension by default
  jsdoc/require-jsdoc: warn
  # Override as needed
  my-custom-rule: error
```

Then update `lint_check.sh` to include it.

## Troubleshooting

### "Missing JSDoc" Errors
Add JSDoc comments above functions:
```javascript
/**
 * Calculates the battery percentage.
 *
 * @param {number} current - Current capacity in mAh
 * @param {number} max - Maximum capacity in mAh
 * @returns {number} Battery percentage (0-100)
 */
function getBatteryPercentage(current, max) {
    return (current / max) * 100;
}
```

### "Invalid JSDoc Type"
Use standard JSDoc types:
- `{string}`, `{number}`, `{boolean}`, `{Array}`, `{Object}`
- `{string|null}` for unions
- `{number[]}` for arrays
- `{Promise<string>}` for promises

### Auto-Fix Doesn't Work
Some rules require manual fixes (e.g., JSDoc descriptions). Check:
```bash
npx eslint --config lint/eslintrc-gjs.yml extension/ 2>&1 | grep -E "error|warning"
```

## References

- [GNOME Shell Extensions](https://gitlab.gnome.org/GNOME/gnome-shell-extensions)
- [ESLint Docs](https://eslint.org)
- [JSDoc Reference](https://jsdoc.app)
