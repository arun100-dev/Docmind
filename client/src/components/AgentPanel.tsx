'use client';
import { useState } from 'react';
import {
  X, Sparkles, FileText, Quote, List, BookOpen, HelpCircle,
  ChevronDown, Loader2
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useStore } from '@/store';
import { streamAgent } from '@/lib/api';

const TOOLS = [
  {
    id: 'summarize',
    label: 'Summarize',
    icon: FileText,
    desc: 'Get a structured summary with key points',
    color: 'text-blue-400',
    accent: 'border-blue-400/30 bg-blue-400/5',
  },
  {
    id: 'outline',
    label: 'Outline',
    icon: List,
    desc: 'Chapter-by-chapter document outline',
    color: 'text-purple-400',
    accent: 'border-purple-400/30 bg-purple-400/5',
  },
  {
    id: 'cite',
    label: 'Find Citations',
    icon: Quote,
    desc: 'Extract quotes & evidence on any topic',
    color: 'text-acid',
    accent: 'border-acid/30 bg-acid/5',
    hasInput: true,
    inputPlaceholder: 'Topic to find citations for…',
  },
  {
    id: 'keyterms',
    label: 'Key Terms',
    icon: BookOpen,
    desc: 'Extract and define important concepts',
    color: 'text-orange-400',
    accent: 'border-orange-400/30 bg-orange-400/5',
  },
  {
    id: 'qa',
    label: 'Q&A Generator',
    icon: HelpCircle,
    desc: 'Generate study questions with answers',
    color: 'text-pink-400',
    accent: 'border-pink-400/30 bg-pink-400/5',
  },
];

export default function AgentPanel() {
  const { activeDocId, documents, activePage, setAgentPanel } = useStore();
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [topicInput, setTopicInput] = useState('');
  const [result, setResult] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [selectedTool, setSelectedTool] = useState<string | null>(null);

  const activeDoc = documents.find((d) => d.docId === activeDocId);

  const runTool = (toolId: string) => {
    if (!activeDocId || streaming) return;
    const tool = TOOLS.find((t) => t.id === toolId);
    if (!tool) return;

    setSelectedTool(toolId);
    setResult('');
    setStreaming(true);
    setActiveTool(toolId);

    const params: Record<string, string> = {};
    if (toolId === 'cite' && topicInput) params.topic = topicInput;
    if (activePage) params.page = String(activePage);

    streamAgent(
      { tool: toolId, docId: activeDocId, params },
      (delta) => setResult((prev) => prev + delta),
      () => setStreaming(false),
      () => { setStreaming(false); setResult((prev) => prev + '\n\n_Error occurred._'); }
    );
  };

  return (
    <div className="w-80 flex-shrink-0 bg-ink-900 border-l border-ghost-faint flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-ghost-faint">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-acid" />
          <span className="font-display font-bold text-xs tracking-widest uppercase text-acid">
            AI Agent
          </span>
        </div>
        <button
          onClick={() => setAgentPanel(false)}
          className="text-ghost-dim hover:text-ghost transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* Doc info */}
      {activeDoc && (
        <div className="px-4 py-2.5 border-b border-ghost-faint bg-ink-800/50">
          <p className="text-ghost text-xs font-medium truncate">{activeDoc.docName}</p>
          {activePage && (
            <p className="text-acid text-xs font-mono mt-0.5">Scoped to Page {activePage}</p>
          )}
        </div>
      )}

      {!activeDocId ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-ghost-dim text-sm text-center px-6">
            Select a document to use AI Agent tools
          </p>
        </div>
      ) : (
        <>
          {/* Tool buttons */}
          <div className="p-3 border-b border-ghost-faint space-y-1.5">
            {TOOLS.map((tool) => {
              const Icon = tool.icon;
              const isActive = selectedTool === tool.id;
              return (
                <div key={tool.id}>
                  <button
                    onClick={() => {
                      if (tool.id !== 'cite') runTool(tool.id);
                      else setActiveTool(activeTool === tool.id ? null : tool.id);
                    }}
                    disabled={streaming}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all text-left ${
                      isActive
                        ? tool.accent
                        : 'border-transparent hover:bg-ink-800 hover:border-ghost-faint/50'
                    } ${streaming ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <Icon size={14} className={tool.color} />
                    <div className="flex-1 min-w-0">
                      <p className="text-ghost text-xs font-medium">{tool.label}</p>
                      <p className="text-ghost-dim text-xs truncate">{tool.desc}</p>
                    </div>
                    {isActive && streaming ? (
                      <Loader2 size={12} className={`animate-spin ${tool.color}`} />
                    ) : tool.hasInput ? (
                      <ChevronDown
                        size={12}
                        className={`text-ghost-dim transition-transform ${
                          activeTool === tool.id ? 'rotate-180' : ''
                        }`}
                      />
                    ) : null}
                  </button>

                  {/* Citation input */}
                  {tool.hasInput && activeTool === tool.id && (
                    <div className="mt-1 pl-8 animate-fade-up">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={topicInput}
                          onChange={(e) => setTopicInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && runTool(tool.id)}
                          placeholder={tool.inputPlaceholder}
                          className="flex-1 bg-ink-800 border border-ghost-faint rounded-lg px-3 py-1.5 text-xs text-ghost placeholder-ghost-dim outline-none focus:border-acid/50"
                        />
                        <button
                          onClick={() => runTool(tool.id)}
                          disabled={streaming}
                          className="px-2.5 py-1.5 bg-acid text-ink-950 rounded-lg text-xs font-bold hover:bg-acid-glow transition-colors"
                        >
                          Run
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Result */}
          <div className="flex-1 overflow-y-auto p-3">
            {!result && !streaming ? (
              <p className="text-ghost-faint text-xs text-center py-6">
                Pick a tool above to analyze your document
              </p>
            ) : (
              <div>
                {selectedTool && (
                  <div className="flex items-center gap-1.5 mb-3">
                    {(() => {
                      const t = TOOLS.find((x) => x.id === selectedTool);
                      const Icon = t?.icon || Sparkles;
                      return (
                        <>
                          <Icon size={11} className={t?.color} />
                          <span className={`text-xs font-display font-bold ${t?.color}`}>
                            {t?.label} Result
                          </span>
                          {streaming && (
                            <Loader2 size={10} className="animate-spin text-ghost-dim ml-auto" />
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}
                <div className="prose-docmind text-xs leading-relaxed">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{result}</ReactMarkdown>
                </div>
                {streaming && (
                  <div className="flex gap-1 mt-2">
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
