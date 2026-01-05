
export const DEFAULT_TEMPLATE = `
# TÀI LIỆU ĐẶC TẢ KỸ THUẬT API

## 1. THÔNG TIN CHUNG
- **Công ty**: [TÊN CÔNG TY CỦA BẠN]
- **Dự án**: {{PROJECT_NAME}}
- **Phiên bản**: 1.0.0
- **Ngày tạo**: {{CURRENT_DATE}}

---

## 2. MÔ TẢ CHI TIẾT API: {{API_NAME}}

### 2.1. Thông tin Endpoint
- **Mô tả chức năng**: {{DESCRIPTION}}
- **Endpoint**: \`{{ENDPOINT}}\`
- **Phương thức**: \`{{METHOD}}\`
- **Xác thực (Auth)**: {{AUTH_TYPE}}

### 2.2. Chi tiết Tham số Đầu vào (Request)
{{REQUEST_DESCRIPTION_TABLE}}

**Ví dụ Request Body (JSON):**
\`\`\`json
{{REQUEST_JSON}}
\`\`\`

### 2.3. Chi tiết Dữ liệu Trả về (Response)
{{RESPONSE_DESCRIPTION_TABLE}}

**Ví dụ Response Body (JSON):**
\`\`\`json
{{RESPONSE_JSON}}
\`\`\`

### 2.4. Sơ đồ trình tự (Sequence Diagram)
{{SEQUENCE_DIAGRAM}}

### 2.5. Mô tả luồng xử lý chi tiết
{{SEQUENCE_FLOW}}

---

## 3. QUY CHUẨN CHUNG & MÃ LỖI
- Mọi API đều trả về định dạng JSON.
- Mã lỗi chuẩn: 200 (Success), 400 (Bad Request), 401 (Unauthorized), 500 (Internal Server Error).

*Tài liệu này được bảo mật và thuộc quyền sở hữu của {{PROJECT_NAME}}*
`;

export const METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
