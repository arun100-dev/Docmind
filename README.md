# DocMind — AI PDF Intelligence

Chat with PDFs · Page navigation · 5 AI Agent tools · Multi-document support

---

## Run Locally

### Prerequisites
- Node.js 18+
- Docker Desktop (for Redis + Qdrant)

### Step 1 — Start infrastructure
```bash
docker-compose up -d
```
Starts Redis on :6379 and Qdrant on :6333

### Step 2 — Configure server
```bash
cd server
cp .env.example .env
```

Edit `.env`:
```
GROQ_API_KEY=gsk_your_key_here     # console.groq.com (free)
REDIS_URL=redis://localhost:6379
QDRANT_URL=http://localhost:6333   # local, no API key needed
QDRANT_API_KEY=                    # leave empty for local
CLIENT_URL=http://localhost:3000
PORT=8000
```

### Step 3 — Start server
```bash
npm install
npm run start
```
You should see:
```
DocMind server running on port 8000
DocMind worker started, waiting for jobs...
✅ Qdrant collection ready
```

### Step 4 — Start frontend
```bash
cd ../client
cp .env.example .env    # NEXT_PUBLIC_API_URL=http://localhost:8000
npm install
npm run dev
```

Open http://localhost:3000 ✅

---

## Deploy to Render + Vercel (Free)

### 1. Qdrant Cloud (free vector DB)
1. Go to cloud.qdrant.io → Sign up
2. Create Cluster → Free tier
3. Copy: Cluster URL (with :6333 port) + API Key

### 2. Push to GitHub
```bash
git init && git add . && git commit -m "init"
git remote add origin https://github.com/YOUR/docmind.git
git push -u origin main
```

### 3. Deploy backend on Render
1. render.com → New → Blueprint → connect your repo
2. Fill env vars:
   - GROQ_API_KEY → from console.groq.com
   - QDRANT_URL → https://your-cluster.qdrant.io:6333
   - QDRANT_API_KEY → from cloud.qdrant.io
   - CLIENT_URL → http://localhost:3000 (update after Vercel deploy)
3. Click Apply → wait ~5 min
4. Copy your server URL: https://docmind-server.onrender.com

### 4. Deploy frontend on Vercel
1. vercel.com → New Project → import GitHub repo
2. Root Directory: client
3. Add env var:
   - NEXT_PUBLIC_API_URL = https://docmind-server.onrender.com
4. Deploy → copy Vercel URL

### 5. Update Render CLIENT_URL
Render → docmind-server → Environment:
  CLIENT_URL = https://your-app.vercel.app
Save → auto redeploys ✅

---

## Common Errors

| Error | Fix |
|---|---|
| `ApiError: Forbidden` | Wrong or missing QDRANT_API_KEY, or space before value |
| `QDRANT_URL` 403 | Add `:6333` to the end of the URL |
| `service type not available` | Background workers are paid — fixed in render.yaml (worker runs inside server) |
| `ipAllowList required` | Fixed in render.yaml |
| Redis connection refused | Run `docker-compose up -d` first |
