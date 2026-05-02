import fs from 'fs/promises';
import path from 'path';
import { globSync } from 'glob';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGES_DIR = path.resolve(__dirname, '../../packages');
const WEBSITE_PACKAGES_DIR = path.resolve(__dirname, '../src/packages');

async function ensureDir(dir: string): Promise<void> {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (err) {
    // ignore if already exists
  }
}

async function syncDocs(): Promise<void> {
  console.log('🔄 Synchronizing package documentation...');

  // Find all docs in packages/{category}/{package}/docs/
  const docFiles = globSync(`${PACKAGES_DIR}/*/*/docs/**/*.md`, {
    ignore: '**/node_modules/**',
  });

  console.log(`Found ${docFiles.length} documentation files to sync`);

  for (const docFile of docFiles) {
    try {
      // Extract category and package name from path
      // Path: packages/{category}/{package}/docs/{rest...}
      const relativePath = path.relative(PACKAGES_DIR, docFile);
      const parts = relativePath.split(path.sep);

      if (parts.length < 4) {
        console.warn(`⚠️  Skipping invalid path: ${docFile}`);
        continue;
      }

      const [category, packageName, docsFolder, ...restParts] = parts;

      if (docsFolder !== 'docs') {
        continue; // Only process docs folder
      }

      // Target path: website/src/packages/{category}/{package}/{rest...}
      const targetDir = path.join(
        WEBSITE_PACKAGES_DIR,
        category,
        packageName,
        ...restParts.slice(0, -1)
      );

      await ensureDir(targetDir);

      const targetPath = path.join(targetDir, restParts[restParts.length - 1]);

      // Read source file
      const content = await fs.readFile(docFile, 'utf-8');

      // Write to target location
      await fs.writeFile(targetPath, content, 'utf-8');

      console.log(`✓ ${relativePath}`);
    } catch (err) {
      console.error(`✗ Failed to sync ${docFile}:`, err);
    }
  }

  // Generate sidebar after syncing
  console.log('\n📋 Generating sidebar configuration...');
  try {
    // Dynamically import the generate-sidebar function
    const { generateSidebar } = await import('./generate-sidebar.js');
    await generateSidebar();
  } catch (err) {
    console.error('Failed to generate sidebar:', err);
  }

  console.log('✅ Documentation synchronization complete');
}

syncDocs().catch((err) => {
  console.error('Fatal error during sync:', err);
  process.exit(1);
});
