import path from 'path';

export interface DocPathMap {
  relativeFromPackages: string;
  targetPath: string;
}

export function mapDocPath(
  packagesDir: string,
  websitePackagesDir: string,
  docFile: string
): DocPathMap | null {
  const relativeFromPackages = path.relative(packagesDir, docFile);
  const parts = relativeFromPackages.split(path.sep);

  if (parts.length >= 4 && parts[2] === 'docs') {
    const [category, packageName, , ...rest] = parts;
    return {
      relativeFromPackages,
      targetPath: path.join(websitePackagesDir, category, packageName, ...rest),
    };
  }

  if (parts.length >= 3 && parts[1] === 'docs') {
    const [category, , ...rest] = parts;
    return {
      relativeFromPackages,
      targetPath: path.join(websitePackagesDir, category, ...rest),
    };
  }

  return null;
}
