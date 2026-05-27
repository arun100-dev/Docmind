'use client';
import { useCallback, useState } from 'react';
import { Upload, FileText, X, Loader2 } from 'lucide-react';
import { uploadPDF } from '@/lib/api';
import { useStore } from '@/store';

export default function UploadZone({ onClose }: { onClose: () => void }) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const addDocument = useStore((s) => s.addDocument);
  const setActiveDocId = useStore((s) => s.setActiveDocId);

  const handleFile = useCallback((f: File) => {
    if (f.type !== 'application/pdf') {
      setError('Only PDF files are supported');
      return;
    }
    if (f.size > 50 * 1024 * 1024) {
      setError('File too large (max 50MB)');
      return;
    }
    setError('');
    setFile(f);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile]
  );

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const result = await uploadPDF(file);
      addDocument({
        docId: result.docId,
        docName: result.docName,
        totalPages: 0,
        uploadedAt: new Date().toISOString(),
        status: 'processing',
      });
      setActiveDocId(result.docId);
      onClose();
    } catch {
      setError('Upload failed. Is the server running?');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/80 backdrop-blur-sm">
      <div className="relative w-full max-w-lg animate-fade-up">
        <div className="bg-ink-800 border border-ghost-faint rounded-xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-ghost-faint">
            <span className="font-display text-sm font-bold tracking-widest uppercase text-acid">
              Upload PDF
            </span>
            <button
              onClick={onClose}
              className="text-ghost-dim hover:text-ghost transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          <div className="p-5">
            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => document.getElementById('file-input')?.click()}
              className={`relative border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-all duration-200 ${
                dragging
                  ? 'border-acid bg-acid/5'
                  : file
                  ? 'border-acid/40 bg-acid/3'
                  : 'border-ghost-faint hover:border-ghost-dim'
              }`}
            >
              <input
                id="file-input"
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
              {file ? (
                <div className="flex flex-col items-center gap-2">
                  <FileText size={32} className="text-acid" />
                  <p className="text-ghost font-medium text-sm">{file.name}</p>
                  <p className="text-ghost-dim text-xs">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  <button
                    onClick={(e) => { e.stopPropagation(); setFile(null); }}
                    className="text-ghost-dim hover:text-ghost text-xs mt-1 underline underline-offset-2"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-ink-700 flex items-center justify-center">
                    <Upload size={20} className="text-ghost-dim" />
                  </div>
                  <div>
                    <p className="text-ghost text-sm font-medium">
                      Drop a PDF here or{' '}
                      <span className="text-acid underline underline-offset-2">browse</span>
                    </p>
                    <p className="text-ghost-dim text-xs mt-1">Up to 50MB</p>
                  </div>
                </div>
              )}
            </div>

            {error && (
              <p className="text-red-400 text-xs mt-3 animate-fade-up">{error}</p>
            )}

            {/* Upload button */}
            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              className={`mt-4 w-full py-3 rounded-lg font-display font-bold text-sm tracking-wider transition-all duration-200 flex items-center justify-center gap-2 ${
                file && !uploading
                  ? 'bg-acid text-ink-950 hover:bg-acid-glow'
                  : 'bg-ink-700 text-ghost-dim cursor-not-allowed'
              }`}
            >
              {uploading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Uploading…
                </>
              ) : (
                'Upload & Process'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
