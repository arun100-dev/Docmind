const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function uploadPDF(file: File) {
  const form = new FormData();
  form.append('pdf', file);
  const res = await fetch(`${API}/upload/pdf`, { method: 'POST', body: form });
  if (!res.ok) throw new Error('Upload failed');
  return res.json();
}

export async function getDocuments() {
  const res = await fetch(`${API}/documents`);
  return res.json();
}

export async function getDocStatus(docId: string) {
  const res = await fetch(`${API}/documents/${docId}/status`);
  return res.json();
}

export async function getPages(docId: string) {
  const res = await fetch(`${API}/documents/${docId}/pages`);
  return res.json();
}

export async function deleteDocument(docId: string) {
  await fetch(`${API}/documents/${docId}`, { method: 'DELETE' });
}

export function streamChat(
  payload: { question: string; docId: string; pageFilter?: number | null; history: any[] },
  onDelta: (text: string) => void,
  onSources: (pages: number[]) => void,
  onDone: () => void,
  onError: (e: Error) => void
) {
  fetch(`${API}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
    .then(async (res) => {
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const json = JSON.parse(line.slice(6));
            if (json.type === 'delta') onDelta(json.content);
            else if (json.type === 'sources') onSources(json.pages);
            else if (json.type === 'done') onDone();
          } catch {}
        }
      }
    })
    .catch(onError);
}

export function streamAgent(
  payload: { tool: string; docId: string; params?: Record<string, string> },
  onDelta: (text: string) => void,
  onDone: () => void,
  onError: (e: Error) => void
) {
  fetch(`${API}/agent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
    .then(async (res) => {
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const json = JSON.parse(line.slice(6));
            if (json.type === 'delta') onDelta(json.content);
            else if (json.type === 'done') onDone();
          } catch {}
        }
      }
    })
    .catch(onError);
}
