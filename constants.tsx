
export const DEFAULT_TEMPLATE = `
# API Documentation: {{API_NAME}}

## Overview
- **Endpoint**: \`{{ENDPOINT}}\`
- **Method**: \`{{METHOD}}\`

## Request
### Parameters
| Name | Type | Description |
| :--- | :--- | :--- |
{{REQUEST_DESCRIPTION}}

### Request Example (JSON)
\`\`\`json
{{REQUEST_JSON}}
\`\`\`

## Response
### Fields
| Name | Type | Description |
| :--- | :--- | :--- |
{{RESPONSE_DESCRIPTION}}

### Response Example (JSON)
\`\`\`json
{{RESPONSE_JSON}}
\`\`\`
`;

export const METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
