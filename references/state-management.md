# State Management Library Comparison

## Overview

| Library | Bundle Size | Boilerplate | Learning Curve | TypeScript | Best For |
|---------|-------------|-------------|----------------|------------|----------|
| Context API | 0 KB (built-in) | Low | Low | Native | Simple shared state, theme, auth |
| Redux Toolkit | ~11 KB | Medium | Medium | Excellent | Complex apps, predictable state, devtools |
| Zustand | ~1 KB | Very Low | Low | Good | Medium apps, hook-based access |
| Jotai | ~3 KB | Very Low | Low | Good | Atomic state, fine-grained reactivity |

## Context API

**Pros**:
- Built into React, no extra dependency
- Simple mental model
- Works well for low-frequency updates (theme, locale, auth)

**Cons**:
- All consumers re-render on any context value change
- No built-in selector mechanism
- Not ideal for high-frequency updates

**When to use**: Props drilled through 2-3 levels, low update frequency, shared config.

## Redux Toolkit

**Pros**:
- Predictable state updates via reducers
- Excellent devtools (time travel, action replay)
- Middleware ecosystem (thunks, sagas)
- Selector memoization via reselect

**Cons**:
- More boilerplate than alternatives
- Learning curve for actions/reducers/selectors
- May be overkill for simple state

**When to use**: Large applications, complex state logic, team needs strict patterns.

## Zustand

**Pros**:
- Minimal API surface (~1 KB)
- Hook-based access with built-in selectors
- No Provider wrapper needed
- Works outside React (vanilla JS)

**Cons**:
- Fewer devtools than Redux
- Less structured than Redux for large teams
- Middleware API less mature

**When to use**: Medium apps wanting simplicity, replacing Context for perf reasons.

## Jotai

**Pros**:
- Atomic model — fine-grained reactivity
- Minimal re-renders (only affected atoms)
- Composable derived atoms
- Simple async atom support

**Cons**:
- Atom proliferation in large apps
- Less familiar mental model
- Debugging can be harder

**When to use**: Apps needing fine-grained reactivity, many independent state pieces.

## Decision Matrix

```
Is the state shared across many components?
├── No → Keep as local state (useState)
├── Yes → How many components consume it?
    ├── 2-5 → Context API
    ├── 5-20 → Zustand or Jotai
    └── 20+ → Redux Toolkit
        └── Need devtools/middleware? → Redux
        └── Prefer simplicity? → Zustand
```
