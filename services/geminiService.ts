
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { ApiInfo } from "../types";

export const generateApiDoc = async (apis: ApiInfo[], template: string): Promise<string> => {
  // Fix: Use process.env.API_KEY directly when initializing the GoogleGenAI client
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

  const prompt = `
    Bạn là một kỹ sư viết tài liệu kỹ thuật (Technical Writer) chuyên nghiệp. 
    Hãy sử dụng mẫu dưới đây để tạo tài liệu đặc tả API cho danh sách các API sau.
    
    YÊU CẦU:
    1. Phân tích cấu trúc JSON để mô tả chi tiết từng trường dữ liệu.
    2. Viết bằng ngôn ngữ kỹ thuật chuẩn mực, dễ hiểu.
    3. Trình bày đẹp mắt dưới dạng Markdown.
    4. Giữ nguyên định dạng của các placeholder trong mẫu nếu không có dữ liệu thay thế.

    DANH SÁCH API CẦN VIẾT:
    ${apisDataString}

    MẪU TÀI LIỆU MỤC TIÊU:
    ${template}

    Hãy trả về toàn bộ tài liệu Markdown hoàn chỉnh.
  `;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    // Fix: Access the .text property directly (not a method call) as per SDK rules
    return response.text || "AI không trả về kết quả.";
  } catch (error: any) {
    console.error("Gemini Error:", error);
    throw new Error(`AI Generation Failed: ${error.message || "Unknown error"}`);
  }
};
