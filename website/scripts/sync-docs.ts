import fs from 'fs/promises';
import path from 'path';
import { globSync } from 'glob';
import { fileURLToPath } from 'url';
import { mapDocPath } from './lib/path-map.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGES_DIR = path.resolve(__dirname, '../../packages');
const WEBSITE_PACKAGES_DIR = path.resolve(__dirname, '../src/packages');

async function ensureDir(dir: string): Promise<void> {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch {
    // ignore
  }
}

async function syncDocs(): Promise<void> {
  console.log('🔄 Synchronizing package documentation...');

  const docFiles = globSync(`${PACKAGES_DIR}/*/*/docs/**/*.md`, {
    ignore: '**/node_modules/**',
  });

  console.log(`Found ${docFiles.length} documentation files to sync`);

  for (const docFile of docFiles) {
    try {
      const mapped = mapDocPath(PACKAGES_DIR, WEBSITE_PACKAGES_DIR, docFile);
      if (!mapped) {
        console.warn(`⚠️  Skipping unmapped docs file: ${docFile}`);
        continue;
      }

      await ensureDir(path.dirname(mapped.targetPath));
      const content = await fs.readFile(docFile, 'utf-8');
      await fs.writeFile(mapped.targetPath, content, 'utf-8');

      console.log(`✓ ${mapped.relativeFromPackages}`);
    } catch (err) {
      console.error(`✗ Failed to sync ${docFile}:`, err);
    }
  }

  console.log('\n📋 Generating sidebar configuration...');
  try {
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
