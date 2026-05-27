'use client';
import { useEffect, useState } from 'react';
import {
  FileText, Trash2, Loader2, ChevronRight,
  BookOpen, Files, RefreshCw, Clock
} from 'lucide-react';
import { useStore } from '@/store';
import { getDocuments, getPages, getDocStatus, deleteDocument } from '@/lib/api';

export default function Sidebar() {
  const {
    documents, setDocuments, removeDocument, updateDocStatus,
    activeDocId, setActiveDocId,
    activePage, setActivePage,
    pages, setPages,
    sidebarTab, setSidebarTab,
  } = useStore();

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDocuments()
      .then((docs) => setDocuments(docs.map((d: any) => ({ ...d, status: 'ready' }))))
      .finally(() => setLoading(false));
  }, []);

  // Poll processing docs
  useEffect(() => {
    const processing = documents.filter((d) => d.status === 'processing');
    if (!processing.length) return;
    const interval = setInterval(async () => {
      for (const doc of processing) {
        const status = await getDocStatus(doc.docId);
        if (status.status === 'ready') {
          updateDocStatus(doc.docId, 'ready', {
            totalPages: status.totalPages,
          });
        }
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [documents]);

  // Load pages when active doc changes
  useEffect(() => {
    if (!activeDocId || pages[activeDocId]) return;
    getPages(activeDocId).then((p) => setPages(activeDocId, p));
  }, [activeDocId]);

  const handleDelete = async (docId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this document?')) return;
    await deleteDocument(docId);
    removeDocument(docId);
    if (activeDocId === docId) setActiveDocId(null);
  };

  const activeDoc = documents.find((d) => d.docId === activeDocId);
  const activePages = activeDocId ? pages[activeDocId] || [] : [];

  return (
    <aside className="w-64 flex-shrink-0 bg-ink-900 border-r border-ghost-faint flex flex-col h-full">
      {/* Tab header */}
      <div className="flex border-b border-ghost-faint">
        {(['docs', 'pages'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setSidebarTab(tab)}
            className={`flex-1 py-3 text-xs font-display font-bold tracking-widest uppercase transition-colors flex items-center justify-center gap-1.5 ${
              sidebarTab === tab
                ? 'text-acid border-b-2 border-acid -mb-px'
                : 'text-ghost-dim hover:text-ghost'
            }`}
          >
            {tab === 'docs' ? <Files size={12} /> : <BookOpen size={12} />}
            {tab}
          </button>
        ))}
      </div>

      {sidebarTab === 'docs' ? (
        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={16} className="animate-spin text-ghost-dim" />
            </div>
          ) : documents.length === 0 ? (
            <div className="py-10 text-center">
              <FileText size={24} className="mx-auto text-ghost-faint mb-2" />
              <p className="text-ghost-dim text-xs">No documents yet</p>
            </div>
          ) : (
            <ul className="space-y-1">
              {documents.map((doc) => (
                <li key={doc.docId}>
                  <button
                    onClick={() => {
                      setActiveDocId(doc.docId);
                      setSidebarTab('pages');
                    }}
                    className={`w-full text-left rounded-lg px-3 py-2.5 group flex items-start gap-2.5 transition-all ${
                      activeDocId === doc.docId
                        ? 'bg-ink-700 acid-border'
                        : 'hover:bg-ink-800'
                    }`}
                  >
                    <div className="mt-0.5 flex-shrink-0">
                      {doc.status === 'processing' ? (
                        <Loader2 size={14} className="animate-spin text-acid" />
                      ) : (
                        <FileText
                          size={14}
                          className={activeDocId === doc.docId ? 'text-acid' : 'text-ghost-dim'}
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-xs font-medium truncate ${
                          activeDocId === doc.docId ? 'text-ghost' : 'text-ghost-dim'
                        }`}
                      >
                        {doc.docName}
                      </p>
                      <p className="text-ghost-faint text-xs mt-0.5 flex items-center gap-1">
                        {doc.status === 'processing' ? (
                          <>
                            <RefreshCw size={9} className="animate-spin" /> Processing…
                          </>
                        ) : (
                          <>
                            <Clock size={9} />
                            {doc.totalPages ? `${doc.totalPages} pages` : 'Ready'}
                          </>
                        )}
                      </p>
                    </div>
                    <button
                      onClick={(e) => handleDelete(doc.docId, e)}
                      className="opacity-0 group-hover:opacity-100 text-ghost-dim hover:text-red-400 transition-all"
                    >
                      <Trash2 size={12} />
                    </button>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {!activeDoc ? (
            <div className="py-10 text-center px-4">
              <BookOpen size={24} className="mx-auto text-ghost-faint mb-2" />
              <p className="text-ghost-dim text-xs">Select a document first</p>
            </div>
          ) : (
            <>
              {/* Doc name */}
              <div className="px-3 py-2.5 border-b border-ghost-faint">
                <p className="text-ghost text-xs font-medium truncate">{activeDoc.docName}</p>
                <p className="text-ghost-dim text-xs">{activeDoc.totalPages} pages</p>
              </div>

              {/* Page filter toggle */}
              {activePage && (
                <div className="px-3 py-2 bg-acid/5 border-b border-acid/20 flex items-center justify-between">
                  <span className="text-acid text-xs font-mono">Page {activePage} filter ON</span>
                  <button
                    onClick={() => setActivePage(null)}
                    className="text-ghost-dim hover:text-ghost text-xs"
                  >
                    <ChevronRight size={12} />
                  </button>
                </div>
              )}

              {/* Page list */}
              {activePages.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={14} className="animate-spin text-ghost-dim" />
                </div>
              ) : (
                <ul>
                  {activePages.map((p) => (
                    <li key={p.page}>
                      <button
                        onClick={() => setActivePage(activePage === p.page ? null : p.page)}
                        className={`w-full text-left px-3 py-2.5 border-b border-ghost-faint/30 transition-all group hover:bg-ink-800 ${
                          activePage === p.page ? 'page-highlight' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`font-mono text-xs font-bold w-6 text-right ${
                              activePage === p.page ? 'text-acid' : 'text-ghost-dim'
                            }`}
                          >
                            {p.page}
                          </span>
                          <div
                            className={`flex-1 h-px ${
                              activePage === p.page ? 'bg-acid/30' : 'bg-ghost-faint'
                            }`}
                          />
                        </div>
                        <p className="text-ghost-dim text-xs leading-relaxed line-clamp-2 pl-8">
                          {p.preview}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </aside>
  );
}
