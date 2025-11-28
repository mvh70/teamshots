#!/usr/bin/env node
/**
 * Find and remove unused translation keys from messages/*.json files
 * 
 * Usage:
 *   node scripts/find-unused-translations.js           # Dry run (report only)
 *   node scripts/find-unused-translations.js --remove  # Actually remove unused keys
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.join(__dirname, '..');
const MESSAGES_DIR = path.join(ROOT_DIR, 'messages');
const SRC_DIR = path.join(ROOT_DIR, 'src');

// File extensions to scan
const EXTENSIONS = ['.tsx', '.ts', '.js', '.jsx'];

// Directories to skip
const SKIP_DIRS = ['node_modules', '.next', 'dist', '.git', 'test-results', 'playwright-report'];

/**
 * Recursively get all keys from a nested object with their full paths
 */
function getAllKeys(obj, prefix = '') {
  const keys = [];
  for (const key of Object.keys(obj)) {
    const fullPath = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      keys.push(...getAllKeys(obj[key], fullPath));
    } else {
      keys.push(fullPath);
    }
  }
  return keys;
}

/**
 * Recursively find all source files
 */
function findSourceFiles(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.includes(entry.name)) {
        findSourceFiles(fullPath, files);
      }
    } else if (EXTENSIONS.some(ext => entry.name.endsWith(ext))) {
      files.push(fullPath);
    }
  }
  
  return files;
}

/**
 * Extract translation usages from a file
 * Returns: { namespace -> Set of keys used }
 */
function extractTranslationUsages(filePath, content) {
  const usages = new Map(); // namespace -> Set of keys
  const dynamicPatterns = new Set(); // patterns like "plans.*" that should match all subkeys
  
  // Find useTranslations('namespace') or useTranslations('namespace.subnamespace') calls
  // Support both single-word and dotted namespaces like 'auth.signin'
  const useTranslationsRegex = /(?:const|let)\s+(\w+)\s*=\s*useTranslations\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  const translationVars = new Map(); // variable name -> { topNamespace, prefix }
  
  let match;
  while ((match = useTranslationsRegex.exec(content)) !== null) {
    const [, varName, fullNamespace] = match;
    const parts = fullNamespace.split('.');
    const topNamespace = parts[0];
    const prefix = parts.slice(1).join('.'); // e.g., 'signin' for 'auth.signin'
    
    translationVars.set(varName, { topNamespace, prefix });
    if (!usages.has(topNamespace)) {
      usages.set(topNamespace, new Set());
    }
  }
  
  // Also check for getTranslations (server-side)
  const getTranslationsRegex = /(?:const|let)\s+(\w+)\s*=\s*(?:await\s+)?getTranslations\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = getTranslationsRegex.exec(content)) !== null) {
    const [, varName, fullNamespace] = match;
    const parts = fullNamespace.split('.');
    const topNamespace = parts[0];
    const prefix = parts.slice(1).join('.');
    
    translationVars.set(varName, { topNamespace, prefix });
    if (!usages.has(topNamespace)) {
      usages.set(topNamespace, new Set());
    }
  }
  
  // For each translation variable, find its usages
  for (const [varName, { topNamespace, prefix }] of translationVars) {
    // Match static keys: t('key') or t("key") or t('nested.key')
    const staticKeyRegex = new RegExp(`\\b${varName}\\s*\\(\\s*['"]([^'"]+)['"]`, 'g');
    while ((match = staticKeyRegex.exec(content)) !== null) {
      const key = match[1];
      // Combine prefix with key if there's a prefix
      const fullKey = prefix ? `${prefix}.${key}` : key;
      usages.get(topNamespace).add(fullKey);
    }
    
    // Match dynamic keys: t(`prefix.${var}.suffix`) - extract static parts
    const dynamicKeyRegex = new RegExp(`\\b${varName}\\s*\\(\\s*\`([^\`]+)\``, 'g');
    while ((match = dynamicKeyRegex.exec(content)) !== null) {
      const template = match[1];
      // Extract static prefix before first ${
      const keyPrefix = template.split('${')[0];
      if (keyPrefix) {
        // Mark this prefix as a dynamic pattern
        const fullPrefix = prefix ? `${prefix}.${keyPrefix}` : keyPrefix;
        dynamicPatterns.add(`${topNamespace}.${fullPrefix}`);
      }
    }
  }
  
  // Find direct getTranslation('namespace.key') calls
  const directTranslationRegex = /getTranslation\s*\(\s*['"]([^'"]+)['"]/g;
  while ((match = directTranslationRegex.exec(content)) !== null) {
    const fullKey = match[1];
    const parts = fullKey.split('.');
    if (parts.length >= 2) {
      const namespace = parts[0];
      const key = parts.slice(1).join('.');
      if (!usages.has(namespace)) {
        usages.set(namespace, new Set());
      }
      usages.get(namespace).add(key);
    }
  }
  
  // Find getEmailTranslation('key') calls - these map to emails.key
  const emailTranslationRegex = /getEmailTranslation\s*\(\s*['"]([^'"]+)['"]/g;
  while ((match = emailTranslationRegex.exec(content)) !== null) {
    const key = match[1];
    if (!usages.has('emails')) {
      usages.set('emails', new Set());
    }
    usages.get('emails').add(key);
  }
  
  // Special handling for onboarding config which uses many dynamic patterns
  if (filePath.includes('onborda/config.ts') || filePath.includes('onborda/hooks.ts')) {
    // Mark entire onboarding subtrees as used
    dynamicPatterns.add('app.dashboard.onboarding.');
    dynamicPatterns.add('app.onboarding.');
    dynamicPatterns.add('app.sidebar.');
  }
  
  // Special handling for dashboard page
  if (filePath.includes('dashboard/page.tsx')) {
    dynamicPatterns.add('app.dashboard.');
  }
  
  // Special handling for settings page
  if (filePath.includes('settings/page.tsx')) {
    dynamicPatterns.add('app.settings.');
  }
  
  return { usages, dynamicPatterns };
}

/**
 * Check if a key matches any dynamic pattern
 */
function matchesDynamicPattern(fullKey, patterns) {
  for (const pattern of patterns) {
    if (fullKey.startsWith(pattern)) {
      return true;
    }
  }
  return false;
}

/**
 * Remove a key from nested object
 */
function removeKey(obj, keyPath) {
  const parts = keyPath.split('.');
  let current = obj;
  
  for (let i = 0; i < parts.length - 1; i++) {
    if (!current[parts[i]]) return false;
    current = current[parts[i]];
  }
  
  const lastKey = parts[parts.length - 1];
  if (lastKey in current) {
    delete current[lastKey];
    return true;
  }
  return false;
}

/**
 * Clean up empty objects after key removal
 */
function cleanEmptyObjects(obj) {
  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      cleanEmptyObjects(obj[key]);
      if (Object.keys(obj[key]).length === 0) {
        delete obj[key];
      }
    }
  }
}

/**
 * Main function
 */
function main() {
  const removeMode = process.argv.includes('--remove');
  
  console.log('🔍 Scanning for unused translations...\n');
  
  // Load English translations (source of truth)
  const enPath = path.join(MESSAGES_DIR, 'en.json');
  const esPath = path.join(MESSAGES_DIR, 'es.json');
  
  const enTranslations = JSON.parse(fs.readFileSync(enPath, 'utf-8'));
  const esTranslations = JSON.parse(fs.readFileSync(esPath, 'utf-8'));
  
  // Get all translation keys
  const allKeys = getAllKeys(enTranslations);
  console.log(`📚 Found ${allKeys.length} translation keys in en.json\n`);
  
  // Collect all usages from source files
  const allUsages = new Map(); // namespace -> Set of keys
  const allDynamicPatterns = new Set();
  
  const sourceFiles = findSourceFiles(SRC_DIR);
  console.log(`📁 Scanning ${sourceFiles.length} source files...\n`);
  
  for (const filePath of sourceFiles) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const { usages, dynamicPatterns } = extractTranslationUsages(filePath, content);
    
    for (const [namespace, keys] of usages) {
      if (!allUsages.has(namespace)) {
        allUsages.set(namespace, new Set());
      }
      for (const key of keys) {
        allUsages.get(namespace).add(key);
      }
    }
    
    for (const pattern of dynamicPatterns) {
      allDynamicPatterns.add(pattern);
    }
  }
  
  // Also scan test files, config files at root level
  const additionalDirs = [
    path.join(ROOT_DIR, 'tests'),
  ];
  
  for (const dir of additionalDirs) {
    if (fs.existsSync(dir)) {
      const files = findSourceFiles(dir);
      for (const filePath of files) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const { usages, dynamicPatterns } = extractTranslationUsages(filePath, content);
        
        for (const [namespace, keys] of usages) {
          if (!allUsages.has(namespace)) {
            allUsages.set(namespace, new Set());
          }
          for (const key of keys) {
            allUsages.get(namespace).add(key);
          }
        }
        
        for (const pattern of dynamicPatterns) {
          allDynamicPatterns.add(pattern);
        }
      }
    }
  }
  
  // Log dynamic patterns found
  if (allDynamicPatterns.size > 0) {
    console.log('🔄 Dynamic patterns found (these subtrees will be preserved):');
    for (const pattern of [...allDynamicPatterns].sort()) {
      console.log(`   ${pattern}*`);
    }
    console.log('');
  }
  
  // Find unused keys
  const unusedKeys = [];
  const usedKeys = [];
  
  for (const fullKey of allKeys) {
    const parts = fullKey.split('.');
    const namespace = parts[0];
    const keyWithinNamespace = parts.slice(1).join('.');
    
    // Check if the key is used
    const namespaceUsages = allUsages.get(namespace);
    let isUsed = false;
    
    if (namespaceUsages) {
      // Direct match
      if (namespaceUsages.has(keyWithinNamespace)) {
        isUsed = true;
      }
      
      // Check if any parent key is used (for nested objects accessed via parent)
      const keyParts = keyWithinNamespace.split('.');
      for (let i = 1; i < keyParts.length; i++) {
        const parentKey = keyParts.slice(0, i).join('.');
        if (namespaceUsages.has(parentKey)) {
          isUsed = true;
          break;
        }
      }
    }
    
    // Check dynamic patterns
    if (!isUsed && matchesDynamicPattern(fullKey, allDynamicPatterns)) {
      isUsed = true;
    }
    
    if (isUsed) {
      usedKeys.push(fullKey);
    } else {
      unusedKeys.push(fullKey);
    }
  }
  
  // Group unused keys by namespace for better readability
  const unusedByNamespace = new Map();
  for (const key of unusedKeys) {
    const namespace = key.split('.')[0];
    if (!unusedByNamespace.has(namespace)) {
      unusedByNamespace.set(namespace, []);
    }
    unusedByNamespace.get(namespace).push(key);
  }
  
  // Report findings
  console.log('=' .repeat(60));
  console.log('📊 ANALYSIS RESULTS');
  console.log('=' .repeat(60));
  console.log(`✅ Used keys: ${usedKeys.length}`);
  console.log(`❌ Unused keys: ${unusedKeys.length}`);
  console.log('');
  
  if (unusedKeys.length > 0) {
    console.log('📋 Unused keys by namespace:');
    console.log('-'.repeat(60));
    
    for (const [namespace, keys] of [...unusedByNamespace.entries()].sort()) {
      console.log(`\n${namespace} (${keys.length} unused):`);
      for (const key of keys.sort()) {
        console.log(`  - ${key}`);
      }
    }
    
    console.log('\n' + '='.repeat(60));
    
    if (removeMode) {
      console.log('\n🗑️  Removing unused keys...\n');
      
      // Backup files
      const backupEnPath = enPath + '.backup';
      const backupEsPath = esPath + '.backup';
      fs.writeFileSync(backupEnPath, JSON.stringify(enTranslations, null, 2) + '\n');
      fs.writeFileSync(backupEsPath, JSON.stringify(esTranslations, null, 2) + '\n');
      console.log(`📦 Backups created: ${backupEnPath}, ${backupEsPath}`);
      
      // Remove unused keys
      let removedCount = 0;
      for (const key of unusedKeys) {
        if (removeKey(enTranslations, key)) {
          removedCount++;
        }
        removeKey(esTranslations, key);
      }
      
      // Clean up empty objects
      cleanEmptyObjects(enTranslations);
      cleanEmptyObjects(esTranslations);
      
      // Write updated files
      fs.writeFileSync(enPath, JSON.stringify(enTranslations, null, 2) + '\n');
      fs.writeFileSync(esPath, JSON.stringify(esTranslations, null, 2) + '\n');
      
      console.log(`\n✅ Removed ${removedCount} unused keys from translation files.`);
      console.log('📝 Review the changes and delete backup files when satisfied.');
    } else {
      console.log('\n💡 Run with --remove to delete these unused keys:');
      console.log('   node scripts/find-unused-translations.js --remove');
    }
  } else {
    console.log('🎉 No unused translation keys found!');
  }
}

main();

