'use client';

/**
 * Pure TypeScript ZIP Archive Generator
 * Generates valid standard PKZip archive (.zip) with zero external dependencies.
 * Fully compatible with Windows Explorer, macOS Finder, Linux, 7-Zip, WinRAR.
 */

// CRC32 implementation
const CRC32_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function calculateCrc32(data: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ data[i]) & 0xFF];
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

export interface ZipFileInput {
  name: string;
  content: string | Uint8Array;
}

export function createZipArchive(files: ZipFileInput[]): Uint8Array {
  const encoder = new TextEncoder();
  const fileEntries: {
    nameBytes: Uint8Array;
    dataBytes: Uint8Array;
    crc32: number;
    offset: number;
  }[] = [];

  const localHeadersParts: Uint8Array[] = [];
  let currentOffset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const dataBytes = typeof file.content === 'string' ? encoder.encode(file.content) : file.content;
    const crc32 = calculateCrc32(dataBytes);

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const view = new DataView(localHeader.buffer);

    // Signature 0x04034b50
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true); // Version needed
    view.setUint16(6, 0x0800, true); // UTF-8 filename flag
    view.setUint16(8, 0, true); // Compression = Store (0)
    view.setUint16(10, 0x4821, true); // Time (dummy valid MS-DOS time)
    view.setUint16(12, 0x5d39, true); // Date (dummy valid MS-DOS date)
    view.setUint32(14, crc32, true);
    view.setUint32(18, dataBytes.length, true); // Compressed size
    view.setUint32(22, dataBytes.length, true); // Uncompressed size
    view.setUint16(26, nameBytes.length, true); // Filename length
    view.setUint16(28, 0, true); // Extra field length

    localHeader.set(nameBytes, 30);

    fileEntries.push({
      nameBytes,
      dataBytes,
      crc32,
      offset: currentOffset
    });

    localHeadersParts.push(localHeader);
    localHeadersParts.push(dataBytes);

    currentOffset += localHeader.length + dataBytes.length;
  }

  // Central Directory
  const centralDirParts: Uint8Array[] = [];
  const centralDirStartOffset = currentOffset;

  for (const entry of fileEntries) {
    const centralHeader = new Uint8Array(46 + entry.nameBytes.length);
    const view = new DataView(centralHeader.buffer);

    // Signature 0x02014b50
    view.setUint32(0, 0x02014b50, true);
    view.setUint16(4, 20, true); // Version made by
    view.setUint16(6, 20, true); // Version needed
    view.setUint16(8, 0x0800, true); // UTF-8 filename flag
    view.setUint16(10, 0, true); // Compression = Store (0)
    view.setUint16(12, 0x4821, true); // Time
    view.setUint16(14, 0x5d39, true); // Date
    view.setUint32(16, entry.crc32, true);
    view.setUint32(20, entry.dataBytes.length, true);
    view.setUint32(24, entry.dataBytes.length, true);
    view.setUint16(28, entry.nameBytes.length, true);
    view.setUint16(30, 0, true); // Extra length
    view.setUint16(32, 0, true); // Comment length
    view.setUint16(34, 0, true); // Disk number start
    view.setUint16(36, 0, true); // Internal attributes
    view.setUint32(38, 0, true); // External attributes
    view.setUint32(42, entry.offset, true); // Offset of local header

    centralHeader.set(entry.nameBytes, 46);
    centralDirParts.push(centralHeader);
  }

  const centralDirSize = centralDirParts.reduce((acc, p) => acc + p.length, 0);

  // End of Central Directory Record
  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  // Signature 0x06054b50
  eocdView.setUint32(0, 0x06054b50, true);
  eocdView.setUint16(4, 0, true); // Disk number
  eocdView.setUint16(6, 0, true); // Start disk
  eocdView.setUint16(8, fileEntries.length, true); // Number of records this disk
  eocdView.setUint16(10, fileEntries.length, true); // Total number of records
  eocdView.setUint32(12, centralDirSize, true); // Size of central directory
  eocdView.setUint32(16, centralDirStartOffset, true); // Offset of central directory
  eocdView.setUint16(20, 0, true); // Comment length

  // Concatenate all parts
  const totalLength = currentOffset + centralDirSize + eocd.length;
  const result = new Uint8Array(totalLength);
  let pos = 0;

  for (const part of [...localHeadersParts, ...centralDirParts, eocd]) {
    result.set(part, pos);
    pos += part.length;
  }

  return result;
}

export function downloadZipArchive(filename: string, files: ZipFileInput[]): void {
  try {
    const zipBytes = createZipArchive(files);
    const blob = new Blob([zipBytes], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch (error) {
    console.error('Erreur génération ZIP:', error);
  }
}
