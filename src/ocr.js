import sharp from 'sharp';
import { createWorker } from 'tesseract.js';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

let workerPromise;

async function worker() {
  if (!workerPromise) workerPromise = createWorker('eng');
  return workerPromise;
}

async function runOcr(input) {
  const w = await worker();
  const { data } = await w.recognize(input);
  return data?.text || '';
}

async function downloadImage(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Image download failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function saveTemp(buffer, name) {
  const file = path.join(os.tmpdir(), `${Date.now()}-${name}.png`);
  await fs.writeFile(file, buffer);
  return file;
}

function mergeTexts(texts) {
  return texts
    .filter(Boolean)
    .join('\n')
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean)
    .join('\n');
}

export async function ocrImage(url) {
  const texts = [];

  // Original method that was working
  try {
    const originalText = await runOcr(url);
    texts.push(originalText);
  } catch (err) {
    console.error('Original OCR failed:', err.message);
  }

  try {
    const original = await downloadImage(url);
    const meta = await sharp(original).metadata();

    const width = meta.width || 1000;
    const height = meta.height || 1000;

    const enhanced = await sharp(original)
      .resize({ width: Math.max(width * 2, 1400) })
      .grayscale()
      .normalize()
      .sharpen()
      .png()
      .toBuffer();

    const enhancedPath = await saveTemp(enhanced, 'enhanced');
    texts.push(await runOcr(enhancedPath));

    const cropTop = Math.floor(height * 0.08);
    const cropHeight = Math.floor(height * 0.84);

    const cropped = await sharp(original)
      .extract({
        left: 0,
        top: cropTop,
        width,
        height: cropHeight
      })
      .resize({ width: Math.max(width * 2, 1400) })
      .grayscale()
      .normalize()
      .sharpen()
      .png()
      .toBuffer();

    const croppedPath = await saveTemp(cropped, 'cropped');
    texts.push(await runOcr(croppedPath));
  } catch (err) {
    console.error('Enhanced OCR failed:', err.message);
  }

  const merged = mergeTexts(texts);

  console.log('OCR TEXT:\n' + merged);

  return merged;
}
