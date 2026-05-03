import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { globSync } from 'glob';
import matter from 'gray-matter';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEBSITE_PACKAGES_DIR = path.resolve(__dirname, '../src/packages');
const SIDEBAR_OUTPUT = path.resolve(
  __dirname,
  '../src/.vitepress/sidebar-auto.json'
);

interface SidebarItem {
  text: string;
  link?: string;
  items?: SidebarItem[];
  collapsed?: boolean;
}

interface DocFile {
  relativePath: string; // relative to package dir
  fullPath: string; // absolute path
  frontmatter: Record<string, any>;
}

function listDirectories(parent: string): string[] {
  return globSync(`${parent}/*`)
    .filter((p) => {
      try {
        return fsSync.statSync(p).isDirectory();
      } catch {
        return false;
      }
    })
    .sort();
}

async function readFrontmatter(filePath: string): Promise<Record<string, any>> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const { data } = matter(content);
    return data || {};
  } catch {
    return {};
  }
}

function toTitleCase(s: string): string {
  return s
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function getDisplayTitle(
  filePath: string,
  frontmatter: Record<string, any>
): string {
  if (frontmatter?.title) {
    return frontmatter.title;
  }
  const basename = path.basename(filePath, '.md');
  return toTitleCase(basename);
}

function getPathLink(relativePathFromWebsiteSrc: string): string {
  // file path: foo/bar/index.md       -> /packages/foo/bar/
  // file path: foo/bar/baz.md         -> /packages/foo/bar/baz/
  // file path: foo/bar/sub/qux.md     -> /packages/foo/bar/sub/qux/
  const normalized = relativePathFromWebsiteSrc.replace(/\\/g, '/');
  let link = `/packages/${normalized}`;
  link = link.replace(/\/index\.md$/, '/');
  link = link.replace(/\.md$/, '/');
  if (!link.endsWith('/')) link += '/';
  return link;
}

async function buildHierarchy(docFiles: DocFile[]): Promise<SidebarItem[]> {
  const hierarchy = new Map<string, DocFile[]>();

  for (const file of docFiles) {
    const dir = path.dirname(file.relativePath);
    const key = dir === '.' ? 'root' : dir;
    if (!hierarchy.has(key)) {
      hierarchy.set(key, []);
    }
    hierarchy.get(key)!.push(file);
  }

  const rootFiles = hierarchy.get('root') || [];
  rootFiles.sort((a, b) => {
    const aIsIndex = path.basename(a.relativePath) === 'index.md' ? -1 : 1;
    const bIsIndex = path.basename(b.relativePath) === 'index.md' ? -1 : 1;
    if (aIsIndex !== bIsIndex) return aIsIndex - bIsIndex;

    const aOrder = a.frontmatter?.order ?? 999;
    const bOrder = b.frontmatter?.order ?? 999;
    if (aOrder !== bOrder) return aOrder - bOrder;

    return getDisplayTitle(a.fullPath, a.frontmatter).localeCompare(
      getDisplayTitle(b.fullPath, b.frontmatter)
    );
  });

  const items: SidebarItem[] = [];

  for (const file of rootFiles) {
    const basename = path.basename(file.relativePath);
    if (basename === 'index.md') {
      // Skip — index.md represents the package root itself, surfaced via the package link
      continue;
    }
    const relativeFromWebsite = path.relative(
      WEBSITE_PACKAGES_DIR,
      file.fullPath
    );
    items.push({
      text: getDisplayTitle(file.fullPath, file.frontmatter),
      link: getPathLink(relativeFromWebsite),
    });
  }

  const subdirs = Array.from(hierarchy.entries())
    .filter(([key]) => key !== 'root')
    .sort(([a], [b]) => a.localeCompare(b));

  for (const [dirName, files] of subdirs) {
    files.sort((a, b) => {
      const aIsIndex = path.basename(a.relativePath) === 'index.md' ? -1 : 1;
      const bIsIndex = path.basename(b.relativePath) === 'index.md' ? -1 : 1;
      if (aIsIndex !== bIsIndex) return aIsIndex - bIsIndex;

      const aOrder = a.frontmatter?.order ?? 999;
      const bOrder = b.frontmatter?.order ?? 999;
      if (aOrder !== bOrder) return aOrder - bOrder;

      return getDisplayTitle(a.fullPath, a.frontmatter).localeCompare(
        getDisplayTitle(b.fullPath, b.frontmatter)
      );
    });

    const subItems: SidebarItem[] = [];
    for (const file of files) {
      const basename = path.basename(file.relativePath);
      if (basename === 'index.md') continue;
      const relativeFromWebsite = path.relative(
        WEBSITE_PACKAGES_DIR,
        file.fullPath
      );
      subItems.push({
        text: getDisplayTitle(file.fullPath, file.frontmatter),
        link: getPathLink(relativeFromWebsite),
      });
    }

    if (subItems.length === 0) continue;

    items.push({
      text: toTitleCase(path.basename(dirName)),
      collapsed: false,
      items: subItems,
    });
  }

  return items;
}

async function processPackageDocs(
  categoryName: string,
  packageName: string
): Promise<SidebarItem[]> {
  const packageDocDir = path.join(
    WEBSITE_PACKAGES_DIR,
    categoryName,
    packageName
  );

  const docFiles = globSync(`${packageDocDir}/**/*.md`).sort();
  if (docFiles.length === 0) return [];

  const filesWithMetadata: DocFile[] = [];
  for (const filePath of docFiles) {
    const relativePath = path.relative(packageDocDir, filePath);
    const frontmatter = await readFrontmatter(filePath);
    filesWithMetadata.push({
      relativePath,
      fullPath: filePath,
      frontmatter,
    });
  }

  return buildHierarchy(filesWithMetadata);
}

async function generateSidebar(): Promise<void> {
  console.log('📋 Generating sidebar configuration...');

  const categoryDirs = listDirectories(WEBSITE_PACKAGES_DIR);

  const sidebar: SidebarItem[] = [];

  let totalPackages = 0;

  for (const categoryDir of categoryDirs) {
    const categoryName = path.basename(categoryDir);
    const packageDirs = listDirectories(categoryDir);
    if (packageDirs.length === 0) continue;

    const categoryItem: SidebarItem = {
      text: toTitleCase(categoryName),
      link: `/packages/${categoryName}/`,
      collapsed: false,
      items: [],
    };

    for (const packageDir of packageDirs) {
      const packageName = path.basename(packageDir);
      totalPackages += 1;

      const docs = await processPackageDocs(categoryName, packageName);
      const packageLink = `/packages/${categoryName}/${packageName}/`;

      if (docs.length === 0) {
        // No additional docs beyond index — single clickable entry
        categoryItem.items!.push({
          text: packageName,
          link: packageLink,
        });
      } else {
        // Has sub-docs — clickable parent with collapsible children
        categoryItem.items!.push({
          text: packageName,
          link: packageLink,
          collapsed: false,
          items: docs,
        });
      }
    }

    sidebar.push(categoryItem);
  }

  const outputDir = path.dirname(SIDEBAR_OUTPUT);
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(SIDEBAR_OUTPUT, JSON.stringify(sidebar, null, 2), 'utf-8');

  console.log(`✅ Sidebar configuration generated: ${SIDEBAR_OUTPUT}`);
  console.log(`   Categories: ${sidebar.length}`);
  console.log(`   Total packages: ${totalPackages}`);
}

export { generateSidebar };

if (import.meta.url === `file://${process.argv[1]}`) {
  generateSidebar().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
