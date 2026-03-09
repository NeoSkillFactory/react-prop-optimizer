# react-prop-optimizer

![Audit](https://img.shields.io/badge/audit%3A%20PASS-brightgreen) ![License](https://img.shields.io/badge/license-MIT-blue) ![OpenClaw](https://img.shields.io/badge/OpenClaw-skill-orange)

> Automatically analyzes React component prop usage patterns and generates optimized prop drilling alternatives using Context API or state management libraries.

## Features

- Analyze React component files to detect prop drilling patterns and usage frequency
- Generate Context API implementations with proper Provider and Consumer components
- Create alternative solutions using popular state management libraries (Redux, Zustand, Jotai)
- Optimize prop drilling by identifying unnecessary intermediate components
- Output optimized component code with TypeScript interfaces and proper typing
- Validate generated solutions against React best practices

## Usage

```bash
# Analyze a single component file
node scripts/main.js analyze --file path/to/Component.jsx

# Analyze a directory of components
node scripts/main.js analyze --dir path/to/components/

# Generate Context API alternative
node scripts/main.js generate --file path/to/Component.jsx --strategy context

# Generate state management alternative (redux, zustand, jotai)
node scripts/main.js generate --file path/to/Component.jsx --strategy zustand

# Full pipeline: analyze + generate + validate
node scripts/main.js optimize --file path/to/Component.jsx
```

## GitHub

Source code: [github.com/NeoSkillFactory/react-prop-optimizer](https://github.com/NeoSkillFactory/react-prop-optimizer)

**Price suggestion:** $19.99 USD

## License

MIT © NeoSkillFactory
