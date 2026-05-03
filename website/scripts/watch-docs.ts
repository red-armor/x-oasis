import chokidar from 'chokidar';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { mapDocPath } from './lib/path-map.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGES_DIR = path.resolve(__dirname, '../../packages');
const WEBSITE_PACKAGES_DIR = path.resolve(__dirname, '../src/packages');

let debounceTimer: NodeJS.Timeout;

async function ensureDir(dir: string): Promise<void> {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch {
    // ignore
  }
}

async function syncFile(filePath: string): Promise<void> {
  try {
    const mapped = mapDocPath(PACKAGES_DIR, WEBSITE_PACKAGES_DIR, filePath);
    if (!mapped) return;

    await ensureDir(path.dirname(mapped.targetPath));
    const content = await fs.readFile(filePath, 'utf-8');
    await fs.writeFile(mapped.targetPath, content, 'utf-8');

    console.log(`✓ Synced: ${mapped.relativeFromPackages}`);
  } catch (err) {
    console.error(`✗ Failed to sync ${filePath}:`, err);
  }
}

async function deleteFile(filePath: string): Promise<void> {
  try {
    const mapped = mapDocPath(PACKAGES_DIR, WEBSITE_PACKAGES_DIR, filePath);
    if (!mapped) return;
    await fs.unlink(mapped.targetPath);
    console.log(`✗ Deleted: ${mapped.relativeFromPackages}`);
  } catch {
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
  console.log(`  pattern: ${docsPattern}`);
  console.log('');

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
