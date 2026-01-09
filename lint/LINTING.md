# Linting Guide (npm scripts)

For configuration file details, see **[README.md](./README.md)**.

## Quick Commands

```bash
# Run linting checks
npm run lint

# Auto-fix fixable issues
npm run lint:fix

# Update .github/README.md with lint results
npm run lint:status
```

## Details

- **`npm run lint`** - Runs eslint with extension config
  - Uses `lint/eslintrc-extension.yml` for JavaScript code
  - Exits with code 1 if errors found

- **`npm run lint:fix`** - Auto-fixes issues in-place
  - Fixes formatting (indentation, spacing, etc.)
  - Fixes auto-fixable rule violations
  - Requires manual review of larger changes

- **`npm run lint:status`** - Updates README with lint results
  - Runs linter and captures output
  - Updates `.github/README.md` with status badge and details
  - Runs in CI even if lint fails (to report status)

## Best Practices

1. **Before committing code**: Run `npm run lint:fix` to auto-fix issues
2. **Review changes**: Check that auto-fixes are correct
3. **Add JSDoc**: All functions need proper documentation
   ```javascript
   /**
    * Description of what function does.
    * @param {type} name - Parameter description
    * @returns {type} Return value description
    */
   function myFunction(name) { ... }
   ```
4. **Check CI**: Push and verify GitHub Actions lint step passes
5. **README updates**: CI automatically updates `.github/README.md` with lint status

## Troubleshooting

### "npm run lint" fails locally
- Make sure dependencies are installed: `npm install`
- Check Node.js version: `node --version` (should be ≥18)
- Clear cache: `rm -rf node_modules && npm install`

### ESLint config error
- Ensure YAML file in `lint/eslintrc-extension.yml` is valid
- Run with verbose: `npx eslint --debug --config lint/eslintrc-extension.yml extension/`

### Auto-fix doesn't work
- Some rules (like JSDoc) require manual fixes
- Run `npm run lint` to see which rules failed
- Manually add missing `@param` and `@returns` tags

## Contributing

When adding new code:
1. Write functions with complete JSDoc blocks
2. Follow the naming conventions (camelCase for vars)
3. Run `npm run lint:fix` before committing
4. Ensure CI passes

## See Also

- [README.md](./README.md) - Configuration details and GNOME compliance
- [.github/workflows/ci.yml](../.github/workflows/ci.yml) - CI/CD integration
