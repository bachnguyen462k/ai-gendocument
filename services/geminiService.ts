
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { ApiInfo } from "../types";

export const generateApiDoc = async (apis: ApiInfo[], template: string): Promise<string> => {
  // Khởi tạo SDK với model nhanh nhất cho tác vụ văn bản
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  if (!process.env.API_KEY) {
    throw new Error("Lỗi cấu hình: API_KEY không tìm thấy trong môi trường hệ thống.");
  }

  const apisDataString = apis.map(api => `
    ---
    API: ${api.name}
    Method: ${api.method}
    Endpoint: ${api.endpoint}
    Description: ${api.description}
    Request JSON: ${api.requestBody}
    Response JSON: ${api.responseBody}
    Inputs: ${JSON.stringify(api.inputParams)}
    Outputs: ${JSON.stringify(api.outputParams)}
  `).join('\n\n');

  // Rút gọn system instruction để AI xử lý nhanh hơn
  const systemInstruction = `
    Bạn là Technical Writer. 
    Nhiệm vụ: Chuyển đổi dữ liệu API thành Markdown dựa trên mẫu template.
    Yêu cầu: 
    1. Trình bày bảng tham số chuyên nghiệp.
    2. Giải thích logic từ JSON.
    3. Phản hồi ngắn gọn, tập trung vào nội dung tài liệu.
  `;

  const prompt = `
    DỮ LIỆU API:
    ${apisDataString}

    MẪU TEMPLATE:
    ${template}

    Hãy viết tài liệu Markdown hoàn chỉnh ngay lập tức.
  `;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-flash-lite-latest', // Model cực nhanh, độ trễ thấp
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.4, // Giảm độ sáng tạo để tăng tốc độ và độ chính xác kỹ thuật
        topP: 0.8,
        thinkingConfig: { thinkingBudget: 0 } // Tắt chế độ suy nghĩ sâu để trả kết quả ngay
      },
    });

    return response.text || "AI không trả về kết quả.";
  } catch (error: any) {
    console.error("Gemini Error:", error);
    throw new Error(`AI Generation Failed: ${error.message || "Unknown error"}`);
  }
};
