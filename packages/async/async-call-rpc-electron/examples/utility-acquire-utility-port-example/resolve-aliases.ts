import { resolve } from 'path';
import fs from 'fs';

interface AliasMap {
  [key: string]: string;
}

/**
 * 动态解析 @x-oasis/* 包的源文件路径
 * 为开发环境总是使用源文件，以支持热刷新
 */
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
      const srcPath = resolve(pkgPath, 'src/index.ts');

      // 只要 src 存在，就使用源文件（用于开发环境的热刷新）
      if (fs.existsSync(srcPath)) {
        aliases[`@x-oasis/${pkg}`] = srcPath;
      }
    }
  }

  return aliases;
}
