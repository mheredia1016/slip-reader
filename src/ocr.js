import sharp from 'sharp';
import { createWorker } from 'tesseract.js';

let workerPromise;

async function worker() {
  if (!workerPromise) {
    workerPromise = createWorker('eng');
  }
  return workerPromise;
}

async function runOcr(input) {
  const w = await worker();
  const { data } = await w.recognize(input);
  return data?.text || '';
}

async function imageBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Image download failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

function uniqueLines(texts) {
  const seen = new Set();
  const lines = [];

  for (const text of texts) {
    for (const line of String(text).split(/\r?\n/)) {
      const clean = line.replace(/\s+/g, ' ').trim();
      if (!clean) continue;
      const key = clean.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      lines.push(clean);
    }
  }

  return lines.join('\n');
}

export async function ocrImage(url) {
  const original = await imageBuffer(url);
  const meta = await sharp(original).metadata();

  const width = meta.width || 1000;
  const height = meta.height || 1000;

  const cropTop = Math.round(height * 0.12);
  const cropHeight = Math.round(height * 0.76);

  const normal = await sharp(original)
    .resize({ width: Math.max(1400, width * 2) })
    .png()
    .toBuffer();

  const cropped = await sharp(original)
    .extract({
      left: 0,
      top: cropTop,
      width,
      height: cropHeight
    })
    .resize({ width: Math.max(1600, width * 2.5) })
    .png()
    .toBuffer();

  const contrast = await sharp(original)
    .grayscale()
    .normalize()
    .linear(1.35, -20)
    .resize({ width: Math.max(1600, width * 2.5) })
    .png()
    .toBuffer();

  const croppedContrast = await sharp(original)
    .extract({
      left: 0,
      top: cropTop,
      width,
      height: cropHeight
    })
    .grayscale()
    .normalize()
    .linear(1.5, -25)
    .resize({ width: Math.max(1800, width * 3) })
    .png()
    .toBuffer();

  const texts = [];

  for (const img of [normal, cropped, contrast, croppedContrast]) {
    try {
      texts.push(await runOcr(img));
    } catch (err) {
      console.error('OCR pass failed:', err.message);
    }
  }

  const merged = uniqueLines(texts);

  console.log('OCR TEXT:\n' + merged);

  return merged;
}
