
# 🧠 DocMind — AI PDF Intelligence Platform

![Next.js](https://img.shields.io/badge/Next.js-000?style=flat-square&logo=nextdotjs&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-417E38?style=flat-square&logo=nodedotjs&logoColor=white)
![Qdrant](https://img.shields.io/badge/Vector_DB-1a1a2e?style=flat-square&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-c0392b?style=flat-square&logo=redis&logoColor=white)
![BullMQ](https://img.shields.io/badge/BullMQ-7b3fe4?style=flat-square&logoColor=white)
![Groq](https://img.shields.io/badge/Groq_LLaMA_3.1-ff6b35?style=flat-square&logoColor=white)
![RAG](https://img.shields.io/badge/RAG-0ea5e9?style=flat-square&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white)

[![Live Demo](https://img.shields.io/badge/🚀_Live_Demo-docmind.vercel.app-5b4ef5?style=flat-square)](https://docmind.vercel.app)

# DocMind

**Stop reading PDFs. Start talking to them.**

DocMind is a self-hostable AI document intelligence platform. Upload a PDF, ask it anything — get streaming answers with exact page citations, or run any of 5 specialized AI agent tools (summarize, outline, cite, key terms, Q&A) on the whole document or a single page. Everything runs on free tiers. Total cost to deploy: $0.

---

## Why I built this

Most "chat with PDF" tools are glorified CTRL+F. They return blobs of retrieved text with no structure, no citations, and no way to scope your question to a specific page. DocMind is built differently:

- You can click any page in the sidebar and ask questions specifically about that page
- Every answer cites the page it pulled from — as a clickable reference, not just a footnote
- The agent tools use a 70B model and produce genuinely useful output (a real outline, real study questions, real citations) instead of vague summaries

---

## What's inside

```
docmind/
├── server/          # Express API + BullMQ worker
│   └── src/
│       ├── index.js       # API routes: upload, chat, agent, docs
│       ├── worker.js      # PDF parsing + chunking + vectorization
│       └── redisClient.js # Redis/Valkey connection
├── client/          # Next.js 14 frontend
│   └── src/
│       ├── app/           # App router, global styles
│       ├── components/    # ChatPanel, AgentPanel, Sidebar, UploadZone, Navbar
│       ├── store/         # Zustand global state
│       └── lib/           # API client
├── docker-compose.yml     # Spins up Qdrant + Valkey locally
└── render.yaml            # One-click Render deployment blueprint
```

---

## Architecture

```
┌─────────────────┐     ┌──────────────────────────────────┐
│   Next.js 14    │────▶│        Express API Server        │
│  (Vercel/Render)│◀────│  /upload  /chat  /agent  /docs   │
└─────────────────┘ SSE └─────────────┬────────────────────┘
                                       │
                          ┌────────────▼────────────┐
                          │    BullMQ Job Queue     │
                          │    (Valkey/Redis)       │
                          └────────────┬────────────┘
                                       │
                          ┌────────────▼────────────┐
                          │      PDF Worker         │
                          │  pdf-parse → chunks     │
                          │  → TF-IDF vectors       │
                          └────────────┬────────────┘
                                       │
                          ┌────────────▼────────────┐
                          │       Qdrant DB         │
                          │  Vector + Payload store │
                          └─────────────────────────┘
                                       │
                          ┌────────────▼────────────┐
                          │      Groq (LLaMA)       │
                          │  Fast inference, free   │
                          └─────────────────────────┘
```

**How a question flows through the system:**

1. User uploads PDF → Express queues the job in BullMQ (Valkey/Redis)
2. Worker picks up the job, parses the PDF with `pdf-parse`, splits text page by page, chunks it (800 chars, 150 overlap), and builds TF-IDF style vectors for each chunk — no external embedding API needed
3. Vectors + payloads upsert to Qdrant in batches of 100
4. On chat: BM25 re-ranking scores all chunks against the user's keywords, top 8 go into the LLaMA 3.1 8B prompt, response streams back over SSE
5. On agent tools: full document text (up to 10k chars, or one page if scoped) goes to LLaMA 3.3 70B with a structured prompt per tool

**No embedding API.** The vector layer uses a hashed n-gram approach — words and bigrams are projected into 1536 dimensions and L2 normalized. Combined with BM25 re-ranking at query time, retrieval quality is solid without burning API credits on embeddings.

---

## Features

### Chat
- Streaming responses over SSE — tokens appear as fast as the model produces them
- BM25 keyword re-ranking on top of vector search picks the 8 most relevant chunks
- Conversation history (last 6 turns) passed with every request for coherent multi-turn dialogue
- Page citations in every answer — clickable links that jump you to that page
- Page-scoped chat: select a page in the sidebar, ask a question, only that page's content is searched

### Agent tools
All tools support full-document or single-page scope. They run on LLaMA 3.3 70B — a different, larger model than chat.

| Tool | What it does |
|---|---|
| **Summarize** | Structured summary with overview, key points, and takeaways |
| **Outline** | Hierarchical section/chapter outline with page ranges |
| **Find Citations** | Extracts verbatim quotes on any topic you specify |
| **Key Terms** | 15 most important concepts, defined in document context |
| **Q&A Generator** | 10 study questions with detailed answers, page-referenced |

### Document library
- Upload unlimited PDFs (up to 50MB each)
- Library sidebar shows all documents with page counts and upload timestamps
- Per-document page navigator with 280-character text previews for each page
- Delete documents (removes all vector chunks from Qdrant)

---

## Getting started locally

**Prerequisites:** Node.js 18+, Docker

```bash
# 1. Clone
git clone https://github.com/yourusername/docmind
cd docmind

# 2. Start Qdrant and Valkey (Redis) via Docker
docker-compose up -d

# 3. Set up the server
cd server
cp .env.example .env
# Open .env and add your GROQ_API_KEY (free at console.groq.com)
npm install
npm run start        # API starts on :8000

# In a second terminal — this is the PDF processing worker
cd server
npm run worker

# 4. Set up the client
cd ../client
cp .env.example .env
npm install
npm run dev          # Frontend on :3000
```

Open [http://localhost:3000](http://localhost:3000) and upload a PDF.

---

## Environment variables

### Server (`server/.env`)

| Variable | Description |
|---|---|
| `GROQ_API_KEY` | Your Groq key — free at [console.groq.com](https://console.groq.com) |
| `REDIS_URL` | Redis/Valkey URL (default: `redis://localhost:6379`) |
| `QDRANT_URL` | Qdrant URL (default: `http://localhost:6333`) |
| `CLIENT_URL` | Frontend origin for CORS (default: `http://localhost:3000`) |
| `PORT` | Server port (default: `8000`) |

### Client (`client/.env`)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend URL (default: `http://localhost:8000`) |

---

## Deploying to Render (free)

DocMind deploys entirely on free tiers. Here's the full setup.

### Step 1 — Qdrant Cloud (vector DB)

1. Create a free cluster at [cloud.qdrant.io](https://cloud.qdrant.io)
2. Copy your cluster URL — looks like `https://xxxxxxxx.us-east4-0.gcp.cloud.qdrant.io`

### Step 2 — Push to GitHub

Make sure your repo is on GitHub (or GitLab). Render reads the `render.yaml` blueprint directly from the repo.

### Step 3 — Deploy on Render

1. Go to [render.com](https://render.com) → New → Blueprint
2. Connect your repo
3. Render picks up `render.yaml` automatically and creates the services (API server, worker, Redis)
4. Add the required environment variables in the Render dashboard:
   - `GROQ_API_KEY`
   - `QDRANT_URL` (your Qdrant Cloud URL from Step 1)
   - `CLIENT_URL` (your frontend URL — you'll get this after the next step)

### Step 4 — Frontend as a Render static site

```
Build Command:   cd client && npm install && npm run build
Publish Dir:     client/.next
Environment var: NEXT_PUBLIC_API_URL=https://your-server.onrender.com
```

Once the frontend deploys, copy its URL back into `CLIENT_URL` on the server service.

**Total cost: $0** — Render free tier (server + worker + Redis) + Qdrant Cloud free tier + Groq free tier.

> Note: Render free services spin down after 15 minutes of inactivity. The first request after a cold start takes ~30 seconds. Upgrade to a paid Render plan if you need always-on.

---

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 14, TypeScript, Tailwind CSS, Framer Motion, Zustand |
| Backend | Node.js, Express, BullMQ |
| AI | Groq — LLaMA 3.1 8B (chat), LLaMA 3.3 70B (agent tools) |
| Vector DB | Qdrant |
| Queue / Cache | Valkey (Redis-compatible) |
| PDF parsing | pdf-parse |
| Deployment | Render, Qdrant Cloud |

---

## Limitations and known quirks

- **No external embedding model.** The TF-IDF vector approach works well for most documents but won't match the semantic depth of proper embedding models (OpenAI, Cohere, etc). If you need higher retrieval quality, swap `textToVector()` in `worker.js` for an embedding API call.
- **10k character context limit on agent tools.** Long documents get truncated. This is a Groq context/cost tradeoff — adjust the `.substring(0, 10000)` in `index.js` if needed.
- **Render cold starts.** Free tier services go to sleep. Not a problem for demos, annoying for production.
- **No auth.** Documents are accessible to anyone with the URL. Add an auth layer before putting this in front of real users.
- **PDF parsing quality depends on the PDF.** Scanned PDFs and image-heavy documents won't extract text well — `pdf-parse` only works on text-layer PDFs.

---

