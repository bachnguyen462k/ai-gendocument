
export const DEFAULT_TEMPLATE = `
# TÀI LIỆU CHI TIẾT ĐẶC TẢ API

---

## {{API_INDEX}}. MÔ TẢ CHI TIẾT API: {{API_NAME}}

### {{API_INDEX}}.1. Thông tin chung
- **Tên API**: {{API_NAME}}
- **Mô tả nghiệp vụ**: {{DESCRIPTION}}
- **Hệ thống/Dự án**: {{PROJECT_NAME}}

### {{API_INDEX}}.2. Phương thức kết nối
- **URL Endpoint**: \`{{ENDPOINT}}\`
- **Giao thức/Method**: \`{{METHOD}}\`

### {{API_INDEX}}.3. Phương thức xác thực
- **Cơ chế xác thực**: {{AUTH_TYPE}}
- **Vị trí truyền**: Authorization Header

### {{API_INDEX}}.4. Các trường dữ liệu input (Request)
{{REQUEST_TABLE}}

**Mẫu Request Body (JSON):**
\`\`\`json
{{REQUEST_JSON}}
\`\`\`

### {{API_INDEX}}.5. Các trường dữ liệu output (Response)
{{RESPONSE_TABLE}}

**Mẫu Response Body (JSON):**
\`\`\`json
{{RESPONSE_JSON}}
\`\`\`

### {{API_INDEX}}.6. Sơ đồ Sequence Diagram
{{SEQUENCE_IMAGE}}

### {{API_INDEX}}.7. Mô tả luồng dựa vào sơ đồ Sequence Diagram
{{FLOW_DESCRIPTION}}

### {{API_INDEX}}.8. Exception (Xử lý ngoại lệ)
{{EXCEPTION_DETAILS}}

---
<div style="page-break-after: always;"></div>
`;

export const METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
