
const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
const UPLOAD_API_BASE = 'https://www.googleapis.com/upload/drive/v3';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

let currentAccessToken = '';

/**
 * Hàm lấy Access Token mới bằng Refresh Token
 */
async function refreshAccessToken(env: any) {
  if (!env.GOOGLE_REFRESH_TOKEN || !env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new Error("MISSING_CREDENTIALS: Thiếu thông tin Client ID, Secret hoặc Refresh Token để làm mới phiên làm việc.");
  }

  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: env.GOOGLE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`REFRESH_FAILED: ${data.error_description || data.error || 'Không thể làm mới token'}`);
  }

  currentAccessToken = data.access_token;
  console.log("Hệ thống đã tự động gia hạn Access Token mới.");
  return currentAccessToken;
}

/**
 * Hàm gọi API Google tập trung, hỗ trợ tự động Retry khi gặp lỗi 401
 */
async function gfetch(env: any, url: string, options: any = {}, isRetry = false): Promise<any> {
  const token = currentAccessToken || env.GOOGLE_ACCESS_TOKEN;
  
  const headers = new Headers();
  headers.set('Authorization', `Bearer ${token}`);

  if (options.headers) {
    Object.entries(options.headers).forEach(([k, v]) => {
      if (v !== undefined && v !== null) headers.set(k, v as string);
    });
  }

  if (!headers.has('Content-Type') && 
      !(options.body instanceof FormData) && 
      !(options.body instanceof Blob)) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(url, { ...options, headers });

  // Xử lý lỗi 401 (Unauthorized)
  if (res.status === 401 && !isRetry && env.GOOGLE_REFRESH_TOKEN) {
    try {
      await refreshAccessToken(env);
      // Thử lại request với token mới
      return await gfetch(env, url, options, true);
    } catch (refreshErr: any) {
      throw new Error(`AUTH_EXPIRED: Phiên đăng nhập hết hạn và không thể gia hạn tự động. (${refreshErr.message})`);
    }
  }

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Google API Error: ${res.status}`);
  }

  return res.json();
}

/**
 * Helper tạo body multipart/related chuẩn Google Drive API
 */
async function createMultipartBody(metadata: any, content: Blob | string, mimeType: string) {
  const boundary = '-------architect_api_boundary';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadataPart = JSON.stringify(metadata);
  const contentBlob = content instanceof Blob ? content : new Blob([content], { type: mimeType });

  const multipartBlob = new Blob([
    delimiter,
    'Content-Type: application/json; charset=UTF-8\r\n\r\n',
    metadataPart,
    delimiter,
    `Content-Type: ${mimeType}\r\n\r\n`,
    contentBlob,
    closeDelimiter
  ], { type: `multipart/related; boundary=${boundary}` });

  return {
    body: multipartBlob,
    contentType: `multipart/related; boundary=${boundary}`
  };
}

export const updateTemplateFile = async (env: any, folderId: string, content: string) => {
  const q = `'${folderId}' in parents and name = 'PROJECT_TEMPLATE.txt' and trashed = false`;
  const list = await gfetch(env, `${DRIVE_API_BASE}/files?q=${encodeURIComponent(q)}`);
  const existingFile = list.files?.[0];

  const metadata = { 
    name: 'PROJECT_TEMPLATE.txt', 
    parents: existingFile ? undefined : [folderId] 
  };

  const { body, contentType } = await createMultipartBody(metadata, content, 'text/plain');

  const url = existingFile 
    ? `${UPLOAD_API_BASE}/files/${existingFile.id}?uploadType=multipart` 
    : `${UPLOAD_API_BASE}/files?uploadType=multipart`;

  return await gfetch(env, url, { 
    method: existingFile ? 'PATCH' : 'POST', 
    body: body,
    headers: { 'Content-Type': contentType }
  });
};

export const createProjectStructure = async (env: any, projectName: string, parentFolderId: string) => {
  const folder = await gfetch(env, `${DRIVE_API_BASE}/files`, {
    method: 'POST',
    body: JSON.stringify({ 
      name: `[API_DOC] ${projectName}`, 
      mimeType: 'application/vnd.google-apps.folder', 
      parents: [parentFolderId || 'root'] 
    })
  });

  const sheet = await gfetch(env, `${DRIVE_API_BASE}/files`, {
    method: 'POST',
    body: JSON.stringify({ 
      name: `DB_${projectName}`, 
      mimeType: 'application/vnd.google-apps.spreadsheet', 
      parents: [folder.id] 
    })
  });

  return { folderId: folder.id, sheetId: sheet.id };
};

export const syncProjectToSheet = async (env: any, sheetId: string, project: any) => {
  if (project.cloudConfig.googleDriveFolderId) {
    await updateTemplateFile(env, project.cloudConfig.googleDriveFolderId, project.template);
  }

  const values = [
    ["--- PROJECT METADATA ---"],
    ["Project ID", project.id],
    ["Project Name", project.name],
    ["Description", project.description],
    ["Last Updated", new Date(project.updatedAt).toISOString()],
    ["Template Ref", "Stored in PROJECT_TEMPLATE.txt"],
    [],
    ["--- API DOCUMENTATION DATA ---"],
    ["ID", "Name", "Method", "Endpoint", "Description", "Auth", "Input Params (JSON)", "Output Params (JSON)"]
  ];

  project.apis.forEach((api: any) => {
    values.push([
      api.id, api.name, api.method, api.endpoint, 
      api.description, api.authType, 
      JSON.stringify(api.inputParams), 
      JSON.stringify(api.outputParams)
    ]);
  });

  return await gfetch(env, `${SHEETS_API_BASE}/${sheetId}/values/A1:H500?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    body: JSON.stringify({ values })
  });
};

export const listRemoteProjectFolders = async (env: any) => {
  const q = "mimeType='application/vnd.google-apps.folder' and name contains '[API_DOC]' and trashed = false";
  const data = await gfetch(env, `${DRIVE_API_BASE}/files?q=${encodeURIComponent(q)}&fields=files(id, name)`);
  return data.files || [];
};

export const findProjectSheetInFolder = async (env: any, folderId: string) => {
  const q = `'${folderId}' in parents and mimeType='application/vnd.google-apps.spreadsheet' and name contains 'DB_' and trashed = false`;
  const data = await gfetch(env, `${DRIVE_API_BASE}/files?q=${encodeURIComponent(q)}&fields=files(id, name)`);
  return data.files?.[0] || null;
};

export const fetchProjectFromSheet = async (env: any, sheetId: string, folderId: string) => {
  const data = await gfetch(env, `${SHEETS_API_BASE}/${sheetId}/values/A1:H500`);
  const rows = data.values || [];

  if (rows.length < 5) throw new Error("File database không đúng định dạng");

  const template = await fetchTemplateContent(env, folderId);

  const project: any = {
    id: rows[1]?.[1] || crypto.randomUUID(),
    name: rows[2]?.[1] || 'Dự án không tên',
    description: rows[3]?.[1] || '',
    updatedAt: new Date(rows[4]?.[1] || Date.now()).getTime(),
    template: template || "",
    apis: [],
    cloudConfig: { googleDriveFolderId: folderId, googleSheetId: sheetId, autoSync: true }
  };

  for (let i = 8; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 4) continue;
    project.apis.push({
      id: row[0], name: row[1], method: row[2], endpoint: row[3],
      description: row[4] || '', authType: row[5] || 'Bearer',
      inputParams: row[6] ? JSON.parse(row[6]) : [],
      outputParams: row[7] ? JSON.parse(row[7]) : [],
      requestBody: '{}', responseBody: '{}'
    });
  }
  return project;
};

export const fetchTemplateContent = async (env: any, folderId: string) => {
  const q = `'${folderId}' in parents and name = 'PROJECT_TEMPLATE.txt' and trashed = false`;
  let list;
  try {
    list = await gfetch(env, `${DRIVE_API_BASE}/files?q=${encodeURIComponent(q)}`);
  } catch (e) { return null; }
  
  const file = list.files?.[0];
  if (!file) return null;

  // Đối với download content trực tiếp, chúng ta cần gfetch với cấu trúc fetch thô hoặc thêm logic alt=media vào gfetch
  // Ở đây chúng ta tạm dùng một trick là gọi lại fetch thô với token mới nhất
  const token = currentAccessToken || env.GOOGLE_ACCESS_TOKEN;
  const res = await fetch(`${DRIVE_API_BASE}/files/${file.id}?alt=media`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (res.status === 401 && env.GOOGLE_REFRESH_TOKEN) {
    const newToken = await refreshAccessToken(env);
    const retryRes = await fetch(`${DRIVE_API_BASE}/files/${file.id}?alt=media`, {
      headers: { 'Authorization': `Bearer ${newToken}` }
    });
    return retryRes.text();
  }
  
  if (!res.ok) return null;
  return res.text();
};

export const uploadDocFile = async (env: any, folderId: string, fileName: string, content: string) => {
  const metadata = { name: `${fileName}.doc`, parents: [folderId], mimeType: 'application/msword' };
  const { body, contentType } = await createMultipartBody(metadata, content, 'application/msword');
  
  return await gfetch(env, `${UPLOAD_API_BASE}/files?uploadType=multipart`, { 
    method: 'POST', 
    body: body,
    headers: { 'Content-Type': contentType }
  });
};

export const uploadRawFile = async (env: any, folderId: string, file: File) => {
  const metadata = { name: `RAW_${file.name}`, parents: [folderId] };
  const { body, contentType } = await createMultipartBody(metadata, file, file.type || 'application/octet-stream');
  
  return await gfetch(env, `${UPLOAD_API_BASE}/files?uploadType=multipart`, { 
    method: 'POST', 
    body: body,
    headers: { 'Content-Type': contentType }
  });
};

export const uploadImageFile = async (env: any, folderId: string, file: File, apiName: string) => {
  const metadata = { name: `IMG_${apiName}_${file.name}`, parents: [folderId] };
  const { body, contentType } = await createMultipartBody(metadata, file, file.type || 'image/png');
  
  return await gfetch(env, `${UPLOAD_API_BASE}/files?uploadType=multipart`, { 
    method: 'POST', 
    body: body,
    headers: { 'Content-Type': contentType }
  });
};
