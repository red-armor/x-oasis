import { resolve } from 'path';
import fs from 'fs';

import type { Alias } from 'vite';

export function resolveXOasisAliases(): Alias[] {
  const aliases: Alias[] = [];
  const packagesRoot = resolve(__dirname, '../../../../..');
  const categoriesDir = fs.readdirSync(packagesRoot).filter((name) => {
    return (
      fs.statSync(resolve(packagesRoot, name)).isDirectory() &&
      !name.startsWith('.')
    );
  });

  for (const category of categoriesDir) {
    const categoryPath = resolve(packagesRoot, category);
    const packages = fs.readdirSync(categoryPath).filter((name) => {
      return (
        fs.statSync(resolve(categoryPath, name)).isDirectory() &&
        !name.startsWith('.')
      );
    });

    for (const pkg of packages) {
      const pkgPath = resolve(categoryPath, pkg);
      const srcDir = resolve(pkgPath, 'src');

      if (fs.existsSync(srcDir)) {
        const entries = fs.readdirSync(srcDir);
        for (const entry of entries) {
          const entryPath = resolve(srcDir, entry);
          const stat = fs.statSync(entryPath);
          if (stat.isDirectory()) {
            const subEntries = fs.readdirSync(entryPath);
            for (const subEntry of subEntries) {
              const subEntryPath = resolve(entryPath, subEntry);
              const subStat = fs.statSync(subEntryPath);
              if (subStat.isDirectory()) {
                const nestedIndex = resolve(subEntryPath, 'index.ts');
                if (fs.existsSync(nestedIndex)) {
                  aliases.push({
                    find: `@x-oasis/${pkg}/${entry}/${subEntry}`,
                    replacement: nestedIndex,
                  });
                }
              } else if (
                subEntry.endsWith('.ts') &&
                !subEntry.endsWith('.d.ts') &&
                !subEntry.endsWith('.test.ts')
              ) {
                const withoutExt = subEntry.replace(/\.ts$/, '');
                if (withoutExt !== 'index') {
                  aliases.push({
                    find: `@x-oasis/${pkg}/${entry}/${withoutExt}`,
                    replacement: subEntryPath,
                  });
                }
              }
            }

            const subIndexPath = resolve(entryPath, 'index.ts');
            if (fs.existsSync(subIndexPath)) {
              aliases.push({
                find: `@x-oasis/${pkg}/${entry}`,
                replacement: subIndexPath,
              });
            }
          } else if (
            entry.endsWith('.ts') &&
            !entry.endsWith('.d.ts') &&
            !entry.endsWith('.test.ts')
          ) {
            const withoutExt = entry.replace(/\.ts$/, '');
            if (withoutExt !== 'index') {
              aliases.push({
                find: `@x-oasis/${pkg}/${withoutExt}`,
                replacement: entryPath,
              });
            }
          }
        }
      }

      const srcPath = resolve(pkgPath, 'src/index.ts');
      if (fs.existsSync(srcPath)) {
        aliases.push({
          find: `@x-oasis/${pkg}`,
          replacement: srcPath,
        });
      }
    }
  }

  aliases.push({
    find: '@shared-ui',
    replacement: resolve(__dirname, '../../shared-ui'),
  });
  aliases.push({ find: '@', replacement: resolve(__dirname, 'src') });

  aliases.sort((a, b) => (b.find as string).length - (a.find as string).length);

  return aliases;
}
