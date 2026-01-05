
import { GoogleGenAI } from "@google/genai";
import { ApiInfo } from "../types";

/**
 * Generates API documentation using Gemini AI.
 * Always uses API_KEY from environment variables as per guidelines.
 */
export const generateApiDoc = async (apis: ApiInfo[], templateHtml: string): Promise<string> => {
  // Use the API key directly from process.env.API_KEY as strictly required by instructions.
  // Named parameter must be used.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const apisDataString = apis.map((api, index) => `
    API #${index + 1}:
    - Tên API: ${api.name}
    - Mô tả chức năng: ${api.description}
    - Method: ${api.method}
    - Endpoint: ${api.endpoint}
    - Payload Request (JSON): ${api.requestBody}
    - Payload Response (JSON): ${api.responseBody}
    - Bảng tham số đầu vào (bao gồm mô tả chi tiết): ${JSON.stringify(api.inputParams)}
    - Bảng tham số đầu ra (bao gồm mô tả chi tiết): ${JSON.stringify(api.outputParams)}
    - Có ảnh Sequence Diagram: ${api.sequenceDiagram ? 'CÓ' : 'KHÔNG'}
  `).join('\n\n---\n\n');

  const prompt = `
    Bạn là một kỹ sư hệ thống chuyên viết tài liệu đặc tả kỹ thuật API (Technical Design Document).
    Nhiệm vụ: Sử dụng nội dung từ file mẫu (TEMPLATE) và điền thông tin chi tiết các API vào đúng các mục tương ứng.

    YÊU CẦU CHI TIẾT:
    1. Giữ nguyên toàn bộ cấu trúc định dạng của TEMPLATE (Style, Table, Font).
    2. Tại mỗi mục API, hãy viết "Mô tả chi tiết" bao gồm:
       - Giải thích logic xử lý nghiệp vụ của API (Dựa trên mô tả và tên trường).
       - Trình bày bảng tham số Request (Tên, Kiểu, Bắt buộc, Mô tả ý nghĩa).
       - Trình bày bảng tham số Response (Tên, Kiểu, Mô tả ý nghĩa).
       - Cung cấp ví dụ JSON Request/Response đẹp mắt.
    3. QUAN TRỌNG: Nếu API có ảnh Sequence Diagram, hãy chèn một đoạn mã HTML img với src="[IMAGE_DATA_API_X]" (trong đó X là số thứ tự của API, ví dụ API #1 thì X=1) vào vị trí mô tả sơ đồ. 
       Nếu không có ảnh, hãy viết "Chưa có sơ đồ trình tự cho API này".
    4. Đảm bảo ngôn ngữ kỹ thuật chuyên nghiệp, chính xác bằng tiếng Việt.

    DỮ LIỆU API:
    ${apisDataString}

    FILE MẪU (DÙNG ĐỂ LÀM KHUNG):
    ${templateHtml}

    LƯU Ý: Không tóm tắt nội dung, hãy viết đầy đủ và chi tiết nhất có thể để lập trình viên có thể hiểu và code được ngay.
  `;

  try {
    // Using gemini-3-pro-preview for complex reasoning tasks.
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        temperature: 0.2,
      },
    });

    // Directly access .text property.
    let docContent = response.text || "";

    // Replace image placeholders with actual base64 data.
    apis.forEach((api, idx) => {
      if (api.sequenceDiagram) {
        const placeholder = `[IMAGE_DATA_API_${idx + 1}]`;
        docContent = docContent.split(placeholder).join(api.sequenceDiagram);
      }
    });

    return docContent;
  } catch (error) {
    console.error("Gemini SDK Error:", error);
    throw new Error("Lỗi khi gọi Gemini AI. Hãy đảm bảo VITE_API_KEY trong .env là chính xác.");
  }
};
