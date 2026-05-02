---
layout: home

hero:
  name: x-oasis
  text: Comprehensive Utility Libraries
  tagline: 63+ practical packages organized into 17 categories for JavaScript/TypeScript development
  actions:
    - theme: brand
      text: Explore Packages
      link: /packages/
    - theme: alt
      text: View All Categories
      link: /packages/

features:
  - icon: 📦
    title: 63+ Utility Packages
    details: A complete collection of reusable, battle-tested utility functions for everyday development tasks
  - icon: 🎯
    title: Well-Organized
    details: Organized into 17 logical categories - find exactly what you need quickly
  - icon: 🛠️
    title: TypeScript Native
    details: Full TypeScript support with comprehensive type definitions for excellent IDE integration
  - icon: 🧪
    title: Thoroughly Tested
    details: Comprehensive test suites ensure reliability and stability across all packages
  - icon: 📚
    title: Excellent Documentation
    details: Clear examples, best practices, and common pitfalls for each utility
  - icon: 🚀
    title: Production Ready
    details: Used by real applications and optimized for performance and bundle size
---

## 📖 Getting Started

### Installation

Install any package individually:

```bash
npm install @x-oasis/package-name
```

### Usage Example

```typescript
import { isEmpty } from '@x-oasis/is-empty';
import { debounce } from '@x-oasis/debounce';

// Type checking
if (isEmpty(value)) {
  console.log('Value is empty');
}

// Debouncing
const debouncedSearch = debounce(async (query) => {
  const results = await api.search(query);
  updateResults(results);
}, 300);
```

## 💡 Why x-oasis?

- **Modular** - Use only what you need
- **Type-safe** - Full TypeScript support
- **Tested** - Comprehensive test coverage
- **Small** - Minimal bundle impact
- **Documented** - Clear examples and guides
- **Production-ready** - Used in real applications

## 🔗 Resources

- [GitHub Repository](https://github.com/red-armor/x-oasis)
- [GitHub Issues](https://github.com/red-armor/x-oasis/issues)
- [Discussions](https://github.com/red-armor/x-oasis/discussions)
