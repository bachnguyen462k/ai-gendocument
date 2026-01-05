
import React, { useState, useMemo } from 'react';
import { Copy, Check, Download, FileText, Cloud, Eye, FileCode, Loader2, Printer } from 'lucide-react';
import { marked } from 'marked';

interface MarkdownPreviewProps {
  content: string;
  onSaveToDrive?: (content: string) => void;
  isSyncing?: boolean;
}

const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({ content, onSaveToDrive, isSyncing }) => {
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'doc' | 'code'>('doc');

  const htmlContent = useMemo(() => {
    return marked.parse(content);
  }, [content]);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = (type: 'md' | 'doc') => {
    if (type === 'doc') {
      const fullHtml = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' 
              xmlns:w='urn:schemas-microsoft-com:office:word' 
              xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
          <meta charset="utf-8">
          <title>API Documentation</title>
          <style>
            @page { size: 21cm 29.7cm; margin: 2cm; }
            body { font-family: 'Times New Roman', serif; line-height: 1.5; font-size: 12pt; }
            h1 { text-align: center; text-transform: uppercase; font-size: 18pt; margin-bottom: 20pt; }
            h2 { color: #2e5496; border-bottom: 1px solid #2e5496; margin-top: 20pt; font-size: 14pt; }
            h3 { font-size: 12pt; font-weight: bold; margin-top: 10pt; }
            table { border-collapse: collapse; width: 100%; margin: 10pt 0; }
            th, td { border: 1px solid black; padding: 8pt; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; }
            pre { background-color: #f4f4f4; padding: 10pt; border: 1px solid #ccc; font-family: 'Courier New', monospace; font-size: 10pt; margin: 10pt 0; }
            img { max-width: 100%; height: auto; display: block; margin: 20pt auto; border: 1px solid #ddd; }
          </style>
        </head>
        <body>
          ${htmlContent}
        </body>
        </html>
      `;
      const blob = new Blob(['\ufeff', fullHtml], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Tailieu_Kythuat_API.doc';
      a.click();
    } else {
      const blob = new Blob([content], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'api-doc.md';
      a.click();
    }
  };

  return (
    <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-200 overflow-hidden flex flex-col h-[calc(100vh-300px)]">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
        <div className="flex bg-slate-200/50 p-1 rounded-xl">
           <button onClick={() => setViewMode('doc')} className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${viewMode === 'doc' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>XEM TRƯỚC</button>
           <button onClick={() => setViewMode('code')} className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${viewMode === 'code' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>CODE MD</button>
        </div>
        <div className="flex gap-2">
           <button onClick={() => handleDownload('doc')} className="bg-blue-600 text-white px-5 py-2 rounded-xl text-xs font-black flex items-center gap-2 shadow-lg shadow-blue-200">
             <FileText size={16} /> XUẤT WORD
           </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-10 bg-slate-100">
        {viewMode === 'doc' ? (
          <div className="bg-white p-16 shadow-2xl max-w-[800px] mx-auto min-h-full">
            <article className="prose prose-slate max-w-none" dangerouslySetInnerHTML={{ __html: htmlContent }} />
          </div>
        ) : (
          <pre className="bg-slate-900 text-emerald-400 p-8 rounded-3xl font-mono text-sm">{content}</pre>
        )}
      </div>
    </div>
  );
};

export default MarkdownPreview;
