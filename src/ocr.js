import { createWorker } from 'tesseract.js';

let workerPromise;
async function worker() {
  if (!workerPromise) {
    workerPromise = createWorker('eng');
  }
  return workerPromise;
}

export async function ocrImage(url) {
  const w = await worker();
  const { data } = await w.recognize(url);
  return data?.text || '';
}
