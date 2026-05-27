import { Worker } from 'bullmq';
import { QdrantClient } from '@qdrant/js-client-rest';
import pdfParse from 'pdf-parse';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import { createClient } from './redisClient.js';

dotenv.config();

// ✅ FIX: API key + trim + no version check
const qdrant = new QdrantClient({
  url: (process.env.QDRANT_URL || 'http://localhost:6333').trim(),
  ...(process.env.QDRANT_API_KEY ? { apiKey: process.env.QDRANT_API_KEY.trim() } : {}),
  checkCompatibility: false,
});

const COLLECTION = 'docmind_chunks';
const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 150;

function chunkText(text, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end).trim());
    start += chunkSize - overlap;
  }
  return chunks.filter((c) => c.length > 50);
}

function textToVector(text, dim = 1536) {
  const vec = new Array(dim).fill(0);
  const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, '');
  const words = normalized.split(/\s+/);
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    let h1 = 0, h2 = 0;
    for (let j = 0; j < word.length; j++) {
      h1 = (Math.imul(31, h1) + word.charCodeAt(j)) | 0;
      h2 = (Math.imul(37, h2) + word.charCodeAt(j)) | 0;
    }
    vec[Math.abs(h1) % dim] += 1;
    vec[Math.abs(h2) % dim] += 0.5;
    if (i + 1 < words.length) {
      const bigram = word + '_' + words[i + 1];
      let hb = 0;
      for (let j = 0; j < bigram.length; j++) hb = (Math.imul(41, hb) + bigram.charCodeAt(j)) | 0;
      vec[Math.abs(hb) % dim] += 0.75;
    }
  }
  const magnitude = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / magnitude);
}

async function ensureCollection() {
  try {
    await qdrant.getCollection(COLLECTION);
  } catch {
    try {
      await qdrant.createCollection(COLLECTION, {
        vectors: { size: 1536, distance: 'Cosine' },
      });
    } catch (e) {
      console.error('Could not create collection:', e?.data || e?.message);
    }
  }
}

const redisConnection = createClient();

const worker = new Worker(
  'pdf-processing',
  async (job) => {
    const { docId, docName, buffer } = job.data;
    console.log(`Processing PDF: ${docName} (${docId})`);
    await ensureCollection();

    const pdfBuffer = Buffer.from(buffer, 'base64');
    const parsed = await pdfParse(pdfBuffer);
    const totalPages = parsed.numpages;
    const uploadedAt = new Date().toISOString();

    const rawPages = parsed.text.split(/\f/);
    const pages = rawPages.length > 1 ? rawPages : splitIntoPages(parsed.text, totalPages);

    const points = [];
    for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
      const pageText = pages[pageIdx]?.trim();
      if (!pageText) continue;
      const pageNum = pageIdx + 1;
      const chunks = chunkText(pageText);
      for (const chunk of chunks) {
        points.push({
          id: uuidv4(),
          vector: textToVector(chunk),
          payload: { docId, docName, page: pageNum, totalPages, uploadedAt, text: chunk },
        });
      }
    }

    const BATCH = 100;
    for (let i = 0; i < points.length; i += BATCH) {
      await qdrant.upsert(COLLECTION, { points: points.slice(i, i + BATCH) });
      console.log(`Upserted ${Math.min(i + BATCH, points.length)}/${points.length} chunks`);
    }

    console.log(`Done: ${docName} — ${totalPages} pages, ${points.length} chunks`);
    return { docId, totalPages, chunks: points.length };
  },
  { connection: redisConnection, concurrency: 2 }
);

function splitIntoPages(text, totalPages) {
  if (totalPages <= 1) return [text];
  const charsPerPage = Math.ceil(text.length / totalPages);
  return Array.from({ length: totalPages }, (_, i) =>
    text.slice(i * charsPerPage, (i + 1) * charsPerPage)
  );
}

worker.on('completed', (job, result) => console.log(`Job ${job.id} completed:`, result));
worker.on('failed', (job, err) => console.error(`Job ${job?.id} failed:`, err.message));
console.log('DocMind worker started, waiting for jobs...');
