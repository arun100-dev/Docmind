'use client';
import { useState } from 'react';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import ChatPanel from '@/components/ChatPanel';
import AgentPanel from '@/components/AgentPanel';
import UploadZone from '@/components/UploadZone';
import { useStore } from '@/store';

export default function Home() {
  const [showUpload, setShowUpload] = useState(false);
  const { agentPanel } = useStore();

  return (
    <div className="h-screen flex flex-col bg-ink-950 grid-bg overflow-hidden">
      <Navbar onUpload={() => setShowUpload(true)} />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <ChatPanel />
        {agentPanel && <AgentPanel />}
      </div>

      {showUpload && <UploadZone onClose={() => setShowUpload(false)} />}
    </div>
  );
}
