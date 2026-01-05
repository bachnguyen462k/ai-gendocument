
import React from 'react';
import { Download, FileText, CheckCircle } from 'lucide-react';

interface Props {
  content: string;
}

// Fixed: Initialized the MarkdownPreview component and added default export
const MarkdownPreview: React.FC<Props> = ({ content }) => {
  return (
    <div className="bg-white rounded-[3rem] border border-slate-100 overflow-hidden shadow-sm min-h-[600px] flex flex-col">
      <div className="px-10 py-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
        <span className="font-black uppercase text-[10px] text-slate-400 tracking-widest flex items-center gap-2">
          <FileText size={16} /> Tài liệu Markdown
        </span>
        <button className="flex items-center gap-2 text-blue-600 font-bold text-xs hover:bg-blue-50 px-4 py-2 rounded-xl transition-all">
          <Download size={14} /> TẢI XUỐNG .MD
        </button>
      </div>
      <div className="flex-1 p-12 overflow-auto prose prose-slate max-w-none prose-headings:font-black prose-headings:tracking-tighter prose-code:bg-slate-100 prose-code:p-1 prose-code:rounded-md">
        <div className="whitespace-pre-wrap font-sans text-slate-700 leading-relaxed">
          {content}
        </div>
      </div>
    </div>
  );
};

export default MarkdownPreview;
