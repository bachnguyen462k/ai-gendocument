
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { ApiInfo } from "../types";

export const generateApiDoc = async (apis: ApiInfo[], template: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  if (!process.env.API_KEY) {
    throw new Error("Lỗi cấu hình: API_KEY không tìm thấy.");
  }

  // Chúng ta sẽ tạo tài liệu cho từng API và nối lại hoặc xử lý API đầu tiên được chọn
  // Trong phạm vi này, tôi sẽ hướng dẫn tạo cho toàn bộ danh sách APIs trong project
  
  let finalFullDoc = "";

  for (const api of apis) {
    const parts: any[] = [];
    
    // 1. Chuẩn bị dữ liệu văn bản
    const apiContext = `
      API NAME: ${api.name}
      METHOD: ${api.method}
      ENDPOINT: ${api.endpoint}
      DESCRIPTION: ${api.description}
      AUTH: ${api.authType}
      REQUEST_JSON: ${api.requestBody}
      RESPONSE_JSON: ${api.responseBody}
      INPUT_FIELDS: ${JSON.stringify(api.inputParams)}
      OUTPUT_FIELDS: ${JSON.stringify(api.outputParams)}
    `;

    const prompt = `
      Dựa trên dữ liệu API và hình ảnh sơ đồ (nếu có), hãy hoàn thiện tài liệu Markdown theo mẫu sau:
      
      MẪU TEMPLATE:
      ${template}

      HƯỚNG DẪN CHI TIẾT:
      1. Thay thế {{API_NAME}}, {{ENDPOINT}}, {{METHOD}}, {{DESCRIPTION}}, {{AUTH_TYPE}} bằng dữ liệu tương ứng.
      2. Tại {{REQUEST_DESCRIPTION_TABLE}}, tạo bảng Markdown gồm: Trường, Kiểu dữ liệu, Bắt buộc, Mô tả (dịch từ dữ liệu INPUT_FIELDS).
      3. Tại {{RESPONSE_DESCRIPTION_TABLE}}, tạo bảng Markdown gồm: Trường, Kiểu dữ liệu, Mô tả (từ OUTPUT_FIELDS).
      4. Tại {{SEQUENCE_DIAGRAM}}, nếu có ảnh đính kèm, hãy để placeholder là "![Sequence Diagram](image_path_placeholder)".
      5. Tại {{SEQUENCE_FLOW}}, hãy phân tích hình ảnh sơ đồ trình tự để mô tả các bước nghiệp vụ từ Client qua Server đến DB/Service khác. Nếu không có ảnh, hãy dựa vào logic API để mô tả luồng hợp lý.
      
      DỮ LIỆU CỤ THỂ:
      ${apiContext}
    `;

    parts.push({ text: prompt });

    // 2. Nếu có ảnh Sequence Diagram (Base64), thêm vào làm Input cho Gemini
    if (api.sequenceDiagram && api.sequenceDiagram.includes('base64,')) {
      const base64Data = api.sequenceDiagram.split(',')[1];
      const mimeType = api.sequenceDiagram.split(';')[0].split(':')[1];
      parts.push({
        inlineData: {
          data: base64Data,
          mimeType: mimeType
        }
      });
    }

    try {
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-3-flash-preview', // Sử dụng model có khả năng Vision/Reasoning tốt hơn
        contents: { parts },
        config: {
          systemInstruction: "Bạn là một chuyên gia Technical Writer cao cấp. Bạn có khả năng phân tích sơ đồ kỹ thuật và chuyển đổi dữ liệu thô thành tài liệu Markdown chuyên nghiệp, sạch sẽ.",
          temperature: 0.2, // Giữ độ chính xác cao
        },
      });

      finalFullDoc += (response.text || "") + "\n\n---\n\n";
    } catch (error: any) {
      console.error(`Lỗi khi tạo tài liệu cho API ${api.name}:`, error);
      finalFullDoc += `\n> Lỗi khi tạo tài liệu cho API ${api.name}: ${error.message}\n`;
    }
  }

  return finalFullDoc || "Không có dữ liệu được tạo.";
};
