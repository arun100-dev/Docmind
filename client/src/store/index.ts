import { create } from 'zustand';

export interface Document {
  docId: string;
  docName: string;
  totalPages: number;
  uploadedAt: string;
  status?: 'processing' | 'ready';
}

export interface PageInfo {
  page: number;
  preview: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: number[];
  timestamp: number;
}

interface DocMindStore {
  // Documents
  documents: Document[];
  setDocuments: (docs: Document[]) => void;
  addDocument: (doc: Document) => void;
  removeDocument: (docId: string) => void;
  updateDocStatus: (docId: string, status: 'processing' | 'ready', extra?: Partial<Document>) => void;

  // Active document
  activeDocId: string | null;
  setActiveDocId: (id: string | null) => void;

  // Active page
  activePage: number | null;
  setActivePage: (page: number | null) => void;

  // Pages
  pages: Record<string, PageInfo[]>;
  setPages: (docId: string, pages: PageInfo[]) => void;

  // Chat
  chatHistory: Record<string, ChatMessage[]>;
  addMessage: (docId: string, msg: ChatMessage) => void;
  updateLastMessage: (docId: string, content: string, sources?: number[]) => void;

  // UI
  sidebarTab: 'pages' | 'docs';
  setSidebarTab: (tab: 'pages' | 'docs') => void;
  agentPanel: boolean;
  setAgentPanel: (open: boolean) => void;
}

export const useStore = create<DocMindStore>((set) => ({
  documents: [],
  setDocuments: (docs) => set({ documents: docs }),
  addDocument: (doc) => set((s) => ({ documents: [doc, ...s.documents] })),
  removeDocument: (docId) =>
    set((s) => ({ documents: s.documents.filter((d) => d.docId !== docId) })),
  updateDocStatus: (docId, status, extra = {}) =>
    set((s) => ({
      documents: s.documents.map((d) =>
        d.docId === docId ? { ...d, status, ...extra } : d
      ),
    })),

  activeDocId: null,
  setActiveDocId: (id) => set({ activeDocId: id, activePage: null }),

  activePage: null,
  setActivePage: (page) => set({ activePage: page }),

  pages: {},
  setPages: (docId, pages) => set((s) => ({ pages: { ...s.pages, [docId]: pages } })),

  chatHistory: {},
  addMessage: (docId, msg) =>
    set((s) => ({
      chatHistory: {
        ...s.chatHistory,
        [docId]: [...(s.chatHistory[docId] || []), msg],
      },
    })),
  updateLastMessage: (docId, content, sources) =>
    set((s) => {
      const msgs = s.chatHistory[docId] || [];
      if (!msgs.length) return s;
      const updated = [...msgs];
      const last = { ...updated[updated.length - 1], content };
      if (sources !== undefined) last.sources = sources;
      updated[updated.length - 1] = last;
      return { chatHistory: { ...s.chatHistory, [docId]: updated } };
    }),

  sidebarTab: 'docs',
  setSidebarTab: (tab) => set({ sidebarTab: tab }),
  agentPanel: false,
  setAgentPanel: (open) => set({ agentPanel: open }),
}));
