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

interface CategoryMap {
  [categoryName: string]: {
    packages: {
      [packageName: string]: {
        docs: SidebarItem[];
        order?: number;
      };
    };
    order?: number;
  };
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

function formatLink(filePath: string): string {
  // Convert file path to URL path
  // /path/to/packages/category/package/index.md -> /packages/category/package/
  const urlPath = filePath
    .replace(/\\/g, '/') // normalize windows paths
    .replace(/\/index\.md$/, '/') // remove index.md
    .replace(/\.md$/, '/'); // add trailing slash for non-index files

  return urlPath;
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

  const fileMap = new Map<
    string,
    { file: string; data: Record<string, any> }
  >();

  // Read all files and their metadata
  for (const filePath of docFiles) {
    const frontmatter = await readFrontmatter(filePath);
    const relativePath = path.relative(packageDocDir, filePath);

    fileMap.set(relativePath, {
      file: filePath,
      data: frontmatter || {},
    });
  }

  // Sort files by frontmatter order or alphabetically
  const sortedFiles = Array.from(fileMap.entries()).sort(([, a], [, b]) => {
    const orderA = a.data.order ?? 999;
    const orderB = b.data.order ?? 999;
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    return a.data.title?.localeCompare(b.data.title ?? '') ?? 0;
  });

  // Build hierarchy
  const nestedMap = new Map<string, SidebarItem[]>();
  nestedMap.set('root', []);

  for (const [relativePath, { file, data }] of sortedFiles) {
    const title = data.title || path.basename(file, '.md');
    const link = formatLink(path.relative(WEBSITE_PACKAGES_DIR, file));

    const dirPath = path.dirname(relativePath);
    const parentKey = dirPath === '.' ? 'root' : dirPath;

    if (!nestedMap.has(parentKey)) {
      nestedMap.set(parentKey, []);
    }

    const parent = nestedMap.get(parentKey);
    if (parent) {
      parent.push({
        text: title,
        link,
      });
    }
  }

  // For single-file packages, just return the item
  if (docFiles.length === 1) {
    return nestedMap.get('root') || [];
  }

  // For multi-file packages, create hierarchy
  return nestedMap.get('root') || [];
}

async function generateSidebar(): Promise<void> {
  console.log('📋 Generating sidebar configuration...');

  const categoryDirs = globSync(`${WEBSITE_PACKAGES_DIR}/*`, {
    onlyDirectories: true,
  }).sort();

  const categoryMap: CategoryMap = {};

  // Process all categories and packages
  for (const categoryDir of categoryDirs) {
    const categoryName = path.basename(categoryDir);
    const packageDirs = globSync(`${categoryDir}/*`, {
      onlyDirectories: true,
    }).sort();

    categoryMap[categoryName] = {
      packages: {},
      order: 999,
    };

    for (const packageDir of packageDirs) {
      const packageName = path.basename(packageDir);
      const docs = await processPackageDocs(categoryName, packageName);

      categoryMap[categoryName].packages[packageName] = {
        docs,
        order: 999,
      };
    }
  }

  // Build sidebar structure
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

  // Add categories and packages
  const sortedCategories = Object.entries(categoryMap).sort(
    ([, a], [, b]) => (a.order ?? 999) - (b.order ?? 999)
  );

  for (const [categoryName, categoryData] of sortedCategories) {
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

    const sortedPackages = Object.entries(categoryData.packages).sort(
      ([, a], [, b]) => (a.order ?? 999) - (b.order ?? 999)
    );

    for (const [packageName, packageData] of sortedPackages) {
      const items = categoryItem.items;
      if (!items) continue;

      if (packageData.docs.length === 0) {
        // Package with no docs, just add link to overview
        items.push({
          text: packageName,
          link: `/packages/${categoryName}/${packageName}/`,
        });
      } else if (packageData.docs.length === 1 && packageData.docs[0].link) {
        // Single doc file
        items.push({
          text: packageData.docs[0].text || packageName,
          link: packageData.docs[0].link,
        });
      } else {
        // Multiple doc files, create nested structure
        items.push({
          text: packageName,
          items: packageData.docs,
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
  console.log(`   Categories: ${sortedCategories.length}`);
  console.log(
    `   Total packages: ${Object.values(categoryMap).reduce(
      (sum, cat) => sum + Object.keys(cat.packages).length,
      0
    )}`
  );
}

export { generateSidebar };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generateSidebar().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
