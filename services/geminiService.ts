
import { GoogleGenAI } from "@google/genai";
import { ApiInfo } from "../types";

/**
 * Generates API documentation using Gemini AI.
 * Always uses API_KEY from environment variables as per guidelines.
 */
export const generateApiDoc = async (apis: ApiInfo[], templateHtml: string): Promise<string> => {
  // Use the API key directly from process.env.API_KEY and use named parameter for initialization.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const apisDataString = apis.map((api, index) => `
    API #${index + 1}:
    - Tên API: ${api.name}
    - Mô tả chức năng: ${api.description}
    - Method: ${api.method}
    - Endpoint: ${api.endpoint}
    - Payload Request (JSON): ${api.requestBody}
    - Payload Response (JSON): ${api.responseBody}
    - Bảng tham số đầu vào: ${JSON.stringify(api.inputParams)}
    - Bảng tham số đầu ra: ${JSON.stringify(api.outputParams)}
    - Có ảnh Sequence Diagram: ${api.sequenceDiagram ? 'CÓ' : 'KHÔNG'}
  `).join('\n\n---\n\n');

  const prompt = `
    Bạn là một kỹ sư hệ thống chuyên viết tài liệu đặc tả kỹ thuật API (Technical Design Document).
    Nhiệm vụ: Sử dụng nội dung từ file mẫu (TEMPLATE) và điền thông tin chi tiết các API vào đúng các mục tương ứng.

    YÊU CẦU CHI TIẾT:
    1. Giữ nguyên toàn bộ cấu trúc định dạng của TEMPLATE (Style, Table, Font).
    2. Tại mỗi mục API, hãy viết "Mô tả chi tiết đầu vào" bao gồm:
       - Giải thích logic xử lý của API.
       - Trình bày bảng tham số Request và ví dụ JSON Request.
       - Trình bày bảng tham số Response và ví dụ JSON Response.
    3. QUAN TRỌNG: Nếu API có ảnh Sequence Diagram, hãy chèn một đoạn mã HTML img với src="[IMAGE_DATA_API_X]" (trong đó X là số thứ tự của API, ví dụ API #1 thì X=1) vào vị trí mô tả sơ đồ. 
       Nếu không có ảnh, hãy viết "Chưa có sơ đồ trình tự cho API này".
    4. Đảm bảo ngôn ngữ kỹ thuật chuyên nghiệp, chính xác.

    DỮ LIỆU API:
    ${apisDataString}

    FILE MẪU:
    ${templateHtml}

    LƯU Ý: Không tóm tắt nội dung, hãy viết đầy đủ và chi tiết nhất có thể để lập trình viên có thể hiểu và code được ngay.
  `;

  try {
    // Using gemini-3-pro-preview as this is a complex technical documentation reasoning task.
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        temperature: 0.1,
      },
    });

    // Directly accessing .text property (not a method call) to extract the response.
    let docContent = response.text || "";

    // Thay thế các placeholder ảnh bằng dữ liệu Base64 thực tế
    apis.forEach((api, idx) => {
      if (api.sequenceDiagram) {
        const placeholder = `[IMAGE_DATA_API_${idx + 1}]`;
        docContent = docContent.split(placeholder).join(api.sequenceDiagram);
      }
    });

    return docContent;
  } catch (error) {
    console.error("Gemini Error:", error);
    throw new Error("Lỗi khi tạo tài liệu chi tiết. Hãy kiểm tra kết nối mạng và đảm bảo API_KEY hợp lệ.");
  }
};
