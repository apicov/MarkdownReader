#!/usr/bin/env node

/**
 * Bundle external libraries into TypeScript constants
 * This allows us to inline libraries in WebView HTML without relying on CDN
 * which may be blocked on older Android versions or offline environments
 */

const fs = require('fs');
const path = require('path');

const LIBS_DIR = path.join(__dirname, '../assets/libs');
const OUTPUT_FILE = path.join(__dirname, '../src/utils/bundledLibraries.ts');

try {
  console.log('📦 Bundling libraries...');

  const marked = fs.readFileSync(path.join(LIBS_DIR, 'marked.min.js'), 'utf8');
  const katex = fs.readFileSync(path.join(LIBS_DIR, 'katex.min.js'), 'utf8');
  const katexCss = fs.readFileSync(path.join(LIBS_DIR, 'katex.min.css'), 'utf8');
  const autoRender = fs.readFileSync(path.join(LIBS_DIR, 'auto-render.min.js'), 'utf8');

  // Use JSON.stringify to properly escape the strings
  const output = `// Auto-generated file - do not edit manually
// Generated from bundled libraries in assets/libs/
// Run 'npm run prebuild' to regenerate

export const MARKED_JS = ${JSON.stringify(marked)};
export const KATEX_JS = ${JSON.stringify(katex)};
export const KATEX_CSS = ${JSON.stringify(katexCss)};
export const AUTO_RENDER_JS = ${JSON.stringify(autoRender)};
`;

  fs.writeFileSync(OUTPUT_FILE, output);

  const sizeKb = (Buffer.byteLength(output) / 1024).toFixed(1);
  console.log(`✓ Generated ${OUTPUT_FILE} (${sizeKb} KB)`);
  console.log(`  - marked.js: ${(marked.length / 1024).toFixed(1)} KB`);
  console.log(`  - katex.js: ${(katex.length / 1024).toFixed(1)} KB`);
  console.log(`  - katex.css: ${(katexCss.length / 1024).toFixed(1)} KB`);
  console.log(`  - auto-render.js: ${(autoRender.length / 1024).toFixed(1)} KB`);
} catch (error) {
  console.error('❌ Failed to bundle libraries:', error.message);
  process.exit(1);
}
