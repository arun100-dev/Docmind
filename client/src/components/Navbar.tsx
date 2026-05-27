'use client';
import { Upload, Sparkles, Zap } from 'lucide-react';
import { useStore } from '@/store';

interface NavbarProps {
  onUpload: () => void;
}

export default function Navbar({ onUpload }: NavbarProps) {
  const { agentPanel, setAgentPanel, activeDocId } = useStore();

  return (
    <header className="h-12 flex-shrink-0 bg-ink-900 border-b border-ghost-faint flex items-center justify-between px-5 z-10">
      {/* Logo */}
      <div className="flex items-center gap-2.5">
        <div className="w-6 h-6 rounded bg-acid flex items-center justify-center">
          <Zap size={12} className="text-ink-950" />
        </div>
        <span className="font-display font-bold text-ghost tracking-tight">
          Doc<span className="text-acid">Mind</span>
        </span>
        <span className="hidden sm:block text-ghost-faint text-xs font-mono ml-1">
          / AI PDF Intelligence
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setAgentPanel(!agentPanel)}
          disabled={!activeDocId}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-bold tracking-wide transition-all ${
            !activeDocId
              ? 'text-ghost-dim opacity-40 cursor-not-allowed'
              : agentPanel
              ? 'bg-acid/10 text-acid border border-acid/30'
              : 'text-ghost-dim hover:text-ghost hover:bg-ink-800 border border-transparent'
          }`}
        >
          <Sparkles size={12} />
          AI Agent
        </button>
        <button
          onClick={onUpload}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-acid text-ink-950 text-xs font-display font-bold tracking-wide hover:bg-acid-glow transition-colors"
        >
          <Upload size={12} />
          Upload
        </button>
      </div>
    </header>
  );
}
