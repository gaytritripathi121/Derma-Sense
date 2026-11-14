import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { parse } from 'csv-parse/sync';
import yauzl from 'yauzl';
import sharp from 'sharp';
import {
  CLASS_CODES,
  CODE_TO_INDEX,
  MENDELEY_DATASET_INFO,
  PATHS,
} from '../config/constants.js';

sharp.cache(false);
sharp.concurrency(1);

function ensureDirs() {
  for (const dir of [
    PATHS.dataRaw,
    path.join(PATHS.dataRaw, 'images'),
    PATHS.dataProcessed,
    PATHS.processedCache,
    PATHS.modelsDir,
    PATHS.trainedModelDir,
    PATHS.bestCheckpointDir,
    PATHS.latestCheckpointDir,
    PATHS.outputsDir,
    path.join(PATHS.outputsDir, 'metrics'),
    PATHS.logsDir,
    PATHS.reportsDir,
    PATHS.tmpDir,
  ]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export const datasetState = {
  downloadStatus: 'idle',
  downloadProgress: 0,
  downloadedBytes: 0,
  totalBytes: 0,
  downloadMessage: '',
  extractStatus: 'idle',
  extractProgress: 0,
  extractedFiles: 0,
  extractMessage: '',
  validateStatus: 'idle',
  validateMessage: '',
  logs: [],
};

function pushLog(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  datasetState.logs.push(line);
  if (datasetState.logs.length > 250) datasetState.logs.shift();
}

async function resolvePresignedZipUrl() {
  const res = await fetch(MENDELEY_DATASET_INFO.zipApiUrl, { redirect: 'manual' });
  const loc = res.headers.get('location');
  if (res.status >= 300 && res.status < 400 && loc) {
    return loc;
  }
  if (res.ok) {
    return MENDELEY_DATASET_INFO.zipApiUrl;
  }
  throw new Error(`Mendeley dataset redirect failed with HTTP ${res.status}`);
}

const DOWNLOAD_CHUNK_SIZE = 4 * 1024 * 1024; // 4 MB chunks to stay memory-safe

async function refreshPresignedUrl(urlRef, resolveUrlFn) {
  if (!urlRef.refreshing) {
    urlRef.refreshing = resolveUrlFn()
      .then((fresh) => {
        urlRef.url = fresh;
        urlRef.at = Date.now();
        return fresh;
      })
      .finally(() => {
        urlRef.refreshing = null;
      });
  }
  return urlRef.refreshing;
}

async function fetchRangeBuffer(urlRef, start, end, resolveUrlFn) {
  for (let attempt = 1; attempt <= 6; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120000);
    try {
      if (Date.now() - urlRef.at > 150 * 1000) {
        await refreshPresignedUrl(urlRef, resolveUrlFn);
      }
      const resp = await fetch(urlRef.url, {
        headers: { Range: `bytes=${start}-${end}` },
        signal: controller.signal,
      });
      if (resp.status !== 206 && resp.status !== 200) {
        if (resp.status === 403) {
          await refreshPresignedUrl(urlRef, resolveUrlFn);
        }
        throw new Error(`HTTP ${resp.status} for bytes ${start}-${end}`);
      }
      const buf = Buffer.from(await resp.arrayBuffer());
      clearTimeout(timer);
      return buf;
    } catch (err) {
      clearTimeout(timer);
      if (attempt === 6) throw err;
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
}

async function parseRemoteCentralDirectory(urlRef, totalBytes) {
  const tailLen = Math.min(totalBytes, 128 * 1024);
  const tailStart = totalBytes - tailLen;
  const buf = await fetchRangeBuffer(urlRef, tailStart, totalBytes - 1, resolvePresignedZipUrl);

  let eocdOffset = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset < 0) {
    throw new Error('Could not locate ZIP End of Central Directory in remote PAD-UFES-20 archive.');
  }

  const cdOffset = buf.readUInt32LE(eocdOffset + 16);
  const numEntries = buf.readUInt16LE(eocdOffset + 10);
  const cdRel = cdOffset - tailStart;
  if (cdRel < 0) {
    throw new Error('ZIP Central Directory spans beyond 128 KB tail buffer.');
  }

  const entries = [];
  let p = cdRel;
  for (let e = 0; e < numEntries && p + 46 <= buf.length; e++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const compMethod = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const uncompSize = buf.readUInt32LE(p + 24);
    const fnLen = buf.readUInt16LE(p + 28);
    const exLen = buf.readUInt16LE(p + 30);
    const cmLen = buf.readUInt16LE(p + 32);
    const localHdrOff = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + fnLen).toString('utf8');
    entries.push({ name, compMethod, compSize, uncompSize, localHdrOff });
    p += 46 + fnLen + exLen + cmLen;
  }
  return entries;
}

async function streamRemoteZipEntryToFile(urlRef, entry, destPath, onBytes) {
  const hdrBuf = await fetchRangeBuffer(
    urlRef,
    entry.localHdrOff,
    entry.localHdrOff + 63,
    resolvePresignedZipUrl
  );
  if (hdrBuf.readUInt32LE(0) !== 0x04034b50) {
    throw new Error(`Invalid local ZIP header for ${entry.name}`);
  }
  const fnLen = hdrBuf.readUInt16LE(26);
  const exLen = hdrBuf.readUInt16LE(28);
  const dataStart = entry.localHdrOff + 30 + fnLen + exLen;
  const totalComp = entry.compSize;
  const numChunks = Math.ceil(totalComp / DOWNLOAD_CHUNK_SIZE);

  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  const writeStream = fs.createWriteStream(destPath);
  const outStream = entry.compMethod === 8 ? zlib.createInflateRaw() : null;

  let streamError = null;
  const finishedPromise = new Promise((resolve, reject) => {
    writeStream.on('finish', resolve);
    writeStream.on('error', (err) => {
      streamError = err;
      reject(err);
    });
    if (outStream) {
      outStream.on('error', (err) => {
        streamError = err;
        reject(err);
      });
      outStream.pipe(writeStream);
    }
  });

  const targetStream = outStream || writeStream;
  const pendingBuffers = new Map();
  let nextToFetch = 0;
  let nextToWrite = 0;
  let flushing = false;
  let flushPending = false;
  const CONCURRENCY = 3;

  const flushOrdered = async () => {
    if (flushing) {
      flushPending = true;
      return;
    }
    flushing = true;
    try {
      do {
        flushPending = false;
        while (pendingBuffers.has(nextToWrite)) {
          const buf = pendingBuffers.get(nextToWrite);
          pendingBuffers.delete(nextToWrite);
          nextToWrite++;
          if (streamError) throw streamError;
          if (!targetStream.write(buf)) {
            await new Promise((r) => targetStream.once('drain', r));
          }
          if (onBytes) onBytes(buf.length);
        }
      } while (flushPending);
    } finally {
      flushing = false;
    }
  };

  async function worker() {
    while (nextToFetch < numChunks && !streamError) {
      // Bound lookahead so queued buffers stay under ~24 MB
      if (nextToFetch - nextToWrite >= 6) {
        await flushOrdered();
        await new Promise((r) => setTimeout(r, 120));
        continue;
      }
      const chunkIdx = nextToFetch++;
      const cStart = dataStart + chunkIdx * DOWNLOAD_CHUNK_SIZE;
      const cEnd = Math.min(dataStart + totalComp - 1, cStart + DOWNLOAD_CHUNK_SIZE - 1);
      const buf = await fetchRangeBuffer(urlRef, cStart, cEnd, resolvePresignedZipUrl);
      pendingBuffers.set(chunkIdx, buf);
      await flushOrdered();
    }
  }

  const activeWorkers = Math.min(CONCURRENCY, Math.max(1, numChunks));
  await Promise.all(Array.from({ length: activeWorkers }, () => worker()));
  await flushOrdered();
  targetStream.end();
  await finishedPromise;
}

async function extractNormalizedImagesFromPartZip(partZipPath, targetDir, { onEntry } = {}) {
  const zipfile = await openZip(partZipPath);
  let count = 0;

  await new Promise((resolve, reject) => {
    zipfile.readEntry();
    zipfile.on('entry', (entry) => {
      if (/\/$/.test(entry.fileName)) {
        zipfile.readEntry();
        return;
      }
      const baseName = path.basename(entry.fileName);
      if (!baseName || baseName.startsWith('._') || !/\.(png|jpg|jpeg)$/i.test(baseName)) {
        zipfile.readEntry();
        return;
      }

      const outPath = path.join(targetDir, baseName);
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      zipfile.openReadStream(entry, (err, readStream) => {
        if (err) return reject(err);
        const chunks = [];
        readStream.on('data', (c) => chunks.push(c));
        readStream.on('error', reject);
        readStream.on('end', async () => {
          try {
            const rawBuf = Buffer.concat(chunks);
            const isJpg = /\.(jpg|jpeg)$/i.test(baseName);
            const pipeline = sharp(rawBuf)
              .rotate()
              .resize(224, 224, { fit: 'inside', withoutEnlargement: true });
            if (isJpg) {
              await pipeline.jpeg({ quality: 88 }).toFile(outPath);
            } else {
              await pipeline.png({ compressionLevel: 3 }).toFile(outPath);
            }
            count++;
            if (onEntry) onEntry(count, baseName);
            zipfile.readEntry();
          } catch (procErr) {
            reject(procErr);
          }
        });
      });
    });
    zipfile.on('end', resolve);
    zipfile.on('error', reject);
  });

  return count;
}

export async function downloadOfficialDataset() {
  ensureDirs();
  if (datasetState.downloadStatus === 'downloading') {
    return { alreadyRunning: true, state: datasetState };
  }

  datasetState.downloadStatus = 'downloading';
  datasetState.downloadProgress = 0;
  datasetState.downloadedBytes = 0;
  datasetState.totalBytes = 0;
  datasetState.downloadMessage = 'Connecting to official Mendeley PAD-UFES-20 repository...';
  pushLog('Starting official PAD-UFES-20 download from Mendeley Data (zr7vgbcyr2 v1).');

  try {
    const metaPath = path.join(PATHS.dataRaw, 'metadata.csv');
    if (!fs.existsSync(metaPath) || fs.statSync(metaPath).size < 100000) {
      const metaRes = await fetch(MENDELEY_DATASET_INFO.metadataFileUrl);
      if (!metaRes.ok) {
        throw new Error(`Failed to fetch metadata.csv: HTTP ${metaRes.status}`);
      }
      const metaBuf = Buffer.from(await metaRes.arrayBuffer());
      fs.writeFileSync(metaPath, metaBuf);
      pushLog(`Downloaded metadata.csv (${metaBuf.length} bytes).`);
    } else {
      pushLog(`Preserving existing metadata.csv (${fs.statSync(metaPath).size} bytes).`);
    }

    const urlRef = { url: await resolvePresignedZipUrl(), at: Date.now() };
    const probeRes = await fetch(urlRef.url, { headers: { Range: 'bytes=0-0' } });
    if (probeRes.status !== 206 && probeRes.status !== 200) {
      throw new Error(`Unexpected response from Mendeley storage: HTTP ${probeRes.status}`);
    }
    const contentRange = probeRes.headers.get('content-range') || '';
    const match = contentRange.match(/\/(\d+)$/);
    const totalBytes = match
      ? Number(match[1])
      : Number(probeRes.headers.get('content-length') || 0);

    if (!totalBytes || totalBytes < 1024 * 1024) {
      throw new Error('Could not determine PAD-UFES-20 archive size from Mendeley storage.');
    }

    const entries = await parseRemoteCentralDirectory(urlRef, totalBytes);
    const partEntries = entries.filter((e) => /\.zip$/i.test(e.name));
    if (!partEntries.length) {
      throw new Error('No nested image part archives found in PAD-UFES-20 ZIP directory.');
    }

    const expectedBytes = partEntries.reduce((s, e) => s + e.compSize, 0);
    datasetState.totalBytes = expectedBytes;
    const imagesDir = path.join(PATHS.dataRaw, 'images');
    const manifestPath = path.join(PATHS.dataRaw, 'download_manifest.json');
    let manifest = { completedParts: [], extractedFiles: 0, totalArchiveBytes: totalBytes };
    if (fs.existsSync(manifestPath)) {
      try {
        manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      } catch {
        manifest = { completedParts: [], extractedFiles: 0, totalArchiveBytes: totalBytes };
      }
    }

    let doneBytes = partEntries
      .filter((e) => manifest.completedParts.includes(e.name))
      .reduce((s, e) => s + e.compSize, 0);
    datasetState.downloadedBytes = doneBytes;
    datasetState.downloadProgress = Math.round((doneBytes / expectedBytes) * 100);

    for (let i = 0; i < partEntries.length; i++) {
      const part = partEntries[i];
      if (manifest.completedParts.includes(part.name)) {
        pushLog(`Skipping already extracted ${part.name}.`);
        continue;
      }

      const stagingDir = path.join(PATHS.dataRaw, '.staging');
      const partTempPath = path.join(stagingDir, `pad_part_${i + 1}.zip`);
      datasetState.downloadMessage = `Streaming ${path.basename(part.name)} (${i + 1}/${partEntries.length})...`;
      pushLog(datasetState.downloadMessage);

      await streamRemoteZipEntryToFile(urlRef, part, partTempPath, (delta) => {
        doneBytes += delta;
        datasetState.downloadedBytes = doneBytes;
        datasetState.downloadProgress = Math.min(99, Math.round((doneBytes / expectedBytes) * 100));
        datasetState.downloadMessage = `Streaming ${path.basename(part.name)} (${i + 1}/${partEntries.length}): ${(doneBytes / (1024 * 1024)).toFixed(1)} MB / ${(expectedBytes / (1024 * 1024)).toFixed(1)} MB`;
      });

      datasetState.extractStatus = 'extracting';
      datasetState.extractMessage = `Extracting & normalizing ${path.basename(part.name)}...`;
      const partCount = await extractNormalizedImagesFromPartZip(partTempPath, imagesDir, {
        onEntry: (n, imgName) => {
          datasetState.extractedFiles = manifest.extractedFiles + n;
          datasetState.extractProgress = Math.min(
            99,
            Math.round((datasetState.extractedFiles / 2298) * 100)
          );
          if (n % 150 === 0) {
            datasetState.extractMessage = `Extracted ${datasetState.extractedFiles} images (latest: ${imgName})`;
          }
        },
      });

      try {
        fs.unlinkSync(partTempPath);
      } catch {
        // ignore
      }

      manifest.completedParts.push(part.name);
      manifest.extractedFiles += partCount;
      manifest.completedAt = new Date().toISOString();
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
      pushLog(`Completed ${part.name}: ${partCount} images saved cleanly.`);
    }

    try {
      fs.rmSync(path.join(PATHS.dataRaw, '.staging'), { recursive: true, force: true });
    } catch {
      // ignore
    }

    datasetState.downloadStatus = 'completed';
    datasetState.downloadProgress = 100;
    datasetState.downloadMessage = `Acquired & extracted ${manifest.extractedFiles} official PAD-UFES-20 images.`;
    datasetState.extractStatus = 'completed';
    datasetState.extractProgress = 100;
    datasetState.extractedFiles = manifest.extractedFiles;
    datasetState.extractMessage = `Extraction complete: ${manifest.extractedFiles} images ready.`;
    pushLog(datasetState.downloadMessage);
    return { success: true, state: datasetState };
  } catch (err) {
    datasetState.downloadStatus = 'error';
    datasetState.downloadMessage = err.message;
    pushLog(`Download error: ${err.message}`);
    throw err;
  }
}

function openZip(zipPath) {
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err) reject(err);
      else resolve(zipfile);
    });
  });
}

async function extractZipFile(zipPath, targetDir, { onEntry } = {}) {
  const zipfile = await openZip(zipPath);
  const nestedZips = [];
  let count = 0;

  await new Promise((resolve, reject) => {
    zipfile.readEntry();
    zipfile.on('entry', (entry) => {
      if (/\/$/.test(entry.fileName)) {
        zipfile.readEntry();
        return;
      }

      const lower = entry.fileName.toLowerCase();
      const baseName = path.basename(entry.fileName);

      if (!baseName || baseName.startsWith('._')) {
        zipfile.readEntry();
        return;
      }

      let outPath = null;
      if (lower.endsWith('.csv') && baseName.toLowerCase().includes('metadata')) {
        outPath = path.join(PATHS.dataRaw, 'metadata.csv');
      } else if (lower.endsWith('.zip')) {
        outPath = path.join(PATHS.tmpDir, `nested_${Date.now()}_${baseName}`);
        nestedZips.push(outPath);
      } else if (/\.(png|jpg|jpeg)$/i.test(lower)) {
        outPath = path.join(targetDir, baseName);
      }

      if (!outPath) {
        zipfile.readEntry();
        return;
      }

      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      zipfile.openReadStream(entry, (err, readStream) => {
        if (err) return reject(err);
        const writeStream = fs.createWriteStream(outPath);
        readStream.on('error', reject);
        writeStream.on('error', reject);
        readStream.pipe(writeStream);
        writeStream.on('finish', () => {
          count++;
          if (onEntry) onEntry(count, baseName);
          zipfile.readEntry();
        });
      });
    });
    zipfile.on('end', resolve);
    zipfile.on('error', reject);
  });

  for (const nested of nestedZips) {
    pushLog(`Extracting nested archive ${path.basename(nested)}...`);
    const nestedCount = await extractZipFile(nested, targetDir, { onEntry });
    count += nestedCount;
    try {
      fs.unlinkSync(nested);
    } catch {
      // ignore
    }
  }

  return count;
}

export async function extractDatasetArchive(customZipPath = null) {
  ensureDirs();
  if (datasetState.extractStatus === 'extracting') {
    return { alreadyRunning: true, state: datasetState };
  }

  const zipPath = customZipPath || path.join(PATHS.dataRaw, 'pad-ufes-20.zip');
  if (!fs.existsSync(zipPath)) {
    throw new Error('Dataset archive not found in data/raw/pad-ufes-20.zip. Download or upload the ZIP first.');
  }

  datasetState.extractStatus = 'extracting';
  datasetState.extractProgress = 5;
  datasetState.extractedFiles = 0;
  datasetState.extractMessage = 'Reading archive entries...';
  pushLog(`Extracting ${path.basename(zipPath)}...`);

  try {
    const imagesDir = path.join(PATHS.dataRaw, 'images');
    let lastLogged = 0;
    const extracted = await extractZipFile(zipPath, imagesDir, {
      onEntry: (n, name) => {
        datasetState.extractedFiles = n;
        if (n - lastLogged >= 200) {
          lastLogged = n;
          datasetState.extractProgress = Math.min(95, Math.round((n / 2300) * 95));
          datasetState.extractMessage = `Extracted ${n} files (latest: ${name})`;
        }
      },
    });

    datasetState.extractStatus = 'completed';
    datasetState.extractProgress = 100;
    datasetState.extractMessage = `Extraction complete: ${extracted} files extracted.`;
    pushLog(datasetState.extractMessage);
    return { success: true, extractedFiles: extracted, state: datasetState };
  } catch (err) {
    datasetState.extractStatus = 'error';
    datasetState.extractMessage = err.message;
    pushLog(`Extraction error: ${err.message}`);
    throw err;
  }
}

function findColumn(columns, candidates) {
  const lowerMap = new Map(columns.map((c) => [c.toLowerCase().trim(), c]));
  for (const cand of candidates) {
    if (lowerMap.has(cand.toLowerCase())) return lowerMap.get(cand.toLowerCase());
  }
  return null;
}

export function createPatientLesionSplits(records) {
  const parent = new Map();
  function find(x) {
    if (!parent.has(x)) parent.set(x, x);
    if (parent.get(x) !== x) parent.set(x, find(parent.get(x)));
    return parent.get(x);
  }
  function union(a, b) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  }

  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const pKey = `P:${r.patientId || `UNKNOWN_${i}`}`;
    const lKey = r.lesionId ? `L:${r.lesionId}` : `R:${i}`;
    union(pKey, lKey);
  }

  const groupMap = new Map();
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const root = find(`P:${r.patientId || `UNKNOWN_${i}`}`);
    if (!groupMap.has(root)) groupMap.set(root, []);
    groupMap.get(root).push(r);
  }

  let seed = 42;
  function rand() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  const groups = Array.from(groupMap.values());
  const totalClassCounts = {};
  for (const c of CLASS_CODES) totalClassCounts[c] = 0;
  for (const r of records) totalClassCounts[r.label]++;

  for (let i = groups.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [groups[i], groups[j]] = [groups[j], groups[i]];
  }

  groups.sort((a, b) => {
    const minA = Math.min(...a.map((r) => totalClassCounts[r.label] || 1));
    const minB = Math.min(...b.map((r) => totalClassCounts[r.label] || 1));
    return minA - minB;
  });

  const targetRatios = { train: 0.7, val: 0.15, test: 0.15 };
  const splitBuckets = { train: [], val: [], test: [] };
  const splitClassCounts = {
    train: Object.fromEntries(CLASS_CODES.map((c) => [c, 0])),
    val: Object.fromEntries(CLASS_CODES.map((c) => [c, 0])),
    test: Object.fromEntries(CLASS_CODES.map((c) => [c, 0])),
  };

  for (const grp of groups) {
    const grpCounts = {};
    for (const r of grp) grpCounts[r.label] = (grpCounts[r.label] || 0) + 1;

    let bestSplit = 'train';
    let bestScore = Infinity;

    for (const splitName of ['train', 'val', 'test']) {
      const targetRatio = targetRatios[splitName];
      let err = 0;
      for (const cls of Object.keys(grpCounts)) {
        const expected = (totalClassCounts[cls] || 1) * targetRatio;
        const current = splitClassCounts[splitName][cls];
        const after = current + grpCounts[cls];
        err += (after - expected) / Math.max(1, expected);
      }
      const totalAfter = splitBuckets[splitName].length + grp.length;
      const totalExpected = records.length * targetRatio;
      err += (totalAfter - totalExpected) / Math.max(1, totalExpected);

      if (err < bestScore) {
        bestScore = err;
        bestSplit = splitName;
      }
    }

    splitBuckets[bestSplit].push(...grp);
    for (const r of grp) {
      splitClassCounts[bestSplit][r.label]++;
    }
  }

  const trainPatients = new Set(splitBuckets.train.map((r) => r.patientId));
  const valPatients = new Set(splitBuckets.val.map((r) => r.patientId));
  const testPatients = new Set(splitBuckets.test.map((r) => r.patientId));

  let patientLeakage = 0;
  for (const p of valPatients) if (trainPatients.has(p)) patientLeakage++;
  for (const p of testPatients) if (trainPatients.has(p) || valPatients.has(p)) patientLeakage++;

  const summarize = (arr) => ({
    images: arr.length,
    patients: new Set(arr.map((r) => r.patientId)).size,
    lesions: new Set(arr.map((r) => r.lesionId)).size,
    classCounts: Object.fromEntries(
      CLASS_CODES.map((c) => [c, arr.filter((r) => r.label === c).length])
    ),
  });

  return {
    seed: 42,
    strategy: 'Patient-and-Lesion Grouped Stratified Splitting (70% train / 15% val / 15% test)',
    leakageVerified: patientLeakage === 0,
    patientLeakageCount: patientLeakage,
    summary: {
      train: summarize(splitBuckets.train),
      val: summarize(splitBuckets.val),
      test: summarize(splitBuckets.test),
    },
    splits: splitBuckets,
  };
}

export async function validateAndInspectDataset() {
  ensureDirs();
  datasetState.validateStatus = 'validating';
  datasetState.validateMessage = 'Parsing metadata.csv and inspecting image files...';
  pushLog('Running PAD-UFES-20 dataset validation...');

  try {
    const metaPath = path.join(PATHS.dataRaw, 'metadata.csv');
    if (!fs.existsSync(metaPath)) {
      throw new Error('metadata.csv not found in data/raw/. Download or upload metadata.csv first.');
    }

    const csvText = fs.readFileSync(metaPath, 'utf8');
    const rows = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    if (!rows.length) {
      throw new Error('metadata.csv is empty.');
    }

    const columns = Object.keys(rows[0]);
    const imgCol = findColumn(columns, ['img_id', 'image_id', 'filename', 'image']);
    const diagCol = findColumn(columns, ['diagnostic', 'label', 'class', 'diagnosis']);
    const patCol = findColumn(columns, ['patient_id', 'patient']);
    const lesCol = findColumn(columns, ['lesion_id', 'lesion']);

    if (!imgCol || !diagCol) {
      throw new Error(
        `Required columns missing in metadata.csv. Found: ${columns.join(', ')}`
      );
    }

    const imageMap = new Map();
    function scanDir(dir) {
      if (!fs.existsSync(dir)) return;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDir(full);
        } else if (/\.(png|jpg|jpeg)$/i.test(entry.name)) {
          imageMap.set(entry.name, full);
          imageMap.set(entry.name.toLowerCase(), full);
        }
      }
    }
    scanDir(path.join(PATHS.dataRaw, 'images'));

    const missingValuesByColumn = {};
    for (const c of columns) missingValuesByColumn[c] = 0;

    const seenImgIds = new Set();
    const duplicateRecords = [];
    const missingFiles = [];
    const invalidLabels = [];
    const corruptedImages = [];
    const usableRecords = [];
    const patientSet = new Set();
    const lesionSet = new Set();
    const classDistribution = Object.fromEntries(CLASS_CODES.map((c) => [c, 0]));

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      for (const c of columns) {
        if (row[c] === undefined || row[c] === null || String(row[c]).trim() === '') {
          missingValuesByColumn[c]++;
        }
      }

      const imgName = String(row[imgCol] || '').trim();
      const rawLabel = String(row[diagCol] || '').trim().toUpperCase();
      const patientId = patCol ? String(row[patCol] || '').trim() : `PAT_${i}`;
      const lesionId = lesCol ? String(row[lesCol] || '').trim() : `LES_${i}`;

      if (patientId) patientSet.add(patientId);
      if (lesionId) lesionSet.add(lesionId);

      if (seenImgIds.has(imgName)) {
        duplicateRecords.push(imgName);
        continue;
      }
      seenImgIds.add(imgName);

      if (!CLASS_CODES.includes(rawLabel)) {
        invalidLabels.push({ imgName, label: rawLabel });
        continue;
      }

      const filePath = imageMap.get(imgName) || imageMap.get(imgName.toLowerCase());
      if (!filePath || !fs.existsSync(filePath)) {
        missingFiles.push(imgName);
        continue;
      }

      usableRecords.push({
        imgId: imgName,
        filePath,
        label: rawLabel,
        labelIndex: CODE_TO_INDEX[rawLabel],
        patientId: patientId || `PAT_${i}`,
        lesionId: lesionId || `LES_${i}`,
        age: row.age ? Number(row.age) : null,
        gender: row.gender || null,
        fitspatrick: row.fitspatrick || null,
        region: row.region || null,
        biopsed: row.biopsed || null,
      });
    }

    const verifiedRecords = [];
    const BATCH = 24;
    for (let i = 0; i < usableRecords.length; i += BATCH) {
      const slice = usableRecords.slice(i, i + BATCH);
      const checks = await Promise.all(
        slice.map(async (rec) => {
          try {
            const meta = await sharp(rec.filePath).metadata();
            if (!meta.width || !meta.height || meta.width < 16 || meta.height < 16) {
              return { ok: false, rec, reason: 'Invalid dimensions' };
            }
            return { ok: true, rec: { ...rec, width: meta.width, height: meta.height, format: meta.format } };
          } catch (err) {
            return { ok: false, rec, reason: err.message };
          }
        })
      );
      for (const c of checks) {
        if (c.ok) {
          verifiedRecords.push(c.rec);
          classDistribution[c.rec.label]++;
        } else {
          corruptedImages.push({ imgId: c.rec.imgId, reason: c.reason });
        }
      }
    }

    let splitResult = null;
    if (verifiedRecords.length >= 12) {
      splitResult = createPatientLesionSplits(verifiedRecords);
      fs.writeFileSync(PATHS.splitsFile, JSON.stringify(splitResult, null, 2));
    }

    const previewMetadata = rows.slice(0, 15);
    const previewImages = verifiedRecords.slice(0, 12).map((r) => ({
      imgId: r.imgId,
      label: r.label,
      patientId: r.patientId,
      lesionId: r.lesionId,
      width: r.width,
      height: r.height,
      region: r.region,
      biopsed: r.biopsed,
    }));

    const isReady = verifiedRecords.length >= 60 && missingFiles.length === 0;
    const report = {
      validatedAt: new Date().toISOString(),
      source: MENDELEY_DATASET_INFO.sourcePage,
      metadataRows: rows.length,
      discoveredImageFiles: imageMap.size / 2,
      usableRecordsCount: verifiedRecords.length,
      patientCount: patientSet.size,
      lesionCount: lesionSet.size,
      detectedColumns: columns,
      mappedColumns: { imageCol: imgCol, diagnosticCol: diagCol, patientCol: patCol, lesionCol: lesCol },
      classDistribution,
      missingValuesByColumn,
      missingFilesCount: missingFiles.length,
      missingFilesSample: missingFiles.slice(0, 50),
      duplicateRecordsCount: duplicateRecords.length,
      duplicateRecordsSample: duplicateRecords.slice(0, 50),
      corruptedImagesCount: corruptedImages.length,
      corruptedImagesSample: corruptedImages.slice(0, 50),
      invalidLabelsCount: invalidLabels.length,
      invalidLabelsSample: invalidLabels.slice(0, 50),
      datasetReady: verifiedRecords.length >= 30 && Boolean(splitResult),
      fullyComplete: isReady,
      splitSummary: splitResult ? splitResult.summary : null,
      leakageVerified: splitResult ? splitResult.leakageVerified : false,
      previewMetadata,
      previewImages,
    };

    fs.writeFileSync(PATHS.validationReportFile, JSON.stringify(report, null, 2));
    datasetState.validateStatus = 'completed';
    datasetState.validateMessage = `Validated ${verifiedRecords.length} usable images across ${patientSet.size} patients and ${lesionSet.size} lesions.`;
    pushLog(datasetState.validateMessage);
    return report;
  } catch (err) {
    datasetState.validateStatus = 'error';
    datasetState.validateMessage = err.message;
    pushLog(`Validation error: ${err.message}`);
    throw err;
  }
}

export function getDatasetStats() {
  ensureDirs();
  const zipPath = path.join(PATHS.dataRaw, 'pad-ufes-20.zip');
  const manifestPath = path.join(PATHS.dataRaw, 'download_manifest.json');
  const zipExists = fs.existsSync(zipPath);
  const zipSize = zipExists ? fs.statSync(zipPath).size : 0;

  let manifestDone = false;
  let manifestTotal = 0;
  if (fs.existsSync(manifestPath)) {
    try {
      const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      manifestDone = Array.isArray(m.completedParts) && m.completedParts.length >= 3;
      manifestTotal = m.totalArchiveBytes || 0;
    } catch {
      manifestDone = false;
    }
  }

  const metadataExists = fs.existsSync(path.join(PATHS.dataRaw, 'metadata.csv'));
  const imagesDir = path.join(PATHS.dataRaw, 'images');
  const extractedImagesCount = fs.existsSync(imagesDir)
    ? fs.readdirSync(imagesDir).filter((f) => /\.(png|jpg|jpeg)$/i.test(f)).length
    : 0;

  let validationReport = null;
  if (fs.existsSync(PATHS.validationReportFile)) {
    try {
      validationReport = JSON.parse(fs.readFileSync(PATHS.validationReportFile, 'utf8'));
    } catch {
      validationReport = null;
    }
  }

  return {
    zipDownloaded: manifestDone || (zipExists && zipSize > 1024 * 1024),
    zipSizeBytes: manifestDone ? manifestTotal : zipSize,
    metadataDownloaded: metadataExists,
    extractedImagesCount,
    datasetExtracted: extractedImagesCount > 0,
    datasetValidated: Boolean(validationReport),
    datasetReady: Boolean(validationReport?.datasetReady),
    validationReport,
    liveState: datasetState,
  };
}
