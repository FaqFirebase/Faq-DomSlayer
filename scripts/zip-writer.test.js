const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { createZipArchive, crc32 } = require('./zip-writer');

function testCrc32() {
  assert.strictEqual(crc32(Buffer.from('')), 0);
  assert.strictEqual(crc32(Buffer.from('hello')), 907060870);
  assert.strictEqual(crc32(Buffer.from('FAQ DomSlayer')), 2273350456);
}

function testCreateZipArchive() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aico-zip-test-'));
  const srcDir = path.join(tmpDir, 'src');
  const outDir = path.join(tmpDir, 'out');
  fs.mkdirSync(srcDir, { recursive: true });
  fs.mkdirSync(outDir, { recursive: true });

  fs.writeFileSync(path.join(srcDir, 'a.txt'), 'Hello World');
  fs.writeFileSync(path.join(srcDir, 'b.txt'), 'Second file content');
  const nestedDir = path.join(srcDir, 'nested');
  fs.mkdirSync(nestedDir);
  fs.writeFileSync(path.join(nestedDir, 'c.txt'), 'Nested content');

  const zipPath = path.join(outDir, 'test.zip');
  createZipArchive(srcDir, zipPath, ['a.txt', 'b.txt', 'nested/c.txt']);

  assert.ok(fs.existsSync(zipPath), 'ZIP file should exist');
  assert.ok(fs.statSync(zipPath).size > 0, 'ZIP file should not be empty');

  const zipData = fs.readFileSync(zipPath);
  const eocdSignature = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
  assert.ok(zipData.includes(eocdSignature), 'ZIP should contain EOCD record');

  fs.rmSync(tmpDir, { recursive: true, force: true });
}

function testCreateZipArchiveWithBinary() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aico-zip-bin-'));
  const srcDir = path.join(tmpDir, 'src');
  fs.mkdirSync(srcDir);

  const binaryData = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  fs.writeFileSync(path.join(srcDir, 'image.png'), binaryData);

  const zipPath = path.join(tmpDir, 'bin.zip');
  createZipArchive(srcDir, zipPath, ['image.png']);

  assert.ok(fs.existsSync(zipPath));
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

function runTests() {
  const tests = [
    { name: 'crc32', fn: testCrc32 },
    { name: 'createZipArchive', fn: testCreateZipArchive },
    { name: 'createZipArchiveWithBinary', fn: testCreateZipArchiveWithBinary }
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
