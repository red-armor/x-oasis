import fs from 'fs/promises';
import path from 'path';
import { globSync } from 'glob';
import matter from 'gray-matter';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEBSITE_PACKAGES_DIR = path.resolve(__dirname, '../src/packages');
const SIDEBAR_OUTPUT = path.resolve(__dirname, '../.vitepress/sidebar-auto.ts');

interface SidebarItem {
  text: string;
  link?: string;
  items?: SidebarItem[];
}

async function readFrontmatter(
  filePath: string
): Promise<Record<string, any> | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const { data } = matter(content);
    return data;
  } catch (err) {
    return null;
  }
}

function getDisplayTitle(
  filePath: string,
  frontmatter: Record<string, any>
): string {
  // Prefer frontmatter title, fallback to filename
  if (frontmatter?.title) {
    return frontmatter.title;
  }

  const basename = path.basename(filePath, '.md');
  // Convert kebab-case to Title Case
  return basename
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function getPathLink(relativePathFromWebsiteSrc: string): string {
  // Convert file path to URL path
  // async/async-call-rpc/index.md -> /packages/async/async-call-rpc/
  // async/async-call-rpc/api.md -> /packages/async/async-call-rpc/api/
  // async/async-call-rpc/middleware/overview.md -> /packages/async/async-call-rpc/middleware/overview/

  const normalized = relativePathFromWebsiteSrc.replace(/\\/g, '/'); // Windows support
  let link = `/packages/${normalized}`;

  // Remove .md extension
  link = link.replace(/\.md$/, '');

  // For index files, keep directory structure and add trailing slash
  if (!link.endsWith('/')) {
    link += '/';
  }

  return link;
}

interface DocFile {
  relativePath: string; // relative to package dir
  fullPath: string; // absolute path
  frontmatter: Record<string, any>;
}

async function buildHierarchy(docFiles: DocFile[]): Promise<SidebarItem[]> {
  // Group files by directory
  const hierarchy = new Map<string, DocFile[]>();

  for (const file of docFiles) {
    const dir = path.dirname(file.relativePath);
    const key = dir === '.' ? 'root' : dir;

    if (!hierarchy.has(key)) {
      hierarchy.set(key, []);
    }
    hierarchy.get(key)!.push(file);
  }

  // Sort root files specially - index.md first, then others
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

  // Process root files
  for (const file of rootFiles) {
    const basename = path.basename(file.relativePath);
    if (basename === 'index.md') {
      // Skip index.md - it's the package itself
      continue;
    }

    const relativeFromWebsite = path.relative(
      WEBSITE_PACKAGES_DIR,
      file.fullPath
    );
    const link = getPathLink(relativeFromWebsite);
    const title = getDisplayTitle(file.fullPath, file.frontmatter);

    items.push({
      text: title,
      link,
    });
  }

  // Process subdirectories
  const subdirs = Array.from(hierarchy.entries())
    .filter(([key]) => key !== 'root')
    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB));

  for (const [dirName, files] of subdirs) {
    // Sort files in this directory
    files.sort((a, b) => {
      const aOrder = a.frontmatter?.order ?? 999;
      const bOrder = b.frontmatter?.order ?? 999;
      if (aOrder !== bOrder) return aOrder - bOrder;

      return getDisplayTitle(a.fullPath, a.frontmatter).localeCompare(
        getDisplayTitle(b.fullPath, b.frontmatter)
      );
    });

    const subItems: SidebarItem[] = [];

    for (const file of files) {
      const relativeFromWebsite = path.relative(
        WEBSITE_PACKAGES_DIR,
        file.fullPath
      );
      const link = getPathLink(relativeFromWebsite);
      const title = getDisplayTitle(file.fullPath, file.frontmatter);

      subItems.push({
        text: title,
        link,
      });
    }

    // Add directory with its items
    const dirDisplay = dirName
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    items.push({
      text: dirDisplay,
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

  if (docFiles.length === 0) {
    return [];
  }

  // Read all files with metadata
  const filesWithMetadata: DocFile[] = [];

  for (const filePath of docFiles) {
    const relativePath = path.relative(packageDocDir, filePath);
    const frontmatter = await readFrontmatter(filePath);

    filesWithMetadata.push({
      relativePath,
      fullPath: filePath,
      frontmatter: frontmatter || {},
    });
  }

  // Build hierarchy structure
  return buildHierarchy(filesWithMetadata);
}

async function generateSidebar(): Promise<void> {
  console.log('📋 Generating sidebar configuration...');

  const categoryDirs = globSync(`${WEBSITE_PACKAGES_DIR}/*`, {
    onlyDirectories: true,
  }).sort();

  const sidebar: SidebarItem[] = [
    {
      text: 'Overview',
      items: [
        {
          text: 'All Packages',
          link: '/packages/',
        },
      ],
    },
  ];

  let totalPackages = 0;

  // Process each category
  for (const categoryDir of categoryDirs) {
    const categoryName = path.basename(categoryDir);
    const packageDirs = globSync(`${categoryDir}/*`, {
      onlyDirectories: true,
    }).sort();

    const categoryItem: SidebarItem = {
      text: categoryName
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' '),
      items: [
        {
          text: 'Overview',
          link: `/packages/${categoryName}/`,
        },
      ],
    };

    // Process each package in this category
    for (const packageDir of packageDirs) {
      const packageName = path.basename(packageDir);
      totalPackages += 1;

      const docs = await processPackageDocs(categoryName, packageName);

      const packageItems = categoryItem.items;
      if (!packageItems) continue;

      if (docs.length === 0) {
        // Package with no docs
        packageItems.push({
          text: packageName,
          link: `/packages/${categoryName}/${packageName}/`,
        });
      } else if (docs.length === 1 && !docs[0].items) {
        // Single doc file
        packageItems.push({
          text: docs[0].text,
          link: docs[0].link,
        });
      } else {
        // Multiple docs or nested structure - create hierarchy
        packageItems.push({
          text: packageName
            .split('-')
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' '),
          items: docs,
        });
      }
    }

    sidebar.push(categoryItem);
  }

  // Generate TypeScript code
  const code = `// Auto-generated sidebar configuration
// Run 'npm run generate-sidebar' to update
// Last updated: ${new Date().toISOString()}

export const sidebarConfig = ${JSON.stringify(sidebar, null, 2)} as const;
`;

  // Write output
  const outputDir = path.dirname(SIDEBAR_OUTPUT);
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(SIDEBAR_OUTPUT, code, 'utf-8');

  console.log(`✅ Sidebar configuration generated: ${SIDEBAR_OUTPUT}`);
  console.log(`   Categories: ${sidebar.length - 1}`);
  console.log(`   Total packages: ${totalPackages}`);
}

export { generateSidebar };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generateSidebar().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
