import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, unlinkSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyWebPreviewPackage } from '../scripts/check-web-preview-package.mjs';

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceModules = ['protocols', 'matrix', 'outbox', 'timeline', 'drafts', 'session-epoch'];

function withPreview(action) {
  const root = mkdtempSync(join(tmpdir(), 'goree-messenger-preview-'));
  try {
    cpSync(join(repository, 'web'), join(root, 'web'), { recursive: true });
    mkdirSync(join(root, 'src'));
    for (const name of sourceModules) {
      cpSync(join(repository, 'src', name + '.mjs'), join(root, 'src', name + '.mjs'));
    }
    action(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('self-hosted preview contains the real HTML assets and ESM import closure', () => {
  withPreview(root => {
    const result = verifyWebPreviewPackage(root);
    assert.equal(result.modules, sourceModules.length + 1);
    assert.ok(result.htmlAssets >= 5);
  });
});

test('missing imported module fails even when selected CI spot-check files exist', () => {
  withPreview(root => {
    unlinkSync(join(root, 'src', 'drafts.mjs'));
    assert.throws(() => verifyWebPreviewPackage(root), /Missing preview resource/);
  });
});

test('new unbundled and external ESM imports fail closed', () => {
  withPreview(root => {
    const entry = join(root, 'web', 'app.mjs');
    const original = readFileSync(entry, 'utf8');
    writeFileSync(entry, original + '\nimport "../src/forgotten.mjs";\n');
    assert.throws(() => verifyWebPreviewPackage(root), /Missing preview resource/);
    writeFileSync(entry, original + '\nimport "https://example.invalid/sneak.mjs";\n');
    assert.throws(() => verifyWebPreviewPackage(root), /Non-local preview resource/);
  });
});

test('untraceable dynamic imports and out-of-bundle symlinks are rejected', () => {
  withPreview(root => {
    const entry = join(root, 'web', 'app.mjs');
    const original = readFileSync(entry, 'utf8');
    writeFileSync(entry, original + '\nimport(variableModule);\n');
    assert.throws(() => verifyWebPreviewPackage(root), /Untraceable dynamic module import/);
    writeFileSync(entry, original);
    const draft = join(root, 'src', 'drafts.mjs');
    unlinkSync(draft);
    symlinkSync(join(repository, 'src', 'drafts.mjs'), draft);
    assert.throws(() => verifyWebPreviewPackage(root), /not a bundle-contained file/);
  });
});
