const fs = require('fs');
const path = require('path');
const { createZipArchive } = require('./zip-writer');
const { MANIFEST_VERSION } = require('../extension/utils/constants');

const REQUIRED_MANIFEST_FIELDS = Object.freeze([
  'manifest_version',
  'name',
  'version',
  'description'
]);

const EXTENSION_DIR = path.resolve(__dirname, '..', 'extension');
const RELEASES_DIR = path.resolve(__dirname, '..', 'releases');
const MANIFEST_PATH = path.join(EXTENSION_DIR, 'manifest.json');

function validateManifest(manifest) {
  const errors = [];
  for (const field of REQUIRED_MANIFEST_FIELDS) {
    if (!manifest[field]) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  if (manifest.manifest_version !== MANIFEST_VERSION) {
    errors.push(`Expected manifest_version ${MANIFEST_VERSION}, got ${manifest.manifest_version}`);
  }

  const versionPattern = /^\d+\.\d+\.\d+$/;
  if (manifest.version && !versionPattern.test(manifest.version)) {
    errors.push(`Invalid version format "${manifest.version}" (expected x.y.z)`);
  }

  if (!Array.isArray(manifest.permissions) || manifest.permissions.length === 0) {
    errors.push('Missing or empty permissions array');
  }

  return errors;
}

function bumpPatchVersion(version) {
  const parts = version.split('.').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) {
    throw new Error(`Invalid version format: ${version}`);
  }
  parts[2] += 1;
  return parts.join('.');
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function listExtensionFiles(dir, base = '') {
  const entries = [];
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const relPath = path.join(base, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      entries.push(...listExtensionFiles(fullPath, relPath));
    } else {
      entries.push(relPath);
    }
  }
  return entries;
}

function createZip(sourceDir, outPath, files) {
  ensureDir(path.dirname(outPath));
  createZipArchive(sourceDir, outPath, files);
}

function packageRelease({ bump = false } = {}) {
  if (!fs.existsSync(MANIFEST_PATH)) {
    throw new Error(`Manifest not found at ${MANIFEST_PATH}`);
  }

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const errors = validateManifest(manifest);
  if (errors.length > 0) {
    throw new Error('Manifest validation failed:\n  - ' + errors.join('\n  - '));
  }

  let version = manifest.version;
  if (bump) {
    version = bumpPatchVersion(version);
    manifest.version = version;
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
    console.log(`Bumped version to ${version}`);
  }

  const files = listExtensionFiles(EXTENSION_DIR);
  if (files.length === 0) {
    throw new Error('No files found in extension directory');
  }

  const zipName = `faq-domslayer-v${version}.zip`;
  const zipPath = path.join(RELEASES_DIR, zipName);

  if (fs.existsSync(zipPath)) {
    fs.unlinkSync(zipPath);
  }

  createZip(EXTENSION_DIR, zipPath, files);

  const stats = fs.statSync(zipPath);
  const sizeKb = Math.round(stats.size / 1024);

  console.log('\nPackaged release:');
  console.log(`  File: ${zipName}`);
  console.log(`  Size: ${sizeKb} KB`);
  console.log(`  Files: ${files.length}`);
  console.log(`  Path: ${zipPath}`);

  return { zipName, zipPath, version, fileCount: files.length, sizeBytes: stats.size };
}

function main() {
  const args = process.argv.slice(2);
  const shouldBump = args.includes('--bump');

  try {
    packageRelease({ bump: shouldBump });
    process.exit(0);
  } catch (error) {
    console.error(`\nError: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  validateManifest,
  bumpPatchVersion,
  packageRelease,
  REQUIRED_MANIFEST_FIELDS
};
