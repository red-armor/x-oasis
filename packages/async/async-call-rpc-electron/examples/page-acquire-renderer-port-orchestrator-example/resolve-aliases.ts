import { resolve } from 'path';
import fs from 'fs';

interface AliasMap {
  [key: string]: string;
}

export function resolveXOasisAliases(): AliasMap {
  const aliases: AliasMap = {};
  const packagesRoot = resolve(__dirname, '../../../..');
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
        const subDirs = fs
          .readdirSync(srcDir)
          .filter((name) => fs.statSync(resolve(srcDir, name)).isDirectory());
        for (const sub of subDirs) {
          const subIndexPath = resolve(srcDir, sub, 'index.ts');
          if (fs.existsSync(subIndexPath)) {
            aliases[`@x-oasis/${pkg}/${sub}`] = subIndexPath;
          }
        }
      }

      const srcPath = resolve(pkgPath, 'src/index.ts');
      if (fs.existsSync(srcPath)) {
        aliases[`@x-oasis/${pkg}`] = srcPath;
      }
    }
  }

  return aliases;
}
