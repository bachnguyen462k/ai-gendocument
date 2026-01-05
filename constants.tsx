
import React from 'react';

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

## Notes
- All requests must include an \`Authorization\` header.
- Error codes follow standard HTTP status conventions.
`;

export const METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
