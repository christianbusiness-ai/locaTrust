#!/usr/bin/env node
/**
 * scripts/check-server-truth.mjs
 * 
 * AUTOMATED ENFORCEMENT OF "SERVER IS THE SOURCE OF TRUTH"
 *
 * Checks:
 * 1. MOCK_ / INITIAL_ data used outside tests and mock definitions.
 * 2. Date.now() or Math.random() used to generate IDs, document numbers, or tokens.
 * 3. Direct access to localStorage, sessionStorage, indexedDB, or document.cookie outside authorized wrappers:
 *    - src/lib/uiPreferences.ts
 *    - src/lib/displayCache.ts
 * 4. setInterval-based data polling for business records.
 * 5. PostgreSQL tables created in supabase/ without ENABLE ROW LEVEL SECURITY.
 *
 * Options:
 *   --report-only  Print all violations and summary, but always exit with code 0.
 *   --strict       Exit with code 1 if any violation is found.
 *   --json         Output violations as a JSON array.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const isReportOnly = args.includes('--report-only');
const isStrict = args.includes('--strict');
const isJson = args.includes('--json');

// Directories to scan
const SOURCE_DIRS = ['app', 'components', 'lib', 'src'];
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

// Whitelisted files that are legitimately allowed to access storage wrappers
const STORAGE_WRAPPER_WHITELIST = new Set([
  path.normalize('src/lib/uiPreferences.ts'),
  path.normalize('src/lib/displayCache.ts'),
  path.normalize('lib/uiPreferences.ts'),
  path.normalize('lib/displayCache.ts')
]);

// Whitelisted files for mock definition or test infrastructure
const TEST_AND_MOCK_WHITELIST = (relPath) => {
  const normalized = relPath.replace(/\\/g, '/');
  return (
    normalized.includes('/tests/') ||
    normalized.includes('/__tests__/') ||
    normalized.includes('.test.') ||
    normalized.includes('.spec.') ||
    normalized.startsWith('lib/mock/') ||
    normalized.startsWith('scripts/')
  );
};

const violations = [];

function recordViolation(category, file, line, snippet, description) {
  violations.push({
    category,
    file: file.replace(/\\/g, '/'),
    line,
    snippet: snippet.trim().slice(0, 140),
    description
  });
}

/**
 * Recursively find all source files in given directories
 */
function findSourceFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (
        entry.name === 'node_modules' ||
        entry.name === '.next' ||
        entry.name === 'dist' ||
        entry.name === '.git'
      ) {
        continue;
      }
      findSourceFiles(fullPath, fileList);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (EXTENSIONS.has(ext)) {
        fileList.push(fullPath);
      }
    }
  }
  return fileList;
}

/**
 * Scan source files for forbidden patterns
 */
function checkSourceFiles() {
  const allFiles = SOURCE_DIRS.flatMap(dir => findSourceFiles(path.join(ROOT_DIR, dir)));

  for (const filePath of allFiles) {
    const relPath = path.relative(ROOT_DIR, filePath);
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    const isTestOrMockFile = TEST_AND_MOCK_WHITELIST(relPath);
    const isStorageWrapper = STORAGE_WRAPPER_WHITELIST.has(path.normalize(relPath));

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      const lineText = lines[i];
      const trimmed = lineText.trim();

      // Skip comments
      if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
        continue;
      }

      // 1. Direct storage access (localStorage, sessionStorage, indexedDB, document.cookie)
      if (!isStorageWrapper && !isTestOrMockFile) {
        if (
          /\b(window\.)?localStorage\b/.test(lineText) &&
          !lineText.includes('ALLOWED_UI_PREFERENCE_KEYS')
        ) {
          recordViolation(
            'DIRECT_STORAGE_ACCESS',
            relPath,
            lineNum,
            lineText,
            'Direct access to localStorage is forbidden. Use Supabase for business data, or src/lib/uiPreferences.ts for whitelisted UI settings.'
          );
        }

        if (/\b(window\.)?sessionStorage\b/.test(lineText)) {
          recordViolation(
            'DIRECT_STORAGE_ACCESS',
            relPath,
            lineNum,
            lineText,
            'Direct access to sessionStorage is forbidden. Server is the source of truth.'
          );
        }

        if (/\b(window\.)?indexedDB\b/.test(lineText)) {
          recordViolation(
            'DIRECT_STORAGE_ACCESS',
            relPath,
            lineNum,
            lineText,
            'Direct access to indexedDB is forbidden. Use src/lib/displayCache.ts (max 24h display-only cache).'
          );
        }

        if (/\bdocument\.cookie\b/.test(lineText)) {
          recordViolation(
            'DIRECT_STORAGE_ACCESS',
            relPath,
            lineNum,
            lineText,
            'Direct access to document.cookie is forbidden.'
          );
        }

        if (/\b(createStore|zustand)\/middleware\b.*persist/.test(lineText) || /\bredux-persist\b/.test(lineText)) {
          recordViolation(
            'PERSISTED_CLIENT_STORE',
            relPath,
            lineNum,
            lineText,
            'Persisted client stores (zustand persist, redux-persist) are forbidden as a source of truth.'
          );
        }
      }

      // 2. MOCK_ and INITIAL_ business data used in production code
      if (!isTestOrMockFile) {
        if (/\b(MOCK_[A-Z0-9_]+|INITIAL_[A-Z0-9_]+)\b/.test(lineText)) {
          // Exclude comments or harmless UI-only component names if any
          if (!lineText.includes('//') && !lineText.includes('type ') && !lineText.includes('interface ')) {
            recordViolation(
              'MOCK_DATA_IN_PRODUCTION',
              relPath,
              lineNum,
              lineText,
              'Mock/Initial fake data (MOCK_*, INITIAL_*) used in production code paths.'
            );
          }
        }
      }

      // 3. Client-side ID / document number generation using Date.now() or Math.random()
      if (!isTestOrMockFile) {
        // e.g. id: `LT-${Date.now()}` or id: Date.now() or id: Math.random() or id: `REC-...`
        const isClientGeneratedId =
          /\b(id|token|contract_number|receipt_number|payment_id|reference)\s*:\s*.*(Date\.now\(\)|Math\.random\(\))/.test(lineText) ||
          /(['"`])(LT|REC|DOC|PAY|USR|PROP)-.*\$\{(Date\.now\(\)|Math\.random\(\))\}/.test(lineText) ||
          /\b(uuid|generateId|generateToken)\b.*(Math\.random\(\)|Date\.now\(\))/.test(lineText);

        if (isClientGeneratedId) {
          recordViolation(
            'CLIENT_GENERATED_IDENTIFIER',
            relPath,
            lineNum,
            lineText,
            'Client-side ID or document number generation using Date.now() / Math.random(). Database must generate UUIDs / sequences.'
          );
        }
      }

      // 4. setInterval-based data polling
      if (!isTestOrMockFile) {
        if (/\bsetInterval\s*\(/.test(lineText)) {
          // Flag setInterval that triggers data fetching or sync
          if (
            lineText.includes('fetch') ||
            lineText.includes('sync') ||
            lineText.includes('load') ||
            lineText.includes('get') ||
            lineText.includes('poll') ||
            lines.slice(i, Math.min(lines.length, i + 8)).some(l => /fetch|sync|supabase|loadAllData/.test(l))
          ) {
            recordViolation(
              'SET_INTERVAL_DATA_POLLING',
              relPath,
              lineNum,
              lineText,
              'setInterval data polling detected. Use Supabase Realtime subscriptions (postgres_changes).'
            );
          }
        }
      }
    }
  }
}

/**
 * Check Supabase SQL migrations for missing RLS
 */
function checkSupabaseMigrations() {
  const migrationsDir = path.join(ROOT_DIR, 'supabase', 'migrations');
  if (!fs.existsSync(migrationsDir)) return;

  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));

  for (const file of files) {
    const fullPath = path.join(migrationsDir, file);
    const content = fs.readFileSync(fullPath, 'utf-8');
    const relPath = path.relative(ROOT_DIR, fullPath);

    // Find table creations
    const createTableRegex = /CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+(?:public\.)?([a-zA-Z0-9_]+)/gi;
    let match;
    while ((match = createTableRegex.exec(content)) !== null) {
      const tableName = match[1];
      const rlsRegex = new RegExp(`ALTER\\s+TABLE\\s+(?:public\\.)?${tableName}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY`, 'i');
      if (!rlsRegex.test(content)) {
        // Find approximate line number
        const upToMatch = content.slice(0, match.index);
        const lineNum = upToMatch.split('\n').length;
        recordViolation(
          'MISSING_ROW_LEVEL_SECURITY',
          relPath,
          lineNum,
          match[0],
          `Table "${tableName}" created without ENABLE ROW LEVEL SECURITY.`
        );
      }
    }
  }
}

// Run checks
checkSourceFiles();
checkSupabaseMigrations();

if (isJson) {
  console.log(JSON.stringify(violations, null, 2));
  process.exit(violations.length > 0 && isStrict ? 1 : 0);
}

// Output human-readable audit report
console.log('\n========================================================================');
console.log('  RULE AUDIT: "SERVER IS THE SOURCE OF TRUTH" (LocaTrust)');
console.log('========================================================================\n');

if (violations.length === 0) {
  console.log('  [PASS] Zero violations found! Server source of truth is 100% compliant.\n');
  process.exit(0);
}

// Group violations by category
const grouped = violations.reduce((acc, v) => {
  acc[v.category] = acc[v.category] || [];
  acc[v.category].push(v);
  return acc;
}, {});

console.log(`Found ${violations.length} total violation(s) across ${Object.keys(grouped).length} category(ies):\n`);

for (const [cat, items] of Object.entries(grouped)) {
  console.log(`--- [${cat}] (${items.length} occurrence(s)) ---`);
  items.slice(0, 10).forEach(item => {
    console.log(`  • ${item.file}:${item.line}`);
    console.log(`    Snippet: ${item.snippet}`);
    console.log(`    Note:    ${item.description}\n`);
  });
  if (items.length > 10) {
    console.log(`  ... and ${items.length - 10} more in this category.\n`);
  }
}

console.log('========================================================================');
console.log(`SUMMARY: ${violations.length} violations detected in current codebase.`);
if (isReportOnly || (!isStrict && !process.env.CI)) {
  console.log('MODE: REPORT-ONLY. (Checks will switch to BLOCKING after migration task).');
  console.log('========================================================================\n');
  process.exit(0);
} else {
  console.log('MODE: STRICT (BLOCKING). Exiting with error code 1.');
  console.log('========================================================================\n');
  process.exit(1);
}
