'use client';
import { useState, useRef, useEffect } from 'react';
import { Send, BookOpen, X, Zap } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useStore, ChatMessage } from '@/store';
import { streamChat } from '@/lib/api';

const uuidv4 = () => crypto.randomUUID();

export default function ChatPanel() {
  const {
    activeDocId, documents,
    activePage, setActivePage,
    chatHistory, addMessage,
  } = useStore();

  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const activeDoc = documents.find((d) => d.docId === activeDocId);
  const messages: ChatMessage[] = activeDocId ? chatHistory[activeDocId] || [] : [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !activeDocId || streaming) return;
    const question = input.trim();
    setInput('');

    const userMsg: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      content: question,
      timestamp: Date.now(),
    };
    addMessage(activeDocId, userMsg);

    const aiMsg: ChatMessage = {
      id: uuidv4(),
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    };
    addMessage(activeDocId, aiMsg);
    setStreaming(true);

    const docId = activeDocId;

    streamChat(
      {
        question,
        docId,
        pageFilter: activePage,
        history: messages.slice(-8),
      },
      (delta) => {
        useStore.setState((s) => {
          const msgs = s.chatHistory[docId] || [];
          if (!msgs.length) return s;
          const updated = [...msgs];
          const last = updated[updated.length - 1];
          updated[updated.length - 1] = { ...last, content: last.content + delta };
          return { chatHistory: { ...s.chatHistory, [docId]: updated } };
        });
      },
      (pages) => {
        useStore.setState((s) => {
          const msgs = s.chatHistory[docId] || [];
          if (!msgs.length) return s;
          const updated = [...msgs];
          const last = updated[updated.length - 1];
          updated[updated.length - 1] = { ...last, sources: pages };
          return { chatHistory: { ...s.chatHistory, [docId]: updated } };
        });
      },
      () => setStreaming(false),
      () => setStreaming(false)
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const suggestedQuestions = [
    'Summarize the main topics',
    'What are the key findings?',
    'List the most important concepts',
    'What conclusions are drawn?',
  ];

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Chat header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-ghost-faint flex-shrink-0">
        <div>
          <h2 className="font-display font-bold text-sm text-ghost">
            {activeDoc ? activeDoc.docName : 'Select a document'}
          </h2>
          {activePage && (
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-xs text-acid font-mono">Filtering: Page {activePage}</span>
              <button onClick={() => setActivePage(null)} className="text-ghost-dim hover:text-ghost">
                <X size={10} />
              </button>
            </div>
          )}
        </div>
        {activeDoc && (
          <div className="flex items-center gap-1 text-xs text-ghost-dim font-mono">
            <BookOpen size={11} />
            {activeDoc.totalPages} pages
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {!activeDocId ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-ink-800 border border-ghost-faint flex items-center justify-center">
              <Zap size={24} className="text-acid" />
            </div>
            <div>
              <h3 className="font-display font-bold text-ghost text-lg">DocMind</h3>
              <p className="text-ghost-dim text-sm mt-1">Upload a PDF and start asking questions</p>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-6">
            <div>
              <h3 className="font-display font-bold text-ghost text-center">{activeDoc?.docName}</h3>
              <p className="text-ghost-dim text-sm text-center mt-1">Ask anything about this document</p>
            </div>
            <div className="grid grid-cols-2 gap-2 w-full max-w-md">
              {suggestedQuestions.map((q) => (
                <button
                  key={q}
                  onClick={() => { setInput(q); inputRef.current?.focus(); }}
                  className="text-left p-3 rounded-lg bg-ink-800 border border-ghost-faint hover:border-acid/40 hover:bg-ink-700 transition-all text-xs text-ghost-dim hover:text-ghost"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <div
                key={msg.id}
                className={`animate-fade-up flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                style={{ animationDelay: `${i * 0.02}s` }}
              >
                {msg.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-full bg-acid/10 border border-acid/30 flex items-center justify-center flex-shrink-0 mt-1">
                    <Zap size={10} className="text-acid" />
                  </div>
                )}
                <div
                  className={`max-w-[82%] rounded-xl px-4 py-3 ${
                    msg.role === 'user'
                      ? 'bg-ink-700 border border-ghost-faint/50 text-ghost text-sm'
                      : 'bg-ink-800/60 border border-ghost-faint/30'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    <>
                      {msg.content === '' && streaming ? (
                        <div className="flex gap-1 py-1">
                          <span className="typing-dot" />
                          <span className="typing-dot" />
                          <span className="typing-dot" />
                        </div>
                      ) : (
                        <div className="prose-docmind text-sm">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                        </div>
                      )}
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-ghost-faint/30 flex-wrap">
                          <span className="text-ghost-dim text-xs">Sources:</span>
                          {msg.sources.map((p) => (
                            <button
                              key={p}
                              onClick={() => setActivePage(p)}
                              className="text-xs font-mono px-1.5 py-0.5 rounded bg-acid/10 text-acid hover:bg-acid/20 transition-colors"
                            >
                              p.{p}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm leading-relaxed">{msg.content}</p>
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div className="flex-shrink-0 p-4 border-t border-ghost-faint">
        {activePage && (
          <div className="mb-2 flex items-center gap-2 text-xs">
            <div className="flex-1 px-2 py-1 rounded bg-acid/5 border border-acid/20 text-acid font-mono">
              Scoped to Page {activePage}
            </div>
            <button onClick={() => setActivePage(null)} className="text-ghost-dim hover:text-ghost">
              <X size={12} />
            </button>
          </div>
        )}
        <div className={`flex gap-2 rounded-xl border transition-all ${
          activeDocId
            ? 'border-ghost-faint bg-ink-800 focus-within:border-acid/50 focus-within:bg-ink-700'
            : 'border-ghost-faint/30 bg-ink-900 opacity-50'
        }`}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!activeDocId || streaming}
            placeholder={
              !activeDocId
                ? 'Select a document to start chatting…'
                : activePage
                ? `Ask about page ${activePage}…`
                : 'Ask anything about this PDF…'
            }
            rows={1}
            className="flex-1 bg-transparent px-4 py-3 text-sm text-ghost placeholder-ghost-dim resize-none outline-none leading-relaxed max-h-32"
            style={{ minHeight: '46px' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || !activeDocId || streaming}
            className={`m-1.5 w-9 h-9 rounded-lg flex items-center justify-center transition-all flex-shrink-0 ${
              input.trim() && activeDocId && !streaming
                ? 'bg-acid text-ink-950 hover:bg-acid-glow'
                : 'bg-ink-700 text-ghost-dim cursor-not-allowed'
            }`}
          >
            <Send size={14} />
          </button>
        </div>
        <p className="text-ghost-faint text-xs mt-1.5 text-center">
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
