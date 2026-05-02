# Skills

Problem-domain guides for solving common development challenges with x-oasis packages.

## What are Skills?

Skills are **problem-focused guides** (not package-focused). Each skill teaches you how to solve a specific problem using the right combination of x-oasis packages.

Instead of "use @x-oasis/debounce", we show "here's how to prevent excessive API calls" with patterns and best practices.

## Core Skills

### 1. Type Validation
**How to safely handle different value types**

- Check if values are null, undefined, empty
- Validate function arguments
- Create type-safe guards
- Handle optional chaining

*Related packages*: is-empty, is-null, is-boolean, is-string, is-number, etc.

### 2. Request Throttling
**How to control operation frequency**

- Debounce search inputs (wait for pause)
- Throttle scroll/resize events (fixed intervals)
- Batch API requests
- Prevent duplicate submissions

*Related packages*: debounce, throttle, batchinator, delay

### 3. Event Management
**How to reliably build event systems**

- Create event emitters
- Subscribe to events with cleanup
- Prevent memory leaks
- Handle error propagation

*Related packages*: emitter, disposable, once-subscription

### 4. Stream Processing
**How to efficiently handle data streams**

- Process async iterables
- Handle backpressure
- Transform streaming data
- Combine multiple streams

*Related packages*: async-iterable, stream utilities

### 5. Change Detection
**How to track state modifications**

- Detect object changes
- Track array mutations
- Implement reactive systems
- Diff before/after states

*Related packages*: diff-match-patch, html-fragment-diff, map-diff-range

### 6. Object Comparison
**How to efficiently compare values**

- Check for shallow equality
- Deep equality comparison
- Custom comparators
- Memoization optimization

*Related packages*: shallow-equal, equal, deep-equal

### 7. Functional Programming
**How to elegantly transform data**

- Map, filter, reduce
- Pipe operations
- Function composition
- Immutable transformations

*Related packages*: group-by, unique-by, chunk, flatten

## Why Skills Instead of Packages?

| Question | Answer |
|----------|--------|
| "How do I prevent search box from making too many API calls?" | See **Request Throttling** skill |
| "How do I prevent memory leaks with event listeners?" | See **Event Management** skill |
| "How do I check if a value is null or undefined?" | See **Type Validation** skill |
| "Which package has this function?" | Check the skill's "Related packages" section |

## Using Skills

1. **Identify your problem** - What are you trying to solve?
2. **Find the matching skill** - Look at the skills list above
3. **Learn the patterns** - Read the skill guide with examples
4. **Choose packages** - Pick the right package for your use case
5. **Implement** - Follow the examples and best practices

## Skill Features

Each skill includes:

- **When to use** - Scenarios and problems it solves
- **Quick start** - 5-minute working example
- **Patterns** - 8+ real-world patterns with code
- **Best practices** - ✅ Do's and ❌ Don'ts
- **Common pitfalls** - Mistakes to avoid
- **Framework integration** - React, Vue, Svelte, Node.js examples

## Coming Soon

More skills are being documented to cover:

- DOM manipulation
- Prototype operations
- Data structure usage
- Layout and dimensions
- And more...

## Learn More

- [Packages](/packages/) - Browse all packages
- [async-call-rpc](/packages/async/async-call-rpc/) - Deep dive into RPC communication
- [GitHub](https://github.com/d-band/x-oasis) - Source code and issues
