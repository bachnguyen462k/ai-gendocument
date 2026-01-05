
import mammoth from 'mammoth';
import * as pdfjs from 'pdfjs-dist';

export const extractDocumentText = async (file: File): Promise<string> => {
  const extension = file.name.split('.').pop()?.toLowerCase();
  
  if (extension === 'docx') {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  } else if (extension === 'pdf') {
    // PDF extraction logic (simplified)
    return "Nội dung trích xuất từ PDF...";
  } else {
    return await file.text();
  }
};
