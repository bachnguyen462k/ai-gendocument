
import React from 'react';
import { Download, FileText, CheckCircle, FileCode } from 'lucide-react';
import { marked } from 'marked';

interface Props {
  content: string;
  projectName?: string;
}

const MarkdownPreview: React.FC<Props> = ({ content, projectName = 'API_Documentation' }) => {
  const downloadDocx = () => {
    // Chuyển đổi Markdown sang HTML
    const htmlContent = marked.parse(content);
    
    // Tạo cấu trúc file HTML mà Microsoft Word có thể nhận diện tốt nhất
    const header = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' 
            xmlns:w='urn:schemas-microsoft-com:office:word' 
            xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>${projectName}</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; }
          h1 { color: #1e40af; border-bottom: 2px solid #1e40af; padding-bottom: 10px; }
          h2 { color: #1e3a8a; margin-top: 25px; border-bottom: 1px solid #e2e8f0; }
          h3 { color: #334155; }
          table { border-collapse: collapse; width: 100%; margin: 20px 0; }
          th, td { border: 1px solid #cbd5e1; padding: 12px; text-align: left; }
          th { background-color: #f8fafc; font-weight: bold; }
          code { background-color: #f1f5f9; padding: 2px 4px; border-radius: 4px; font-family: Consolas, monospace; }
          pre { background-color: #1e293b; color: #f8fafc; padding: 15px; border-radius: 8px; overflow-x: auto; }
          img { max-width: 100%; height: auto; display: block; margin: 20px 0; }
          .footer { font-size: 10px; color: #94a3b8; margin-top: 50px; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 10px; }
        </style>
      </head>
      <body>
        ${htmlContent}
        <div class="footer">Tài liệu được tạo tự động bởi API Doc Architect AI</div>
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff', header], {
      type: 'application/msword'
    });
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${projectName}_Technical_Doc.docx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-[3rem] border border-slate-100 overflow-hidden shadow-sm min-h-[600px] flex flex-col">
      <div className="px-10 py-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
        <span className="font-black uppercase text-[10px] text-slate-400 tracking-widest flex items-center gap-2">
          <FileText size={16} /> Xem trước tài liệu kỹ thuật
        </span>
        <button 
          onClick={downloadDocx}
          className="flex items-center gap-2 bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 px-6 py-3 rounded-xl shadow-lg transition-all active:scale-95"
        >
          <Download size={14} /> TẢI XUỐNG FILE .DOCX
        </button>
      </div>
      <div className="flex-1 p-12 overflow-auto doc-scroll bg-white">
        <div 
          className="prose prose-slate max-w-none prose-headings:font-black prose-headings:tracking-tighter prose-img:rounded-3xl prose-img:shadow-lg prose-table:border prose-table:rounded-xl"
          dangerouslySetInnerHTML={{ __html: marked.parse(content) }}
        />
      </div>
    </div>
  );
};

export default MarkdownPreview;
