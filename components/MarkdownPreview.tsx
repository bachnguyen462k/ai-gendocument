
import React, { useState, useMemo } from 'react';
// Added Loader2 to the imports from lucide-react
import { Copy, Check, Download, FileText, Share2, Cloud, Eye, FileCode, Loader2 } from 'lucide-react';
import { marked } from 'marked';

interface MarkdownPreviewProps {
  content: string;
  onSaveToDrive?: () => void;
  isSyncing?: boolean;
}

const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({ content, onSaveToDrive, isSyncing }) => {
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'doc' | 'code'>('doc');

  // Parse markdown to HTML
  const htmlContent = useMemo(() => {
    return marked.parse(content);
  }, [content]);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = (type: 'md' | 'doc') => {
    let blob: Blob;
    let filename: string;

    if (type === 'doc') {
      const fullHtml = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
        <head><meta charset="utf-8"><title>API Documentation</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
          h1 { color: #1e40af; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; }
          h2 { color: #1e3a8a; margin-top: 24px; border-bottom: 1px solid #f1f5f9; }
          table { border-collapse: collapse; width: 100%; margin: 16px 0; }
          th, td { border: 1px solid #cbd5e1; padding: 12px; text-align: left; }
          th { background-color: #f8fafc; font-weight: bold; }
          code { background-color: #f1f5f9; padding: 2px 4px; border-radius: 4px; font-family: Consolas, monospace; }
          pre { background-color: #1e293b; color: #f8fafc; padding: 16px; border-radius: 8px; overflow-x: auto; }
        </style>
        </head>
        <body>${htmlContent}</body>
        </html>
      `;
      blob = new Blob([fullHtml], { type: 'application/msword' });
      filename = 'api-documentation.doc';
    } else {
      blob = new Blob([content], { type: 'text/markdown' });
      filename = 'api-documentation.md';
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-slate-200 rounded-[2.5rem] shadow-inner border border-slate-300 overflow-hidden flex flex-col h-full border-t-4 border-t-blue-600">
      {/* Word-like Toolbar */}
      <div className="flex flex-wrap items-center justify-between px-6 py-3 bg-white border-b border-slate-300 gap-4">
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            onClick={() => setViewMode('doc')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'doc' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Eye size={14} /> Chế độ Word
          </button>
          <button
            onClick={() => setViewMode('code')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'code' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <FileCode size={14} /> Mã Markdown
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="h-6 w-[1px] bg-slate-300 mx-1"></div>
          
          <button
            onClick={handleCopy}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-2"
            title="Sao chép nội dung"
          >
            {copied ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
          </button>
          
          <div className="flex bg-slate-100 rounded-xl border border-slate-200 overflow-hidden">
            <button
              onClick={() => handleDownload('md')}
              className="px-3 py-1.5 text-[10px] font-black text-slate-600 hover:bg-white transition-all border-r border-slate-200"
            >
              MD
            </button>
            <button
              onClick={() => handleDownload('doc')}
              className="px-3 py-1.5 text-[10px] font-black text-blue-600 hover:bg-white transition-all flex items-center gap-1"
            >
              <FileText size={14} /> DOC
            </button>
          </div>

          <button
            onClick={onSaveToDrive}
            disabled={isSyncing}
            className="flex items-center px-4 py-2 text-xs font-black text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-all shadow-md shadow-blue-100 disabled:opacity-50"
          >
            {isSyncing ? <Loader2 className="animate-spin mr-2" size={14} /> : <Cloud size={14} className="mr-2" />}
            {isSyncing ? 'ĐANG LƯU...' : 'LƯU LÊN DRIVE'}
          </button>
        </div>
      </div>

      {/* Document Workspace */}
      <div className="flex-1 overflow-auto doc-scroll bg-slate-200 p-4 sm:p-8">
        {viewMode === 'doc' ? (
          <div className="mx-auto bg-white shadow-2xl min-h-[1000px] w-full max-w-[850px] p-12 sm:p-20 relative animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Paper decoration */}
            <div className="absolute top-0 left-0 w-full h-1 bg-blue-500/10"></div>
            
            <article className="prose prose-slate max-w-none 
              prose-headings:font-black prose-headings:text-slate-900 
              prose-h1:text-4xl prose-h1:border-b-4 prose-h1:border-blue-600 prose-h1:pb-4
              prose-h2:text-2xl prose-h2:text-blue-800 prose-h2:mt-12
              prose-p:text-slate-600 prose-p:leading-relaxed
              prose-table:border prose-table:border-slate-200 prose-table:rounded-xl prose-table:overflow-hidden
              prose-th:bg-slate-50 prose-th:p-4 prose-th:text-xs prose-th:uppercase prose-th:tracking-widest
              prose-td:p-4 prose-td:text-sm
              prose-pre:bg-slate-900 prose-pre:rounded-2xl prose-pre:shadow-xl
              prose-code:text-blue-600 prose-code:bg-blue-50 prose-code:px-1 prose-code:rounded prose-code:font-mono
            " 
            dangerouslySetInnerHTML={{ __html: htmlContent }} />
            
            {/* Page Footer Simulator */}
            <div className="mt-20 pt-8 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase tracking-widest">
               <span>Generated by API Doc Architect AI</span>
               <span>Trang 1 / 1</span>
            </div>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-[850px] animate-in fade-in duration-300">
            <div className="bg-slate-900 rounded-3xl p-8 shadow-2xl border border-slate-800">
              <pre className="text-blue-300 font-mono text-sm leading-relaxed whitespace-pre-wrap">
                {content}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MarkdownPreview;
