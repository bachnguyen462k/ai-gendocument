
import React from 'react';
import { Download, FileText, CheckCircle } from 'lucide-react';
import { marked } from 'marked';

interface Props {
  content: string;
  projectName?: string;
}

const MarkdownPreview: React.FC<Props> = ({ content, projectName = 'TaiLieu_API' }) => {
  const downloadDoc = () => {
    const htmlContent = marked.parse(content);
    
    const header = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' 
            xmlns:w='urn:schemas-microsoft-com:office:word' 
            xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>Technical API Specification</title>
        <style>
          @page { size: A4; margin: 2cm; }
          body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.5; color: #000; }
          h1 { color: #2b6cb0; text-align: center; font-size: 24pt; margin-bottom: 30px; border-bottom: 2px solid #2b6cb0; padding-bottom: 10px; }
          h2 { color: #1a202c; font-size: 18pt; margin-top: 40px; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px; }
          h3 { color: #2d3748; font-size: 14pt; margin-top: 25px; font-weight: bold; background: #f7fafc; padding: 5px; border-left: 5px solid #4a5568; }
          table { border-collapse: collapse; width: 100%; margin: 20px 0; border: 1pt solid black; }
          th { background-color: #f1f5f9; border: 1pt solid black; padding: 10px; font-weight: bold; text-align: center; }
          td { border: 1pt solid black; padding: 10px; vertical-align: top; }
          pre { background-color: #f8fafc; border: 0.5pt solid #cbd5e1; padding: 15px; font-family: 'Courier New', monospace; font-size: 10pt; white-space: pre-wrap; }
          code { font-family: 'Courier New', monospace; font-weight: bold; }
          img { display: block; margin: 20px auto; max-width: 100%; }
        </style>
      </head>
      <body>
        ${htmlContent}
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff', header], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${projectName.replace(/\s+/g, '_')}_Spec.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-[3rem] border border-slate-100 overflow-hidden shadow-2xl flex flex-col min-h-[700px]">
      <div className="px-10 py-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2.5 rounded-xl text-white shadow-lg"><FileText size={20} /></div>
          <div>
            <span className="font-black uppercase text-[10px] text-slate-400 tracking-widest block">Xem trước tài liệu 8 phần</span>
            <span className="text-xs font-bold text-slate-600">{projectName}</span>
          </div>
        </div>
        <button 
          onClick={downloadDoc}
          className="flex items-center gap-2 bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest hover:bg-black px-10 py-5 rounded-2xl shadow-xl transition-all active:scale-95"
        >
          <Download size={16} /> TẢI FILE .DOC
        </button>
      </div>
      <div className="flex-1 p-16 overflow-auto doc-scroll bg-white">
        <div 
          className="prose prose-slate max-w-none 
            prose-headings:text-slate-900 prose-headings:font-black
            prose-table:border-2 prose-table:border-black prose-th:bg-slate-100 prose-th:text-slate-900 prose-th:p-3 prose-td:p-3
            prose-img:rounded-3xl prose-img:mx-auto prose-img:shadow-2xl"
          dangerouslySetInnerHTML={{ __html: marked.parse(content) }}
        />
      </div>
    </div>
  );
};

export default MarkdownPreview;
