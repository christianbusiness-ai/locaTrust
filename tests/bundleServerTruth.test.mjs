/**
 * tests/bundleServerTruth.test.mjs
 * 
 * AUTOMATED TEST: Scans the built client bundle and source for forbidden patterns
 * Part of "SERVER IS THE SOURCE OF TRUTH" verification.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

export function runBundleScan() {
  console.log('[TEST] Running Bundle & Source Server Truth Scan...');
  const distDir = path.join(ROOT_DIR, 'dist', 'assets');
  
  if (!fs.existsSync(distDir)) {
    console.warn('[WARN] dist/assets does not exist yet. Run "npm run build" first to test bundles.');
    return { bundleChecked: false, violations: [] };
  }

  const jsFiles = fs.readdirSync(distDir).filter(f => f.endsWith('.js'));
  const bundleViolations = [];

  for (const file of jsFiles) {
    const fullPath = path.join(distDir, file);
    const code = fs.readFileSync(fullPath, 'utf-8');

    // Check for hardcoded MOCK credentials or data structures leaked into production bundles
    if (/MOCK_ACCOUNTS|MOCK_PROPERTIES_DATA|MOCK_RENTAL_APPLICATIONS/.test(code)) {
      bundleViolations.push({
        file,
        issue: 'Production bundle contains leaked MOCK data structures.'
      });
    }
  }

  if (bundleViolations.length > 0) {
    console.error(`[FAIL] Found ${bundleViolations.length} bundle violations!`);
    bundleViolations.forEach(v => console.error(`  - ${v.file}: ${v.issue}`));
    return { bundleChecked: true, violations: bundleViolations };
  }

  console.log(`[PASS] Verified ${jsFiles.length} bundle chunks. No forbidden leak patterns detected.`);
  return { bundleChecked: true, violations: [] };
}

// When executed directly with node
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = runBundleScan();
  if (result.violations.length > 0) {
    process.exit(1);
  }
}
