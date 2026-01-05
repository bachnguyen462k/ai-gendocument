
import { GoogleGenAI } from "@google/genai";
import { ApiInfo } from "../types";

export const generateApiDoc = async (apiInfo: ApiInfo, template: string): Promise<string> => {
  // Always initialize GoogleGenAI with { apiKey: process.env.API_KEY } as per guidelines.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `
    Bạn là một chuyên gia viết tài liệu kỹ thuật (Technical Writer) cao cấp. 
    Hãy viết tài liệu API dựa trên thông tin chi tiết dưới đây và tuân thủ tuyệt đối theo mẫu (template) đã cung cấp.
    
    THÔNG TIN CHI TIẾT API:
    - Tên API: ${apiInfo.name}
    - Phương thức: ${apiInfo.method}
    - Endpoint: ${apiInfo.endpoint}
    - Xác thực: ${apiInfo.authType}
    
    CÁC TRƯỜNG DỮ LIỆU INPUT:
    ${JSON.stringify(apiInfo.inputParams, null, 2)}

    REQUEST BODY MẪU:
    ${apiInfo.requestBody}

    RESPONSE BODY MẪU:
    ${apiInfo.responseBody}

    MẪU TÀI LIỆU (TEMPLATE):
    ${template}

    YÊU CẦU CỤ THỂ:
    1. Trình bày các trường dữ liệu input dưới dạng bảng Markdown chuyên nghiệp (Tên, Kiểu, Bắt buộc, Mô tả).
    2. Giải thích ý nghĩa của từng trường dựa trên tên và kiểu dữ liệu nếu mô tả còn sơ sài.
    3. Điền các giá trị vào các placeholder: {{API_NAME}}, {{ENDPOINT}}, {{METHOD}}, {{AUTH_TYPE}}, {{REQUEST_JSON}}, {{RESPONSE_JSON}}, {{REQUEST_DESCRIPTION}}.
    4. Tài liệu phải mạch lạc, chuẩn văn phong kỹ thuật.
    5. Ngôn ngữ: Tiếng Việt.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        temperature: 0.3, // Lower temperature for more consistent technical output
        topP: 0.95,
      },
    });

    // Use .text property to extract output string
    return response.text || "Không thể tạo tài liệu.";
  } catch (error) {
    console.error("Gemini Error:", error);
    throw new Error("Lỗi khi kết nối với AI. Vui lòng thử lại.");
  }
};
