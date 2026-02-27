# React Prop Drilling Patterns

## What is Prop Drilling?

Prop drilling occurs when a React component passes data through multiple intermediate components
that don't use the data themselves, just to reach a deeply nested component that needs it.

## Common Patterns

### 1. Parent → Child → Grandchild Chain
The most basic form: `App` passes `theme` to `Layout`, which passes it to `Sidebar`,
which passes it to `NavItem`. Only `NavItem` actually uses `theme`.

**Severity**: Medium
**Solution**: Context API or Zustand store

### 2. Multiple Props Drilled Together
A group of related props (e.g., `user`, `isLoggedIn`, `onLogout`) drilled through
3+ levels together.

**Severity**: High — indicates missing shared state
**Solution**: Combined Context or Redux slice

### 3. Callback Drilling
Event handlers like `onClick`, `onChange` passed down through intermediaries.

**Severity**: Medium-High — can cause unnecessary re-renders
**Solution**: Context with memoized callbacks, or Jotai atoms with write functions

### 4. Spread Props Anti-pattern
Using `{...props}` to forward all props, hiding what's actually needed.

**Severity**: High — makes dependencies invisible
**Solution**: Explicit prop extraction + Context for shared state

### 5. Optional Prop Tunneling
Props that are optional at every level but required at the leaf.
Results in `undefined` cascading silently through the tree.

**Severity**: Low-Medium
**Solution**: Context with typed defaults

## Detection Heuristics

| Pattern | Detection Signal | Score Weight |
|---------|-----------------|--------------|
| Chain drilling | Same prop name in parent and child component | 30% |
| Batch drilling | 3+ props passed from parent to same child | 25% |
| Callback drilling | `on*` props passed to non-leaf components | 20% |
| Spread forwarding | `{...props}` in JSX attributes | 15% |
| Deep nesting | Component tree depth > 3 with shared props | 10% |
