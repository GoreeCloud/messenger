/**
 * Fail-closed static closure check for the self-hosted Messenger web-preview artifact.
 * This checks local HTML/manifest assets and the literal ESM import graph. It does
 * not replace browser runtime tests or evaluate arbitrary import expressions.
 */
import { readFileSync, realpathSync, statSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export function verifyWebPreviewPackage(bundlePath) {
  const root = realpathSync(resolve(bundlePath));
  const inside = path => {
    const rel = relative(root, path);
    return rel !== '..' && !rel.startsWith('..' + sep) && !isAbsolute(rel);
  };
  const localFile = (specifier, fromDir) => {
    if (!specifier.startsWith('./') && !specifier.startsWith('../')) {
      throw new Error('Non-local preview resource: ' + specifier);
    }
    const candidate = resolve(fromDir, specifier);
    if (!inside(candidate)) throw new Error('Preview resource escapes bundle: ' + specifier);
    let actual;
    try { actual = realpathSync(candidate); }
    catch { throw new Error('Missing preview resource: ' + specifier); }
    if (!inside(actual) || !statSync(actual).isFile()) {
      throw new Error('Preview resource is not a bundle-contained file: ' + specifier);
    }
    return actual;
  };
  const entry = name => localFile('./' + name, root);
  const htmlPath = entry('web/index.html');
  const html = readFileSync(htmlPath, 'utf8');
  let inspectedAssets = 0;
  for (const tag of html.matchAll(/<(?:script|link)\b[^>]*>/gi)) {
    const specifier = tag[0].match(/\b(?:src|href)\s*=\s*["']([^"']+)["']/i)?.[1];
    if (specifier) {
      localFile(specifier, dirname(htmlPath));
      inspectedAssets++;
    }
  }
  if (!html.includes('./app.mjs') || inspectedAssets < 5) {
    throw new Error('Preview HTML entrypoints or local assets are incomplete');
  }
  const manifestPath = entry('web/manifest.webmanifest');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (!Array.isArray(manifest.icons) || manifest.icons.length === 0) {
    throw new Error('Preview icon manifest is missing');
  }
  for (const icon of manifest.icons) localFile(icon.src, dirname(manifestPath));

  const visited = new Set();
  const walk = modulePath => {
    if (visited.has(modulePath)) return;
    visited.add(modulePath);
    const source = readFileSync(modulePath, 'utf8');
    const staticImports = [
      ...source.matchAll(/(?:^|\n)\s*(?:import\s+(?:[^\n;]*?\s+from\s+)?|export\s+[^\n;]*?\s+from\s+)["']([^"']+)["']/g),
      ...source.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g)
    ];
    const dynamicCount = [...source.matchAll(/\bimport\s*\(/g)].length;
    const literalDynamicCount = [...source.matchAll(/\bimport\s*\(\s*["'][^"']+["']\s*\)/g)].length;
    if (dynamicCount !== literalDynamicCount) {
      throw new Error('Untraceable dynamic module import: ' + relative(root, modulePath));
    }
    for (const match of staticImports) {
      const next = localFile(match[1], dirname(modulePath));
      if (!/\.(?:mjs|js)$/.test(next)) {
        throw new Error('Unsupported preview JavaScript module: ' + match[1]);
      }
      walk(next);
    }
  };
  walk(entry('web/app.mjs'));
  return { modules: visited.size, htmlAssets: inspectedAssets, icons: manifest.icons.length };
}

const invoked = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  try {
    const result = verifyWebPreviewPackage(process.argv[2] || 'package');
    console.log('PASS: packaged Messenger preview has ' + result.modules +
      ' local ESM modules, ' + result.htmlAssets + ' HTML assets and ' +
      result.icons + ' manifest icons');
  } catch (error) {
    console.error('FAIL: Messenger web preview package closure: ' + error.message);
    process.exitCode = 1;
  }
}
