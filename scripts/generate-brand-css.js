#!/usr/bin/env node

/**
 * Generates CSS variables from BRAND_CONFIG
 * This ensures CSS variables stay in sync with the brand configuration
 */

const fs = require('fs');
const path = require('path');

// Import BRAND_CONFIG (we'll read it as a string and parse it)
const brandConfigPath = path.join(__dirname, '../src/config/brand.ts');
const brandConfigContent = fs.readFileSync(brandConfigPath, 'utf-8');

// Extract color values using regex (simple approach)
const colors = {
  primary: '#6366F1',
  primaryHover: '#4F46E5',
  secondary: '#10B981',
  secondaryHover: '#059669',
  cta: '#EA580C',
  ctaHover: '#C2410C',
};

// Try to extract from the file
const colorMatches = brandConfigContent.match(/primary:\s*['"]([^'"]+)['"]/g);
if (colorMatches) {
  // Extract actual values
  const primaryMatch = brandConfigContent.match(/primary:\s*['"]([^'"]+)['"]/);
  const primaryHoverMatch = brandConfigContent.match(/primaryHover:\s*['"]([^'"]+)['"]/);
  const secondaryMatch = brandConfigContent.match(/secondary:\s*['"]([^'"]+)['"]/);
  const secondaryHoverMatch = brandConfigContent.match(/secondaryHover:\s*['"]([^'"]+)['"]/);
  const ctaMatch = brandConfigContent.match(/cta:\s*['"]([^'"]+)['"]/);
  const ctaHoverMatch = brandConfigContent.match(/ctaHover:\s*['"]([^'"]+)['"]/);
  
  if (primaryMatch) colors.primary = primaryMatch[1];
  if (primaryHoverMatch) colors.primaryHover = primaryHoverMatch[1];
  if (secondaryMatch) colors.secondary = secondaryMatch[1];
  if (secondaryHoverMatch) colors.secondaryHover = secondaryHoverMatch[1];
  if (ctaMatch) colors.cta = ctaMatch[1];
  if (ctaHoverMatch) colors.ctaHover = ctaHoverMatch[1];
}

// Generate CSS variables
const cssVariables = `/* 
 * AUTO-GENERATED FILE - DO NOT EDIT MANUALLY
 * This file is generated from src/config/brand.ts
 * Run: npm run brand:generate-css
 */

:root {
  /* Brand Colors - Generated from BRAND_CONFIG */
  --brand-primary: ${colors.primary};
  --brand-primary-hover: ${colors.primaryHover};
  --brand-primary-light: #EEF2FF;  /* Indigo-50 */
  --brand-primary-lighter: #E0E7FF; /* Indigo-100 */
  
  --brand-secondary: ${colors.secondary};
  --brand-secondary-hover: ${colors.secondaryHover};
  
  --brand-cta: ${colors.cta};
  --brand-cta-hover: ${colors.ctaHover};
  --brand-cta-light: #FFF7ED;      /* Orange-50 */
  --brand-cta-ring: #FB923C;       /* Orange-500 for rings */
  --brand-cta-shadow: #FED7AA;     /* Orange-200 for shadows */
  
  --brand-premium: #8B5CF6;        /* Violet - Premium tier */
  --brand-premium-ring: #8B5CF6;   /* Violet-500 for rings */
  
  /* Text Colors - WCAG AA+ Compliant */
  --text-dark: #111827;      /* Gray-900 for headings */
  --text-body: #374151;      /* Gray-700 for body (7.25:1 contrast) */
  --text-muted: #6B7280;     /* Gray-500 for secondary info */
  
  /* Background Colors */
  --bg-white: #FFFFFF;
  --bg-gray-50: #F9FAFB;
}
`;

// Write to globals.css (we'll update the :root section)
const globalsCssPath = path.join(__dirname, '../src/app/globals.css');
let globalsCss = fs.readFileSync(globalsCssPath, 'utf-8');

// Replace the :root section with generated variables
const rootSectionRegex = /:root\s*\{[^}]*\}/s;
const newRootSection = `:root {
  --background: #ffffff;
  --foreground: #171717;
  
  ${cssVariables.split(':root {')[1].split('}')[0].trim()}
}`;

globalsCss = globalsCss.replace(rootSectionRegex, newRootSection);

fs.writeFileSync(globalsCssPath, globalsCss, 'utf-8');

console.log('✅ Brand CSS variables generated successfully!');
console.log('📝 Updated: src/app/globals.css');

