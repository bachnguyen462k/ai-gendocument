
const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
const UPLOAD_API_BASE = 'https://www.googleapis.com/upload/drive/v3';

let currentAccessToken = '';

// Helper để lấy token (Access hoặc Refresh)
async function getValidToken(env: any) {
  if (currentAccessToken) return currentAccessToken;
  return env.GOOGLE_ACCESS_TOKEN;
}

async function gfetch(env: any, url: string, options: any = {}) {
  const token = await getValidToken(env);
  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Google API Error: ${res.status}`);
  }
  return res.json();
}

/**
 * Lưu nội dung Template vào file text riêng biệt trên Drive
 */
export const updateTemplateFile = async (env: any, folderId: string, content: string) => {
  // 1. Kiểm tra file cũ
  const q = `'${folderId}' in parents and name = 'PROJECT_TEMPLATE.txt' and trashed = false`;
  const list = await gfetch(env, `${DRIVE_API_BASE}/files?q=${encodeURIComponent(q)}`);
  const existingFile = list.files?.[0];

  const metadata = { 
    name: 'PROJECT_TEMPLATE.txt', 
    parents: existingFile ? undefined : [folderId] 
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', new Blob([content], { type: 'text/plain' }));

  const url = existingFile 
    ? `${UPLOAD_API_BASE}/files/${existingFile.id}?uploadType=multipart` 
    : `${UPLOAD_API_BASE}/files?uploadType=multipart`;

  return await gfetch(env, url, { 
    method: existingFile ? 'PATCH' : 'POST', 
    body: form,
    headers: { 'Content-Type': undefined } // Để fetch tự set boundary
  });
};

/**
 * Đọc nội dung Template từ file text trên Drive
 */
export const fetchTemplateContent = async (env: any, folderId: string) => {
  const q = `'${folderId}' in parents and name = 'PROJECT_TEMPLATE.txt' and trashed = false`;
  const list = await gfetch(env, `${DRIVE_API_BASE}/files?q=${encodeURIComponent(q)}`);
  const file = list.files?.[0];
  if (!file) return null;

  const token = await getValidToken(env);
  const res = await fetch(`${DRIVE_API_BASE}/files/${file.id}?alt=media`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) return null;
  return res.text();
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
  // Đồng thời lưu template vào file riêng để tránh giới hạn 50k ký tự của Sheet
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

  // Ưu tiên đọc template từ file text
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

export const uploadDocFile = async (env: any, folderId: string, fileName: string, content: string) => {
  const metadata = { name: `${fileName}.doc`, parents: [folderId], mimeType: 'application/msword' };
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', new Blob(['\ufeff', content], { type: 'text/html' }));
  return await gfetch(env, `${UPLOAD_API_BASE}/files?uploadType=multipart`, { 
    method: 'POST', 
    body: form,
    headers: { 'Content-Type': undefined }
  });
};

export const uploadRawFile = async (env: any, folderId: string, file: File) => {
  const metadata = { name: `RAW_${file.name}`, parents: [folderId] };
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', file);
  return await gfetch(env, `${UPLOAD_API_BASE}/files?uploadType=multipart`, { 
    method: 'POST', 
    body: form,
    headers: { 'Content-Type': undefined }
  });
};

export const uploadImageFile = async (env: any, folderId: string, file: File, apiName: string) => {
  const metadata = { name: `IMG_${apiName}_${file.name}`, parents: [folderId] };
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', file);
  return await gfetch(env, `${UPLOAD_API_BASE}/files?uploadType=multipart`, { 
    method: 'POST', 
    body: form,
    headers: { 'Content-Type': undefined }
  });
};
