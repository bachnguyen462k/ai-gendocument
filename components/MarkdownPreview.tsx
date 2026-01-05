
import React from 'react';
import { Download, FileText, CheckCircle } from 'lucide-react';
import { marked } from 'marked';

interface Props {
  content: string;
  projectName?: string;
}

const MarkdownPreview: React.FC<Props> = ({ content, projectName = 'API_Doc' }) => {
  const downloadDocx = () => {
    const htmlContent = marked.parse(content);
    
    // Header đặc biệt để Microsoft Word hiểu định dạng trang và bảng
    const header = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' 
            xmlns:w='urn:schemas-microsoft-com:office:word' 
            xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <style>
          @page { size: 21cm 29.7cm; margin: 2cm; }
          body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.5; color: #333; }
          h1 { color: #1a365d; font-size: 24pt; text-align: center; border-bottom: 2px solid #1a365d; margin-bottom: 20px; }
          h2 { color: #2c5282; font-size: 18pt; margin-top: 30px; border-left: 5px solid #2c5282; padding-left: 10px; }
          h3 { color: #4a5568; font-size: 14pt; margin-top: 20px; text-decoration: underline; }
          table { border-collapse: collapse; width: 100%; margin: 20px 0; border: 1px solid #000; }
          th { background-color: #edf2f7; border: 1px solid #000; padding: 8px; font-weight: bold; text-align: center; }
          td { border: 1px solid #000; padding: 8px; vertical-align: top; }
          pre { background-color: #f7fafc; border: 1px solid #e2e8f0; padding: 10px; font-family: Consolas, monospace; font-size: 10pt; }
          code { font-family: Consolas, monospace; background: #eee; padding: 2px; }
          img { display: block; margin: 20px auto; max-width: 100%; border: 1px solid #ddd; }
          .footer { font-size: 9pt; color: #718096; text-align: center; margin-top: 50px; }
        </style>
      </head>
      <body>
        ${htmlContent}
        <p class="footer">Tài liệu được khởi tạo bởi API Doc Architect AI</p>
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff', header], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${projectName}_API_Specification.docx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-[3rem] border border-slate-100 overflow-hidden shadow-2xl flex flex-col min-h-[700px]">
      <div className="px-10 py-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg text-white"><FileText size={18} /></div>
          <span className="font-black uppercase text-xs text-slate-500 tracking-widest">Xem trước tài liệu kỹ thuật</span>
        </div>
        <button 
          onClick={downloadDocx}
          className="flex items-center gap-2 bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest hover:bg-black px-8 py-4 rounded-2xl shadow-xl transition-all active:scale-95"
        >
          <Download size={14} /> TẢI FILE .DOCX
        </button>
      </div>
      <div className="flex-1 p-16 overflow-auto doc-scroll bg-white">
        <div 
          className="prose prose-slate max-w-none 
            prose-headings:text-slate-900 prose-headings:font-black
            prose-table:border prose-table:border-slate-200 prose-th:bg-slate-50 prose-th:p-4 prose-td:p-4
            prose-img:rounded-3xl prose-img:mx-auto prose-img:shadow-2xl"
          dangerouslySetInnerHTML={{ __html: marked.parse(content) }}
        />
      </div>
    </div>
  );
};

export default MarkdownPreview;
