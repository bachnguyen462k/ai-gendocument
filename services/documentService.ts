
import mammoth from 'mammoth';
import * as pdfjs from 'pdfjs-dist';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export const extractTextFromDocx = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  // Sử dụng convertToHtml để giữ lại các thẻ b, i, table, h1, h2...
  const result = await mammoth.convertToHtml({ arrayBuffer });
  return result.value;
};

export const extractTextFromPdf = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ');
    fullText += pageText + '\n';
  }

  return fullText;
};

export const extractDocumentText = async (file: File): Promise<string> => {
  const extension = file.name.split('.').pop()?.toLowerCase();
  
  if (extension === 'docx') {
    return await extractTextFromDocx(file);
  } else if (extension === 'pdf') {
    return await extractTextFromPdf(file);
  } else if (extension === 'txt' || extension === 'md') {
    return await file.text();
  } else {
    throw new Error('Định dạng file không hỗ trợ. Vui lòng sử dụng .docx, .pdf, .txt hoặc .md');
  }
};
