---
name: react-prop-optimizer
description: Automatically analyzes React component prop usage patterns and generates optimized prop drilling alternatives using Context API or state management libraries.
---

# React Prop Optimizer

## Core Capabilities
- Analyze React component files to detect prop drilling patterns and usage frequency
- Generate Context API implementations with proper Provider and Consumer components
- Create alternative solutions using popular state management libraries (Redux, Zustand, Jotai)
- Optimize prop drilling by identifying unnecessary intermediate components
- Output optimized component code with TypeScript interfaces and proper typing
- Validate generated solutions against React best practices

## Out of Scope
- Runtime performance optimization beyond prop drilling patterns
- Integration with specific build tools or bundlers
- Automated testing of generated solutions
- Non-React JavaScript frameworks

## Trigger Scenarios
- "Optimize this React component's prop drilling"
- "How can I reduce prop drilling in these components?"
- "Generate Context API alternatives for these prop patterns"
- "Show me state management alternatives for this component tree"
- "Analyze and refactor prop usage in my React components"

## Required Resources
- `scripts/` — Core implementation logic and CLI interface
- `references/` — React patterns and state management documentation
- `assets/` — Example component files and test cases

## Key Files
- `scripts/main.js` — Entry point and CLI interface
- `scripts/react-analyzer.js` — React component analysis and prop pattern detection
- `scripts/context-generator.js` — Context API implementation generator
- `scripts/state-mgmt-generator.js` — State management library alternative generator
- `scripts/code-validator.js` — Validation of generated solutions
- `scripts/utils.js` — Helper functions for AST parsing and code generation

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
