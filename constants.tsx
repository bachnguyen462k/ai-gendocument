
export const DEFAULT_TEMPLATE = `
# TÀI LIỆU KỸ THUẬT API: {{API_NAME}}

## 1. Tổng quan
- **Endpoint**: \`{{ENDPOINT}}\`
- **Phương thức**: \`{{METHOD}}\`
- **Mô tả**: {{DESCRIPTION}}
- **Xác thực**: {{AUTH_TYPE}}

## 2. Chi tiết Request
### 2.1. Tham số đầu vào (Parameters)
{{REQUEST_DESCRIPTION_TABLE}}

### 2.2. Ví dụ Request (JSON)
\`\`\`json
{{REQUEST_JSON}}
\`\`\`

## 3. Chi tiết Response
### 3.1. Cấu trúc dữ liệu trả về (Fields)
{{RESPONSE_DESCRIPTION_TABLE}}

### 3.2. Ví dụ Response (JSON)
\`\`\`json
{{RESPONSE_JSON}}
\`\`\`

## 4. Luồng xử lý (Sequence & Logic)
### 4.1. Sơ đồ trình tự (Sequence Diagram)
{{SEQUENCE_DIAGRAM}}

### 4.2. Giải thích luồng nghiệp vụ
{{SEQUENCE_FLOW}}

---
*Tài liệu được tạo tự động bởi API Doc Architect AI*
`;

export const METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
