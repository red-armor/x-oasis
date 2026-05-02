# x-oasis Website Documentation

This directory contains the centralized documentation website for the x-oasis project, built with VitePress + React.

## Quick Start

### Development

```bash
# Install dependencies (from project root)
pnpm install

# Start development server
npm run docs:dev

# Access at http://localhost:5173
```

### Build

```bash
# Build for production
npm run docs:build

# Preview production build
npm run docs:preview
```

## Structure

```
website/
├── .vitepress/
│   ├── config.ts           # VitePress configuration
│   ├── theme/
│   │   ├── index.ts        # Theme setup
│   │   └── custom.css      # Custom styles
│   └── public/             # Static assets
├── src/
│   ├── index.md            # Homepage
│   ├── packages/           # Package documentation
│   │   ├── async/
│   │   │   ├── async-call-rpc/
│   │   │   │   ├── index.md
│   │   │   │   ├── middleware/
│   │   │   │   │   ├── overview.md
│   │   │   │   │   ├── sender-pipeline.md
│   │   │   │   │   ├── receiver-pipeline.md
│   │   │   │   │   └── custom-middleware.md
│   │   │   │   ├── examples.md
│   │   │   │   └── api.md
│   │   │   └── ... (other packages)
│   └── skills/             # Problem domain documentation
├── package.json
├── tsconfig.json
├── vite.config.ts
└── index.html
```

## Writing Documentation

### Creating a New Package Documentation

1. Create a new directory: `src/packages/{category}/{package-name}/`
2. Add an `index.md` file with:
   - Package overview
   - Key features
   - Quick start example
   - Links to detailed docs

3. Create subdirectories for topics (e.g., `middleware/`, `examples/`)
4. Link to the documentation in the package README

### Documentation Standards

- **Clarity**: Write for developers unfamiliar with the package
- **Examples**: Include practical, working code examples
- **Completeness**: Document all major features and patterns
- **Navigation**: Provide clear links between related pages
- **Searchability**: Use descriptive headings and keywords

## Configuration

### VitePress Config

Edit `.vitepress/config.ts` to:
- Change site title and description
- Modify navigation menu
- Configure sidebar structure
- Update theme colors

### Markdown Extensions

All standard Markdown works, plus:

```typescript
// Import and use Vue/React components
import MyComponent from '@/components/MyComponent.vue'

<MyComponent />
```

## Integration with Monorepo

### Commands from Root

```bash
# From project root
npm run docs:dev      # Start dev server
npm run docs:build    # Build documentation
npm run docs:preview  # Preview production build
```

### Turbo Integration

The `docs:build` task is integrated with Turbo for:
- Caching documentation builds
- Dependency tracking
- Parallel builds with other tasks

## Best Practices

### ✅ Do

- Update documentation when code changes
- Use clear, descriptive headings
- Include working code examples
- Link to related documentation
- Keep examples up-to-date
- Document edge cases and common pitfalls

### ❌ Don't

- Copy documentation from elsewhere without updating
- Leave broken links
- Include outdated API references
- Mix different documentation styles
- Duplicate information across pages

## Adding to Website

To add new package documentation:

1. Create `src/packages/{category}/{package}/index.md`
2. Add sidebar entry in `.vitepress/config.ts`
3. Update package README with link to website
4. Test locally with `npm run docs:dev`

## Deployment

The website is built with:

```bash
npm run docs:build
```

Output is generated in `.vitepress/dist/` for deployment to hosting services.

## Support

For questions about:
- **Structure & Guidelines**: See [AGENTS.md](/../../AGENTS.md)
- **Architecture**: See [package documentation](./src/)
- **VitePress**: See [VitePress docs](https://vitepress.dev/)
