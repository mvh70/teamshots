#!/usr/bin/env node

/**
 * Script to find potential implicit 'any' type errors
 * Looks for common patterns that might need explicit type annotations
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const srcDir = join(process.cwd(), 'src');

function findFiles(dir, fileList = []) {
  const files = readdirSync(dir);
  
  files.forEach(file => {
    const filePath = join(dir, file);
    const stat = statSync(filePath);
    
    if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
      findFiles(filePath, fileList);
    } else if (extname(file) === '.ts' || extname(file) === '.tsx') {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

function checkFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const issues = [];
  
  // Patterns that commonly have implicit any issues
  const patterns = [
    {
      regex: /\.(map|filter|reduce|forEach|find|some|every)\(([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=>/g,
      name: 'Array method without explicit parameter types',
      check: (match, lineNum, line) => {
        // Check if parameters have type annotations
        const params = match[2];
        if (!line.includes(':')) {
          return `Line ${lineNum}: ${match[0]} - parameter '${params}' may need explicit type`;
        }
        return null;
      }
    },
    {
      regex: /Object\.entries\([^)]+\)\.(map|filter|reduce|forEach)/g,
      name: 'Object.entries() without type cast',
      check: (match, lineNum) => {
        // Check if it's cast to a specific type
        const beforeMatch = lines[lineNum - 1].substring(0, lines[lineNum - 1].indexOf(match[0]));
        if (!beforeMatch.includes('as [') && !beforeMatch.includes('as Array<')) {
          return `Line ${lineNum}: ${match[0]} - may need type cast: (Object.entries(...) as [string, Type][])`;
        }
        return null;
      }
    }
  ];
  
  lines.forEach((line, index) => {
    patterns.forEach(pattern => {
      const matches = [...line.matchAll(pattern.regex)];
      matches.forEach(match => {
        const issue = pattern.check(match, index + 1, line);
        if (issue) {
          issues.push({
            file: filePath.replace(process.cwd() + '/', ''),
            line: index + 1,
            issue
          });
        }
      });
    });
  });
  
  return issues;
}

// Main execution
console.log('🔍 Checking for potential implicit "any" type issues...\n');

const files = findFiles(srcDir);
const allIssues = [];

files.forEach(file => {
  const issues = checkFile(file);
  allIssues.push(...issues);
});

if (allIssues.length === 0) {
  console.log('✅ No obvious implicit "any" patterns found!');
  console.log('💡 Note: This is a heuristic check. Run "npm run type-check" for full type checking.\n');
  process.exit(0);
} else {
  console.log(`⚠️  Found ${allIssues.length} potential issue(s):\n`);
  allIssues.forEach(({ file, line, issue }) => {
    console.log(`${file}:${line}`);
    console.log(`  ${issue}\n`);
  });
  console.log('💡 These are potential issues. Run "npm run type-check" to verify.\n');
  process.exit(1);
}

