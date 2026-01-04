# Contributing to Battery Consumption Watt Meter

First of all, thank you for considering contributing to this project! 🎉

## 📋 Table of Contents

- [Code of Conduct](#-code-of-conduct)
- [How Can I Contribute?](#-how-can-i-contribute)
- [Development Setup](#-development-setup)
- [Coding Guidelines](#-coding-guidelines)
- [Commit Message Guidelines](#-commit-message-guidelines)
- [Pull Request Process](#-pull-request-process)
- [Testing](#-testing)
- [Documentation](#-documentation)

## 🤝 Code of Conduct

This project follows the [Contributor Covenant](https://www.contributor-covenant.org/) code of conduct. By participating, you are expected to uphold this code. Please report unacceptable behavior to [DarkPhilosophy](https://github.com/DarkPhilosophy).

## 🤔 How Can I Contribute?

### Reporting Bugs

- **Use the bug report template** in the issue tracker
- **Include detailed information**: GNOME version, extension version, steps to reproduce
- **Provide logs** from `journalctl -f` or Looking Glass
- **Check existing issues** before creating a new one

### Suggesting Enhancements

- **Use the feature request template**
- **Describe the problem** you're trying to solve
- **Propose a solution** if you have one
- **Consider alternatives** and trade-offs

### Code Contributions

- **Fork the repository** and create your branch from `main`
- **Follow coding guidelines** (see below)
- **Write tests** for new features
- **Update documentation** as needed

## 🔧 Development Setup

### Prerequisites

- GNOME Shell 45+
- Node.js 18+
- Git
- Meson build system
- GNOME development tools

### Setup Instructions

```bash
# Clone the repository
git clone https://github.com/DarkPhilosophy/batt-watt-power-monitor.git
cd batt-watt-power-monitor

# Install dependencies (Fedora/RHEL)
sudo dnf install nodejs npm meson gettext gnome-extensions-devel

# Install dependencies (Debian/Ubuntu)
sudo apt install nodejs npm meson gettext gnome-shell-extension-tool

# Install Node.js dependencies
npm install

# Build the extension
./build.sh
```

### Development Workflow

1. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** and commit them:
   ```bash
   git commit -m "feat: add amazing new feature"
   ```

3. **Test your changes** thoroughly

4. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

5. **Open a Pull Request**

## 📝 Coding Guidelines

### JavaScript/TypeScript

- Use ES6+ features
- Follow GNOME Shell coding conventions
- Use meaningful variable names
- Add JSDoc comments for complex functions
- Keep functions small and focused

### GNOME Shell Specific

- Use `import` statements for GNOME modules
- Follow GNOME Shell's async patterns
- Handle errors gracefully
- Clean up resources in `destroy()` methods

### Code Formatting

- 4-space indentation
- No trailing whitespace
- Consistent brace style
- Semicolons at end of statements

## 💬 Commit Message Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>
[optional body]
[optional footer]
```

### Common Types

- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `style`: Changes that do not affect the meaning of the code
- `refactor`: A code change that neither fixes a bug nor adds a feature
- `perf`: A code change that improves performance
- `test`: Adding missing tests or correcting existing tests
- `chore`: Changes to the build process or auxiliary tools

### Examples

```bash
git commit -m "feat: add battery health monitoring"
git commit -m "fix: correct watt calculation for charging state"
git commit -m "docs: update README with installation instructions"
git commit -m "refactor: improve battery detection logic"
```

## 🔄 Pull Request Process

1. **Ensure your code follows guidelines**
2. **Update documentation** if needed
3. **Add tests** for new functionality
4. **Update the README** if you add new features
5. **Reference related issues** in your PR description
6. **Be responsive** to feedback and review comments

### Pull Request Template

```markdown
## Description

[Clear description of what this PR does]

## Related Issues

[List any related issues, e.g., Fixes #123]

## Changes Made

- [ ] Added new feature X
- [ ] Fixed bug Y
- [ ] Updated documentation
- [ ] Added tests

## Testing

[Describe how you tested your changes]

## Screenshots (if applicable)

[Add screenshots showing the changes]

## Checklist

- [ ] Code follows project guidelines
- [ ] Tests pass
- [ ] Documentation updated
- [ ] No breaking changes
```

## 🧪 Testing

### Manual Testing

1. Install the extension in development mode:
   ```bash
   ln -s ~/path/to/batt_consumption_wattmetter/batt_consumption_wattmetter@DarkPhilosophy.shell-extension ~/.local/share/gnome-shell/extensions/
   ```

2. Restart GNOME Shell (Alt+F2, then type 'r')

3. Test all features with different configurations

### Automated Testing

Run the test suite:
```bash
npm test
```

### Test Coverage

- Test with different GNOME versions (45-49)
- Test with different battery types
- Test edge cases (no battery, multiple batteries)

## 📚 Documentation

### Updating Documentation

- Keep README.md up to date
- Update screenshots if UI changes
- Document new features and settings
- Update installation instructions if dependencies change

### Documentation Standards

- Use clear, concise language
- Include examples where helpful
- Keep screenshots current
- Use proper Markdown formatting

## 🙏 Recognition

All contributors will be recognized in the project's CONTRIBUTORS.md file and in the extension's about dialog.

## 🤝 Community

Join our community discussions:
- GitHub Discussions
- GNOME Extensions forum
- Matrix/IRC channels (if available)

Thank you for contributing to Battery Consumption Watt Meter! 🚀