import fs from 'fs';

const raw = fs.readFileSync('audit_results.json', 'utf-8');
const violations = JSON.parse(raw);

console.log(`=== AUDIT SUMMARY: ${violations.length} VIOLATIONS ===\n`);

// 1. Storage keys / business data involved
const businessKeys = new Map();
violations.forEach(v => {
  if (v.category === 'DIRECT_STORAGE_ACCESS') {
    const match = v.snippet.match(/['"`](locatrust_[a-zA-Z0-9_-]+)/);
    const key = match ? match[1] : 'other_storage_call';
    businessKeys.set(key, (businessKeys.get(key) || 0) + 1);
  }
});

console.log('--- Breakdown of Direct Storage Access by Business Data Key ---');
Array.from(businessKeys.entries())
  .sort((a, b) => b[1] - a[1])
  .forEach(([key, count]) => {
    console.log(`  • ${key.padEnd(35)} : ${count} access points`);
  });

console.log('\n--- Breakdown by Codebase Modules ---');
const moduleCount = new Map();
violations.forEach(v => {
  const parts = v.file.split('/');
  const mod = parts.length > 2 ? `${parts[0]}/${parts[1]}` : parts[0];
  moduleCount.set(mod, (moduleCount.get(mod) || 0) + 1);
});

Array.from(moduleCount.entries())
  .sort((a, b) => b[1] - a[1])
  .forEach(([mod, count]) => {
    console.log(`  • ${mod.padEnd(30)} : ${count} violations`);
  });

console.log('\n--- Top 15 Most Impacted Files ---');
const fileCount = new Map();
violations.forEach(v => {
  fileCount.set(v.file, (fileCount.get(v.file) || 0) + 1);
});

Array.from(fileCount.entries())
  .sort((a, b) => b[1] - a[1])
  .slice(0, 15)
  .forEach(([file, count]) => {
    console.log(`  • ${file.padEnd(55)} : ${count} violations`);
  });
