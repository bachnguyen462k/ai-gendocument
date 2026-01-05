
import { GoogleGenAI } from "@google/genai";
import { ApiInfo } from "../types";

export const generateApiDoc = async (apis: ApiInfo[], template: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const apisDataString = apis.map(api => `
    API: ${api.name}
    Method: ${api.method}
    Endpoint: ${api.endpoint}
    Request JSON: ${api.requestBody}
    Response JSON: ${api.responseBody}
    Inputs: ${JSON.stringify(api.inputParams)}
    Outputs: ${JSON.stringify(api.outputParams)}
  `).join('\n\n');

  const prompt = `
    Bạn là một kỹ sư viết tài liệu kỹ thuật. Hãy sử dụng mẫu dưới đây để tạo tài liệu API cho danh sách các API sau.
    Hãy phân tích logic từ JSON và các tham số để viết mô tả chuyên nghiệp.
    Nếu có ảnh sơ đồ, hãy nhắc đến nó trong tài liệu.

    DANH SÁCH API:
    ${apisDataString}

    MẪU TÀI LIỆU (Markdown):
    ${template}

    Hãy trả về toàn bộ tài liệu dưới dạng Markdown.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
    });

    return response.text || "";
  } catch (error) {
    console.error("Gemini Error:", error);
    throw new Error("Không thể tạo tài liệu qua AI.");
  }
};
