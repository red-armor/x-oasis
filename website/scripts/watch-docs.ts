import chokidar from 'chokidar';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGES_DIR = path.resolve(__dirname, '../../packages');
const WEBSITE_PACKAGES_DIR = path.resolve(__dirname, '../src/packages');

let debounceTimer: NodeJS.Timeout;

async function ensureDir(dir: string): Promise<void> {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (err) {
    // ignore if already exists
  }
}

async function syncFile(filePath: string): Promise<void> {
  try {
    // Extract category and package name from path
    // Path: packages/{category}/{package}/docs/{rest...}
    const relativePath = path.relative(PACKAGES_DIR, filePath);
    const parts = relativePath.split(path.sep);

    if (parts.length < 4) {
      return;
    }

    const [category, packageName, docsFolder, ...restParts] = parts;

    if (docsFolder !== 'docs') {
      return; // Only process docs folder
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
    const content = await fs.readFile(filePath, 'utf-8');

    // Write to target location
    await fs.writeFile(targetPath, content, 'utf-8');

    console.log(`✓ Synced: ${relativePath}`);
  } catch (err) {
    console.error(`✗ Failed to sync ${filePath}:`, err);
  }
}

async function deleteFile(filePath: string): Promise<void> {
  try {
    const relativePath = path.relative(PACKAGES_DIR, filePath);
    const parts = relativePath.split(path.sep);

    if (parts.length < 4) {
      return;
    }

    const [category, packageName, docsFolder, ...restParts] = parts;

    if (docsFolder !== 'docs') {
      return;
    }

    const targetDir = path.join(
      WEBSITE_PACKAGES_DIR,
      category,
      packageName,
      ...restParts.slice(0, -1)
    );

    const targetPath = path.join(targetDir, restParts[restParts.length - 1]);

    await fs.unlink(targetPath);
    console.log(`✗ Deleted: ${relativePath}`);
  } catch (err) {
    // ignore if file doesn't exist
  }
}

function debounce(callback: () => Promise<void>): void {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    callback().catch((err) =>
      console.error('Error in debounced callback:', err)
    );
  }, 500);
}

async function regenerateSidebar(): Promise<void> {
  try {
    const { generateSidebar } = await import('./generate-sidebar.js');
    await generateSidebar();
  } catch (err) {
    console.error('Failed to regenerate sidebar:', err);
  }
}

async function main(): Promise<void> {
  const docsPattern = `${PACKAGES_DIR}/*/*/docs/**/*.md`;

  console.log('👀 Watching for documentation changes...');
  console.log(`Pattern: ${docsPattern}\n`);

  const watcher = chokidar.watch(docsPattern, {
    ignored: '**/node_modules/**',
    persistent: true,
    ignoreInitial: true,
  });

  watcher
    .on('add', (filePath) => {
      console.log(`📄 Added: ${path.relative(PACKAGES_DIR, filePath)}`);
      syncFile(filePath).then(() => {
        debounce(() => regenerateSidebar());
      });
    })
    .on('change', (filePath) => {
      console.log(`✏️  Modified: ${path.relative(PACKAGES_DIR, filePath)}`);
      syncFile(filePath).then(() => {
        debounce(() => regenerateSidebar());
      });
    })
    .on('unlink', (filePath) => {
      console.log(`🗑️  Deleted: ${path.relative(PACKAGES_DIR, filePath)}`);
      deleteFile(filePath).then(() => {
        debounce(() => regenerateSidebar());
      });
    })
    .on('error', (err) => {
      console.error('Watcher error:', err);
    });

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n👋 Stopping watcher...');
    watcher.close();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
