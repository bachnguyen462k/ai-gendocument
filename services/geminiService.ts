
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { ApiInfo } from "../types";

export const generateApiDoc = async (apis: ApiInfo[], template: string, projectName: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  if (!process.env.API_KEY) {
    throw new Error("Lỗi: API_KEY không tìm thấy trong cấu hình.");
  }

  let finalFullDoc = "";
  const currentDate = new Date().toLocaleDateString('vi-VN');

  for (const api of apis) {
    const parts: any[] = [];
    
    const apiContext = `
      API_NAME: ${api.name}
      METHOD: ${api.method}
      ENDPOINT: ${api.endpoint}
      DESCRIPTION: ${api.description}
      AUTH_TYPE: ${api.authType}
      REQUEST_JSON: ${api.requestBody}
      RESPONSE_JSON: ${api.responseBody}
      INPUT_PARAMS: ${JSON.stringify(api.inputParams)}
      OUTPUT_PARAMS: ${JSON.stringify(api.outputParams)}
    `;

    const prompt = `
      Bạn là một chuyên gia Technical Writing. Hãy điền thông tin vào Template dưới đây dựa trên dữ liệu API cung cấp.

      DỮ LIỆU API:
      ${apiContext}

      TEMPLATE:
      ${template}

      YÊU CẦU BẮT BUỘC:
      1. Thay {{PROJECT_NAME}} bằng "${projectName}", {{CURRENT_DATE}} bằng "${currentDate}".
      2. Tại {{REQUEST_DESCRIPTION_TABLE}}, bạn PHẢI tạo một bảng Markdown với các cột: | Trường (Field) | Kiểu dữ liệu | Bắt buộc | Mô tả ý nghĩa |. Hãy phân tích từ INPUT_PARAMS.
      3. Tại {{RESPONSE_DESCRIPTION_TABLE}}, bạn PHẢI tạo một bảng Markdown với các cột: | Trường (Field) | Kiểu dữ liệu | Mô tả ý nghĩa |. Hãy phân tích từ OUTPUT_PARAMS.
      4. Tại {{SEQUENCE_DIAGRAM}}, nếu tôi có gửi ảnh đính kèm, hãy giữ nguyên nội dung là "{{SEQUENCE_DIAGRAM_IMAGE}}".
      5. Tại {{SEQUENCE_FLOW}}, hãy phân tích logic API hoặc ảnh sơ đồ trình tự (nếu có) để mô tả chi tiết các bước thực hiện của API (Client -> Server -> Database/Service -> Response).
      6. Giữ nguyên định dạng và các phần tiêu đề của Template.
    `;

    parts.push({ text: prompt });

    if (api.sequenceDiagram && api.sequenceDiagram.includes('base64,')) {
      const [header, data] = api.sequenceDiagram.split(',');
      const mimeType = header.split(':')[1].split(';')[0];
      parts.push({
        inlineData: { data, mimeType }
      });
    }

    try {
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts },
        config: {
          systemInstruction: "Bạn là Technical Writer. Luôn xuất ra Markdown sạch sẽ, sử dụng bảng cho các tham số.",
          temperature: 0.1,
        },
      });

      let text = response.text || "";
      
      // Nhúng lại ảnh vào vị trí placeholder sau khi AI trả về
      if (api.sequenceDiagram) {
        text = text.replace("{{SEQUENCE_DIAGRAM_IMAGE}}", `\n\n<img src="${api.sequenceDiagram}" width="600" />\n\n`);
      } else {
        text = text.replace("{{SEQUENCE_DIAGRAM_IMAGE}}", "*Không có sơ đồ trình tự*");
      }

      finalFullDoc += text + "\n\n<div style='page-break-after: always;'></div>\n\n";
    } catch (error: any) {
      finalFullDoc += `\n> Lỗi xử lý API ${api.name}: ${error.message}\n`;
    }
  }

  return finalFullDoc;
};
