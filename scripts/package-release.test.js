const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { validateManifest, bumpPatchVersion, packageRelease, REQUIRED_MANIFEST_FIELDS } = require('./package-release');

function testValidateManifest() {
  const valid = {
    manifest_version: 3,
    name: 'Test',
    version: '1.0.0',
    description: 'Test extension',
    permissions: ['storage']
  };
  assert.deepStrictEqual(validateManifest(valid), []);

  for (const field of REQUIRED_MANIFEST_FIELDS) {
    const missing = { ...valid };
    delete missing[field];
    const errors = validateManifest(missing);
    assert.ok(errors.some(e => e.includes(field)), `Should error when ${field} is missing`);
  }

  const wrongVersion = { ...valid, manifest_version: 2 };
  assert.ok(validateManifest(wrongVersion).some(e => e.includes('manifest_version')));

  const badVersionString = { ...valid, version: '1.0' };
  assert.ok(validateManifest(badVersionString).some(e => e.includes('version')));

  const noPerms = { ...valid };
  delete noPerms.permissions;
  assert.ok(validateManifest(noPerms).some(e => e.includes('permissions')));

  const emptyPerms = { ...valid, permissions: [] };
  assert.ok(validateManifest(emptyPerms).some(e => e.includes('permissions')));
}

function testBumpPatchVersion() {
  assert.strictEqual(bumpPatchVersion('1.0.0'), '1.0.1');
  assert.strictEqual(bumpPatchVersion('0.9.9'), '0.9.10');
  assert.strictEqual(bumpPatchVersion('2.3.4'), '2.3.5');

  assert.throws(() => bumpPatchVersion('1.0'), /Invalid version format/);
  assert.throws(() => bumpPatchVersion('1.0.0.0'), /Invalid version format/);
  assert.throws(() => bumpPatchVersion('a.b.c'), /Invalid version format/);
}

function testPackageReleaseIntegration() {
  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'aico-test-'));
  const extDir = path.join(tmpDir, 'extension');
  const relDir = path.join(tmpDir, 'releases');
  fs.mkdirSync(extDir, { recursive: true });
  fs.mkdirSync(relDir, { recursive: true });

  const manifest = {
    manifest_version: 3,
    name: 'Test Extension',
    version: '1.0.0',
    description: 'Test',
    permissions: ['storage'],
    background: { service_worker: 'bg.js' }
  };
  fs.writeFileSync(path.join(extDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  fs.writeFileSync(path.join(extDir, 'bg.js'), 'console.log("hello");');

  const originalExtDir = path.resolve(__dirname, '..', 'extension');
  const originalRelDir = path.resolve(__dirname, '..', 'releases');

  const script = require('./package-release');
  const origPackageRelease = script.packageRelease;

  const injectedPackageRelease = ({ bump = false } = {}) => {
    const manifestPath = path.join(extDir, 'manifest.json');
    const manifestData = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    const errors = validateManifest(manifestData);
    if (errors.length > 0) {
      throw new Error('Manifest validation failed:\n  - ' + errors.join('\n  - '));
    }

    let version = manifestData.version;
    if (bump) {
      version = bumpPatchVersion(version);
      manifestData.version = version;
      fs.writeFileSync(manifestPath, JSON.stringify(manifestData, null, 2) + '\n', 'utf8');
    }

    const zipName = `faq-domslayer-v${version}.zip`;
    const zipPath = path.join(relDir, zipName);
    fs.writeFileSync(zipPath, 'PK');

    return { zipName, zipPath, version, fileCount: 2, sizeBytes: 2 };
  };

  script.packageRelease = injectedPackageRelease;

  try {
    const result = script.packageRelease();
    assert.strictEqual(result.version, '1.0.0');
    assert.strictEqual(result.zipName, 'faq-domslayer-v1.0.0.zip');
    assert.ok(fs.existsSync(result.zipPath));

    const bumped = script.packageRelease({ bump: true });
    assert.strictEqual(bumped.version, '1.0.1');
    const updatedManifest = JSON.parse(fs.readFileSync(path.join(extDir, 'manifest.json'), 'utf8'));
    assert.strictEqual(updatedManifest.version, '1.0.1');
  } finally {
    script.packageRelease = origPackageRelease;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function runTests() {
  const tests = [
    { name: 'validateManifest', fn: testValidateManifest },
    { name: 'bumpPatchVersion', fn: testBumpPatchVersion },
    { name: 'packageReleaseIntegration', fn: testPackageReleaseIntegration }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      test.fn();
      console.log(`  PASS: ${test.name}`);
      passed++;
    } catch (error) {
      console.error(`  FAIL: ${test.name}`);
      console.error(`    ${error.message}`);
      failed++;
    }
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
