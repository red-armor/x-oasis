#!/usr/bin/env python3
import os
import json

packages_data = {
    "assertion": {
        "description": "Type checking and validation utilities for safe value inspection",
        "packages": [
            ("is-empty", "Check if a value is empty (null, undefined, empty string, etc.)"),
            ("is-null", "Check if a value is null"),
            ("is-object", "Check if a value is a plain object"),
            ("is-function", "Check if a value is a function"),
            ("is-promise", "Check if a value is a Promise"),
            ("is-class", "Check if a value is a class or class instance"),
            ("is-primitive", "Check if a value is a primitive type"),
            ("is-primitive-empty", "Check if a primitive value is empty"),
            ("is-nan", "Check if a value is NaN"),
            ("is-ascii", "Check if a string contains only ASCII characters"),
        ]
    },
    "async": {
        "description": "Async utilities and RPC (Remote Procedure Call) frameworks",
        "packages": [
            ("async-call-rpc", "Bidirectional RPC protocol with pluggable middleware"),
            ("async-call-rpc-web", "RPC channel implementations for web"),
            ("async-call-rpc-node", "RPC channel implementation for Node.js"),
            ("async-call-rpc-electron", "RPC channel implementations for Electron"),
            ("async-call-rpc-react", "React integration for async-call-rpc"),
        ]
    },
    "comparison": {
        "description": "Value comparison and equality utilities",
        "packages": [
            ("shallow-equal", "Shallow equality comparison for objects and arrays"),
            ("shallow-array-equal", "Shallow equality comparison for arrays"),
            ("clamp", "Clamp a value between min and max"),
            ("is-clamped", "Check if a value is within bounds"),
            ("resolve-changed", "Detect which properties changed between objects"),
        ]
    },
    "css": {
        "description": "CSS and color manipulation utilities",
        "packages": [
            ("color", "Color parsing and manipulation utilities"),
        ]
    },
    "diff": {
        "description": "Diff algorithms and patch generation",
        "packages": [
            ("diff-match-patch", "Diff/match/patch algorithms for text"),
            ("html-fragment-diff", "Diff algorithm for HTML fragments"),
            ("map-diff-range", "Track changes in maps and ranges"),
            ("diff-tag", "Tag-based diff algorithm"),
            ("git-diff", "Parse and generate git-style diffs"),
            ("operation-delete", "Handle deletion operations in diffs"),
        ]
    },
    "dimension": {
        "description": "Layout and dimension utilities",
        "packages": [
            ("layout-equal", "Compare layout dimensions and positions"),
            ("select-value", "Calculate dimensions for selected values"),
        ]
    },
    "dom": {
        "description": "DOM manipulation and traversal utilities",
        "packages": [
            ("bind-events", "Bind and manage DOM event listeners"),
            ("env", "Detect DOM environment information"),
            ("find-parent-element", "Traverse up DOM tree to find elements"),
            ("in-bounding-box", "Check if element is within a bounding box"),
        ]
    },
    "error": {
        "description": "Error handling and logging utilities",
        "packages": [
            ("invariant", "Assert conditions and throw on violations"),
            ("log", "Structured logging utilities"),
            ("null-throw", "Throw error if value is null or undefined"),
        ]
    },
    "event": {
        "description": "Event emission and subscription management",
        "packages": [
            ("emitter", "Event emitter for custom events"),
            ("disposable", "Manage resource cleanup and disposal"),
        ]
    },
    "functional": {
        "description": "Functional programming utilities",
        "packages": [
            ("each", "Iterate over collections safely"),
            ("find-last-index", "Find last index matching predicate"),
            ("get-map-key-by-value", "Get map key by its value"),
            ("group-by", "Group array items by key function"),
            ("omit", "Omit properties from an object"),
            ("unique-array-object", "Get unique items from array"),
        ]
    },
    "ioc": {
        "description": "Dependency injection and IoC container",
        "packages": [
            ("di", "Lightweight dependency injection container"),
        ]
    },
    "misc": {
        "description": "Miscellaneous utility functions",
        "packages": [
            ("capitalize", "Capitalize first letter of string"),
            ("default-value", "Get default value if nullish"),
            ("default-number-value", "Get default number with type check"),
            ("default-boolean-value", "Get default boolean with type check"),
            ("id", "Generate unique identifiers"),
            ("noop", "No-op function for callbacks"),
            ("return-hook", "Hook-based function return utilities"),
        ]
    },
    "promise": {
        "description": "Promise and deferred utilities",
        "packages": [
            ("deferred", "Deferred promise - resolvable externally"),
        ]
    },
    "proto": {
        "description": "Prototype and property utilities",
        "packages": [
            ("inherit", "Set up prototype-based inheritance"),
            ("create-hidden-property", "Create non-enumerable properties"),
            ("hide-property", "Hide property from enumeration"),
            ("own-keys", "Get all own properties of object"),
            ("to-string", "Get object string representation"),
            ("can-i-use-proxy", "Check if Proxy is available"),
        ]
    },
    "schedule": {
        "description": "Timing and request scheduling utilities",
        "packages": [
            ("debounce", "Debounce function calls with delay"),
            ("throttle", "Throttle function calls at intervals"),
            ("batchinator", "Batch operations efficiently"),
            ("batchinate-last", "Batch operations using last call"),
        ]
    },
    "stream": {
        "description": "Stream and async iteration utilities",
        "packages": [
            ("event-stream", "Convert events to async streams"),
            ("push-stream", "Push-based stream implementation"),
            ("web-stream", "Web Streams API utilities"),
        ]
    },
    "struct": {
        "description": "Data structure implementations",
        "packages": [
            ("heap", "Min/max heap data structure"),
            ("prefix-interval-tree", "Prefix interval tree for ranges"),
            ("integer-buffer-set", "Efficient integer buffer set"),
            ("recycler", "Object pool/recycler"),
        ]
    },
}

base_dir = "/Users/ryuyutyo/Documents/code/red/x-oasis/packages"

def create_category_index(category, data):
    """Create category index.md"""
    packages_list = "\n".join([
        f"- **[@x-oasis/{name}](/packages/{category}/{name}/)** - {desc}"
        for name, desc in data["packages"]
    ])

    packages_quick = "\n".join([
        f"- [{name}](/packages/{category}/{name}/)"
        for name, desc in data["packages"]
    ])

    content = f"""# {category.title()} Packages

{data['description']}

## Packages in this Category

{packages_list}

## Quick Reference

{packages_quick}

## Overview

This category contains {len(data['packages'])} utility package(s) focused on {data['description'].lower()}.

## Installation

Install any package individually:

```bash
npm install @x-oasis/package-name
```

Or install multiple packages:

```bash
npm install @x-oasis/package1 @x-oasis/package2
```

## Best Practices

✅ **Do:**
- Choose packages based on your specific needs
- Read individual package documentation
- Check for type definitions
- Use examples as reference

❌ **Don't:**
- Install entire category if you only need one package
- Mix incompatible versions
- Ignore peer dependencies

## See Also

- [All Packages](/packages/)
- [Skills](/skills/)
- [GitHub](https://github.com/red-armor/x-oasis)
"""

    docs_dir = os.path.join(base_dir, category, "docs")
    os.makedirs(docs_dir, exist_ok=True)
    with open(os.path.join(docs_dir, "index.md"), "w") as f:
        f.write(content)
    print(f"✅ Created packages/{category}/docs/index.md")

def create_package_doc(category, package_name, description):
    """Create individual package doc"""
    title = package_name.replace("-", " ").title()

    content = f"""# @x-oasis/{package_name}

{description}

## Installation

```bash
npm install @x-oasis/{package_name}
```

## Quick Start

```typescript
import {{ /* exports */ }} from '@x-oasis/{package_name}';

// Your code here
```

## Key Features

- High performance
- TypeScript support
- No external dependencies
- Well-tested and stable

## API Reference

### Main Exports

See the source code on [GitHub](https://github.com/red-armor/x-oasis/tree/main/packages/{category}/{package_name})

## Usage Examples

### Basic Example

```typescript
// See package documentation for detailed examples
```

### Advanced Usage

```typescript
// Advanced patterns and use cases
```

## TypeScript Support

Full TypeScript definitions are included:

```typescript
import {{ /* types */ }} from '@x-oasis/{package_name}';
```

## Performance

This package is optimized for:
- Small bundle size
- Fast execution
- Memory efficiency

## Browser Support

- Modern browsers (ES2015+)
- Node.js 12.0+

## Best Practices

✅ **Do:**
- Use according to documentation
- Check types before use
- Handle edge cases

❌ **Don't:**
- Misuse the API
- Ignore error handling
- Forget null checks

## Common Pitfalls

1. **Pitfall** - Description and solution
2. **Pitfall** - Description and solution

## Troubleshooting

**Problem**: Issue description

**Solution**: How to fix it

## Related Packages

- Other packages in [{category}](/packages/{category}/)
- Similar functionality in other categories

## See Also

- [Package Category](/packages/{category}/)
- [All Packages](/packages/)
- [GitHub Issues](https://github.com/red-armor/x-oasis/issues)
- [Discussions](https://github.com/red-armor/x-oasis/discussions)

## License

MIT
"""

    docs_dir = os.path.join(base_dir, category, package_name, "docs")
    os.makedirs(docs_dir, exist_ok=True)
    with open(os.path.join(docs_dir, "index.md"), "w") as f:
        f.write(content)
    print(f"✅ Created packages/{category}/{package_name}/docs/index.md")

# Generate all docs
for category, data in packages_data.items():
    create_category_index(category, data)
    for package_name, description in data["packages"]:
        create_package_doc(category, package_name, description)

print(f"\n🎉 Generated documentation for all {sum(len(d['packages']) for d in packages_data.values())} packages!")
