const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buffer) {
  const table = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }

  let crc = -1;
  for (let i = 0; i < buffer.length; i++) {
    crc = table[(crc ^ buffer[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ -1) >>> 0;
}

function writeUInt32LE(buffer, value, offset) {
  buffer[offset] = value & 0xFF;
  buffer[offset + 1] = (value >>> 8) & 0xFF;
  buffer[offset + 2] = (value >>> 16) & 0xFF;
  buffer[offset + 3] = (value >>> 24) & 0xFF;
}

function localFileHeader(fileName, compressedSize, uncompressedSize, crc, compressionMethod) {
  const nameBuffer = Buffer.from(fileName, 'utf8');
  const header = Buffer.alloc(30 + nameBuffer.length);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0, 6);
  header.writeUInt16LE(compressionMethod, 8);
  header.writeUInt16LE(0, 10);
  header.writeUInt16LE(0, 12);
  writeUInt32LE(header, crc, 14);
  header.writeUInt32LE(compressedSize, 18);
  header.writeUInt32LE(uncompressedSize, 22);
  header.writeUInt16LE(nameBuffer.length, 26);
  header.writeUInt16LE(0, 28);
  nameBuffer.copy(header, 30);
  return header;
}

function centralDirectoryRecord(fileName, compressedSize, uncompressedSize, crc, offset, compressionMethod) {
  const nameBuffer = Buffer.from(fileName, 'utf8');
  const record = Buffer.alloc(46 + nameBuffer.length);
  record.writeUInt32LE(0x02014b50, 0);
  record.writeUInt16LE(20, 4);
  record.writeUInt16LE(20, 6);
  record.writeUInt16LE(0, 8);
  record.writeUInt16LE(compressionMethod, 10);
  record.writeUInt16LE(0, 12);
  record.writeUInt16LE(0, 14);
  writeUInt32LE(record, crc, 16);
  record.writeUInt32LE(compressedSize, 20);
  record.writeUInt32LE(uncompressedSize, 24);
  record.writeUInt16LE(nameBuffer.length, 28);
  record.writeUInt16LE(0, 30);
  record.writeUInt16LE(0, 32);
  record.writeUInt16LE(0, 34);
  record.writeUInt16LE(0, 36);
  record.writeUInt32LE(0, 38);
  record.writeUInt32LE(offset, 42);
  nameBuffer.copy(record, 46);
  return record;
}

function endOfCentralDirectory(centralDirSize, centralDirOffset, numEntries) {
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(numEntries, 8);
  eocd.writeUInt16LE(numEntries, 10);
  eocd.writeUInt32LE(centralDirSize, 12);
  eocd.writeUInt32LE(centralDirOffset, 16);
  eocd.writeUInt16LE(0, 20);
  return eocd;
}

function createZipArchive(sourceDir, outPath, files) {
  const parts = [];
  let currentOffset = 0;
  const centralDirEntries = [];

  for (const file of files) {
    const filePath = path.join(sourceDir, file);
    const data = fs.readFileSync(filePath);
    const fileCrc = crc32(data);

    let compressed = data;
    let compressionMethod = 8;
    try {
      compressed = zlib.deflateRawSync(data);
      if (compressed.length >= data.length) {
        compressed = data;
        compressionMethod = 0;
      }
    } catch {
      compressed = data;
      compressionMethod = 0;
    }

    const lfh = localFileHeader(file, compressed.length, data.length, fileCrc, compressionMethod);
    parts.push(lfh);
    parts.push(compressed);

    const cdr = centralDirectoryRecord(file, compressed.length, data.length, fileCrc, currentOffset, compressionMethod);
    centralDirEntries.push(cdr);

    currentOffset += lfh.length + compressed.length;
  }

  const centralDirOffset = currentOffset;
  const centralDirSize = centralDirEntries.reduce((sum, e) => sum + e.length, 0);

  for (const entry of centralDirEntries) {
    parts.push(entry);
  }

  parts.push(endOfCentralDirectory(centralDirSize, centralDirOffset, files.length));

  const outBuffer = Buffer.concat(parts);
  fs.writeFileSync(outPath, outBuffer);
}

module.exports = { createZipArchive, crc32 };
