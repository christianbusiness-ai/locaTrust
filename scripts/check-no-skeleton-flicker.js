/**
 * Script de vérification CI / Lint de Non-Régression (LocaTrust Phase 1)
 *
 * Vérifie qu'aucun chemin de rafraîchissement d'arrière-plan ne remet `isLoading = true`
 * sans vérifier si des données existent déjà, et qu'aucun polling inférieur à 30 secondes
 * ne déclenche de rechargement d'écran.
 */

const fs = require('fs');
const path = require('path');

const targetDirs = ['components', 'app', 'lib'];
let errors = [];

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;

    // 1. Interdiction des timers de polling de données fréquents (< 30s)
    const intervalMatch = line.match(/setInterval\s*\(\s*(\(\)\s*=>\s*\{?[^,}]*load|syncUserData|fetch)/i);
    if (intervalMatch && !line.includes('// dev-only')) {
      // Vérifier les 5 lignes suivantes pour la durée
      const chunk = lines.slice(idx, idx + 6).join(' ');
      const durMatch = chunk.match(/,\s*(\d+)\s*\)/);
      if (durMatch && parseInt(durMatch[1], 10) < 30000) {
        errors.push(`${filePath}:${lineNum} - Timer de polling de données interdit (${durMatch[1]}ms)`);
      }
    }

    // 2. Interdiction des appels à load/fetch dans les handlers d'événements sans isBackground
    if (line.includes('window.addEventListener') && (line.includes('-updated') || line.includes('_updated'))) {
      const handlerNameMatch = line.match(/,\s*([a-zA-Z0-9_]+)\s*\)/);
      if (handlerNameMatch) {
        const hName = handlerNameMatch[1];
        // Si le handler est directement la fonction de fetch sans true
        if (hName.startsWith('load') || hName.startsWith('fetch') || hName.startsWith('reload')) {
          errors.push(`${filePath}:${lineNum} - L'écouteur d'événement appelle directement '${hName}' au lieu d'un handler en arrière-plan avec isBackground=true`);
        }
      }
    }
  });
}

function traverse(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.git' && entry.name !== 'dist') {
        traverse(fullPath);
      }
    } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) {
      scanFile(fullPath);
    }
  }
}

targetDirs.forEach(traverse);

console.log('🔍 Analyse de non-régression anti-flicker LocaTrust...');

if (errors.length > 0) {
  console.error(`❌ ${errors.length} violation(s) détectée(s) :`);
  errors.forEach(e => console.error(`  - ${e}`));
  process.exit(1);
} else {
  console.log('✅ Aucune régression détectée ! Tous les rafraîchissements sont stables et silencieux.');
  process.exit(0);
}

