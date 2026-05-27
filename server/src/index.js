import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import { Queue } from 'bullmq';
import { QdrantClient } from '@qdrant/js-client-rest';
import Groq from 'groq-sdk';
import { createClient } from './redisClient.js';

dotenv.config();

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

app.use(cors({ origin: process.env.CLIENT_URL || '*' }));
app.use(express.json());

const redisConnection = createClient();
const pdfQueue = new Queue('pdf-processing', { connection: redisConnection });

const qdrant = new QdrantClient({
  url: (process.env.QDRANT_URL || 'http://localhost:6333').trim(),
  ...(process.env.QDRANT_API_KEY ? { apiKey: process.env.QDRANT_API_KEY.trim() } : {}),
  checkCompatibility: false,
});

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const COLLECTION = 'docmind_chunks';

// ✅ FIX: Create collection + payload indexes for Qdrant Cloud
async function ensureCollection() {
  try {
    await qdrant.getCollection(COLLECTION);
    console.log('✅ Qdrant collection ready');
  } catch (e) {
    try {
      await qdrant.createCollection(COLLECTION, {
        vectors: { size: 1536, distance: 'Cosine' },
      });
      console.log('✅ Qdrant collection created');
    } catch (createErr) {
      console.error('❌ Failed to create collection:', createErr?.data || createErr?.message);
    }
  }

  // Create payload indexes — required by Qdrant Cloud for filtering
  try {
    await qdrant.createPayloadIndex(COLLECTION, {
      field_name: 'docId',
      field_schema: 'keyword',
    });
    await qdrant.createPayloadIndex(COLLECTION, {
      field_name: 'page',
      field_schema: 'integer',
    });
    console.log('✅ Qdrant payload indexes ready');
  } catch (e) {
    console.log('ℹ️ Indexes already exist');
  }
}
ensureCollection();

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Upload PDF
app.post('/upload/pdf', upload.single('pdf'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No PDF file provided' });
  const docId = uuidv4();
  const docName = req.file.originalname.replace('.pdf', '');
  await pdfQueue.add('process-pdf', {
    docId,
    docName,
    buffer: req.file.buffer.toString('base64'),
  });
  res.json({ docId, docName, status: 'processing' });
});

// Get all documents
app.get('/documents', async (req, res) => {
  try {
    const result = await qdrant.scroll(COLLECTION, {
      limit: 1000,
      with_payload: true,
      with_vector: false,
    });
    const docs = {};
    for (const point of result.points) {
      const p = point.payload;
      if (!docs[p.docId]) {
        docs[p.docId] = {
          docId: p.docId,
          docName: p.docName,
          totalPages: p.totalPages,
          uploadedAt: p.uploadedAt,
        };
      }
    }
    res.json(Object.values(docs));
  } catch {
    res.json([]);
  }
});

// Get doc status
app.get('/documents/:docId/status', async (req, res) => {
  const jobs = await pdfQueue.getJobs(['waiting', 'active', 'delayed']);
  const inQueue = jobs.find((j) => j.data.docId === req.params.docId);
  if (inQueue) return res.json({ status: 'processing' });
  try {
    const result = await qdrant.scroll(COLLECTION, {
      filter: { must: [{ key: 'docId', match: { value: req.params.docId } }] },
      limit: 1,
      with_payload: true,
      with_vector: false,
    });
    if (result.points.length > 0)
      return res.json({ status: 'ready', ...result.points[0].payload });
    res.json({ status: 'not_found' });
  } catch {
    res.json({ status: 'not_found' });
  }
});

// Get pages for a doc
app.get('/documents/:docId/pages', async (req, res) => {
  try {
    const result = await qdrant.scroll(COLLECTION, {
      filter: { must: [{ key: 'docId', match: { value: req.params.docId } }] },
      limit: 2000,
      with_payload: true,
      with_vector: false,
    });
    const seen = new Set();
    const pages = [];
    for (const p of result.points) {
      const key = `${p.payload.page}`;
      if (!seen.has(key)) {
        seen.add(key);
        pages.push({ page: p.payload.page, preview: p.payload.text.substring(0, 280) + '…' });
      }
    }
    pages.sort((a, b) => a.page - b.page);
    res.json(pages);
  } catch (e) {
    console.error('Pages error:', e?.data || e?.message);
    res.json([]);
  }
});

// Chat with PDF (streaming RAG)
app.post('/chat', async (req, res) => {
  const { question, docId, pageFilter, history = [] } = req.body;
  if (!question || !docId) return res.status(400).json({ error: 'question and docId required' });

  const filter = { must: [{ key: 'docId', match: { value: docId } }] };
  if (pageFilter) filter.must.push({ key: 'page', match: { value: parseInt(pageFilter) } });

  const allChunks = await qdrant.scroll(COLLECTION, {
    filter, limit: 500, with_payload: true, with_vector: false,
  });

  const keywords = question.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
  const ranked = allChunks.points
    .map((p) => {
      const text = p.payload.text.toLowerCase();
      const score = keywords.reduce((s, kw) => s + (text.split(kw).length - 1), 0);
      return { ...p.payload, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  const context = ranked.map((c) => `[Page ${c.page}]:\n${c.text}`).join('\n\n---\n\n');
  const systemPrompt = `You are DocMind, an expert AI document analyst. Answer questions about the uploaded PDF.

DOCUMENT CONTEXT:
${context}

RULES:
- Cite page numbers like [Page X] whenever referencing content
- Be structured: use bullet points or numbered lists when helpful
- If the answer isn't in the context, say "This information isn't found in the provided document"
- Keep answers concise yet thorough`;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sources = [...new Set(ranked.filter(c => c.score > 0).map((c) => c.page))].sort((a, b) => a - b);
  res.write(`data: ${JSON.stringify({ type: 'sources', pages: sources })}\n\n`);

  const stream = await groq.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    messages: [
      { role: 'system', content: systemPrompt },
      ...history.slice(-6).map((h) => ({ role: h.role, content: h.content })),
      { role: 'user', content: question },
    ],
    stream: true,
    max_tokens: 1024,
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content || '';
    if (delta) res.write(`data: ${JSON.stringify({ type: 'delta', content: delta })}\n\n`);
  }
  res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
  res.end();
});

// AI Agent tools
app.post('/agent', async (req, res) => {
  const { tool, docId, params = {} } = req.body;
  const allChunks = await qdrant.scroll(COLLECTION, {
    filter: { must: [{ key: 'docId', match: { value: docId } }] },
    limit: 1000, with_payload: true, with_vector: false,
  });

  const sorted = allChunks.points.sort((a, b) => a.payload.page - b.payload.page);
  let targetChunks = params.page
    ? sorted.filter((p) => p.payload.page === parseInt(params.page))
    : sorted;

  const text = targetChunks
    .map((p) => `[Page ${p.payload.page}]: ${p.payload.text}`)
    .join('\n\n')
    .substring(0, 10000);

  const prompts = {
    summarize: `Create a comprehensive summary with Overview, Key Points, Important Details, Conclusion.\n\nContent:\n${text}`,
    cite: `Find ALL relevant quotes about "${params.topic || 'main topics'}".\nFormat: > "quote" — [Page X]\n\nDocument:\n${text}`,
    outline: `Create a detailed hierarchical outline with page references.\n\nDocument:\n${text}`,
    keyterms: `Extract and explain 15 most important terms.\nFormat: **Term** — Definition\n\nDocument:\n${text}`,
    qa: `Generate 10 study questions with answers.\nFormat:\n**Q1:** Question\n**A:** Answer\n\nDocument:\n${text}`,
  };

  if (!prompts[tool]) return res.status(400).json({ error: 'Unknown tool' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const stream = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: 'You are DocMind AI Agent — a world-class document analyst.' },
      { role: 'user', content: prompts[tool] },
    ],
    stream: true,
    max_tokens: 2048,
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content || '';
    if (delta) res.write(`data: ${JSON.stringify({ type: 'delta', content: delta })}\n\n`);
  }
  res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
  res.end();
});

// Delete document
app.delete('/documents/:docId', async (req, res) => {
  try {
    await qdrant.delete(COLLECTION, {
      filter: { must: [{ key: 'docId', match: { value: req.params.docId } }] },
    });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete' });
  }
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`DocMind server running on port ${PORT}`));

// Worker runs in same process (Render free tier)
import('./worker.js').catch((e) => console.error('Worker failed to start:', e.message));
