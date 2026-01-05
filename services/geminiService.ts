
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { ApiInfo } from "../types";

export const generateApiDoc = async (apis: ApiInfo[], template: string, projectName: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  if (!process.env.API_KEY) {
    throw new Error("Lỗi: Không tìm thấy API_KEY trong hệ thống.");
  }

  let fullDocumentContent = "";
  const currentDate = new Date().toLocaleDateString('vi-VN');

  for (let i = 0; i < apis.length; i++) {
    const api = apis[i];
    const parts: any[] = [];
    
    const context = `
      PROJECT: ${projectName}
      API_NAME: ${api.name}
      METHOD: ${api.method}
      ENDPOINT: ${api.endpoint}
      DESCRIPTION: ${api.description}
      AUTH: ${api.authType}
      INPUT_PARAMS: ${JSON.stringify(api.inputParams)}
      OUTPUT_PARAMS: ${JSON.stringify(api.outputParams)}
      REQ_JSON: ${api.requestBody}
      RES_JSON: ${api.responseBody}
    `;

    const prompt = `
      Bạn là một Technical Writer chuyên nghiệp. Hãy soạn thảo tài liệu cho API "${api.name}" theo cấu trúc 8 phần sau:
      1. Thông tin chung: Tổng quan về chức năng.
      2. Phương thức kết nối: Endpoint và Method.
      3. Phương thức xác thực: Chi tiết về Auth.
      4. Input: Tạo bảng Markdown | Trường | Kiểu | Req | Mô tả |.
      5. Output: Tạo bảng Markdown | Trường | Kiểu | Mô tả |.
      6. Sequence Diagram: Giữ chỗ bằng văn bản "[IMAGE_PLACEHOLDER]".
      7. Mô tả luồng: Phân tích kỹ logic (Client -> Server -> DB) từ thông tin API và ảnh Sequence Diagram (nếu có).
      8. Exception: Liệt kê bảng mã lỗi (400, 401, 403, 404, 500) và các trường hợp lỗi nghiệp vụ cụ thể.

      Sử dụng template sau để điền dữ liệu:
      ${template}

      Dữ liệu đầu vào:
      ${context}
    `;

    parts.push({ text: prompt });

    if (api.sequenceDiagram && api.sequenceDiagram.startsWith('data:image')) {
      const base64Data = api.sequenceDiagram.split(',')[1];
      const mimeType = api.sequenceDiagram.split(';')[0].split(':')[1];
      parts.push({
        inlineData: { data: base64Data, mimeType }
      });
    }

    try {
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts },
        config: { temperature: 0.1 }
      });

      let apiDoc = response.text || "";

      // Xử lý các Placeholder
      if (api.sequenceDiagram) {
        apiDoc = apiDoc.replace("{{SEQUENCE_IMAGE}}", `<img src="${api.sequenceDiagram}" style="width:100%; max-width:600px; display:block; margin:20px auto;" />`);
        apiDoc = apiDoc.replace("[IMAGE_PLACEHOLDER]", "");
      } else {
        apiDoc = apiDoc.replace("{{SEQUENCE_IMAGE}}", "*Chưa cập nhật sơ đồ trình tự*");
      }

      apiDoc = apiDoc
        .replace(/{{API_INDEX}}/g, (i + 1).toString())
        .replace(/{{PROJECT_NAME}}/g, projectName)
        .replace(/{{CURRENT_DATE}}/g, currentDate);

      fullDocumentContent += apiDoc + "\n\n";
    } catch (error: any) {
      fullDocumentContent += `\n> Lỗi khi tạo tài liệu cho API ${api.name}: ${error.message}\n`;
    }
  }

  return fullDocumentContent;
};
