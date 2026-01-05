
const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
const UPLOAD_API_BASE = 'https://www.googleapis.com/upload/drive/v3';
const OAUTH_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

let currentAccessToken = '';

export const refreshGoogleToken = async (clientId: string, clientSecret: string, refreshToken: string) => {
  try {
    const response = await fetch(OAUTH_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    const data = await response.json();
    if (data.access_token) {
      currentAccessToken = data.access_token;
      return data.access_token;
    }
    throw new Error(data.error_description || 'Không thể làm mới token');
  } catch (error) {
    console.error('Lỗi khi Refresh Token:', error);
    throw error;
  }
};

async function gfetch(url: string, options: any = {}, env: any) {
  const token = currentAccessToken || env.GOOGLE_ACCESS_TOKEN;
  
  if (!token && !env.GOOGLE_REFRESH_TOKEN) {
    throw new Error('MISSING_TOKEN');
  }

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
    ...options.headers,
  };

  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  try {
    let res = await fetch(url, { ...options, headers, mode: 'cors' });

    if (res.status === 401 && env.GOOGLE_REFRESH_TOKEN && env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
      const newToken = await refreshGoogleToken(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, env.GOOGLE_REFRESH_TOKEN);
      headers['Authorization'] = `Bearer ${newToken}`;
      res = await fetch(url, { ...options, headers, mode: 'cors' });
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: { message: `HTTP Error ${res.status}` } }));
      throw new Error(err.error?.message || `Lỗi ${res.status}`);
    }
    
    return res.json();
  } catch (error: any) {
    throw error;
  }
}

export const checkConnection = async (env: any) => {
  return await gfetch(`${DRIVE_API_BASE}/about?fields=user`, { method: 'GET' }, env);
};

/**
 * Liệt kê tất cả các thư mục [API_DOC] trên Drive
 */
export const listRemoteProjectFolders = async (env: any) => {
  const q = "mimeType='application/vnd.google-apps.folder' and name contains '[API_DOC]' and trashed = false";
  const data = await gfetch(`${DRIVE_API_BASE}/files?q=${encodeURIComponent(q)}&fields=files(id, name)`, { method: 'GET' }, env);
  return data.files || [];
};

/**
 * Tìm file spreadsheet "DB_" trong một thư mục cụ thể
 */
export const findProjectSheetInFolder = async (env: any, folderId: string) => {
  const q = `'${folderId}' in parents and mimeType='application/vnd.google-apps.spreadsheet' and name contains 'DB_' and trashed = false`;
  const data = await gfetch(`${DRIVE_API_BASE}/files?q=${encodeURIComponent(q)}&fields=files(id, name)`, { method: 'GET' }, env);
  return data.files?.[0] || null;
};

/**
 * Đọc dữ liệu từ Spreadsheet và chuyển đổi thành đối tượng Project
 */
export const fetchProjectFromSheet = async (env: any, sheetId: string, folderId: string) => {
  const url = `${SHEETS_API_BASE}/${sheetId}/values/A1:H500`;
  const data = await gfetch(url, { method: 'GET' }, env);
  const rows = data.values || [];

  if (rows.length < 5) throw new Error("File database không đúng định dạng");

  const project: any = {
    id: rows[1]?.[1] || crypto.randomUUID(),
    name: rows[2]?.[1] || 'Dự án không tên',
    description: rows[3]?.[1] || '',
    updatedAt: new Date(rows[4]?.[1] || Date.now()).getTime(),
    template: rows[5]?.[1] || '', // Đọc template từ hàng 6
    apis: [],
    cloudConfig: {
      googleDriveFolderId: folderId,
      googleSheetId: sheetId,
      autoSync: true
    }
  };

  // Parsing APIs từ dòng 9 trở đi
  for (let i = 8; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 4) continue;
    
    project.apis.push({
      id: row[0],
      name: row[1],
      method: row[2],
      endpoint: row[3],
      description: row[4] || '',
      authType: row[5] || 'Bearer',
      inputParams: row[6] ? JSON.parse(row[6]) : [],
      outputParams: row[7] ? JSON.parse(row[7]) : [],
      requestBody: '{}',
      responseBody: '{}'
    });
  }

  return project;
};

export const createProjectStructure = async (env: any, projectName: string, parentFolderId: string = 'root') => {
  const folder = await gfetch(`${DRIVE_API_BASE}/files`, {
    method: 'POST',
    body: JSON.stringify({
      name: `[API_DOC] ${projectName}`,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentFolderId || 'root']
    })
  }, env);

  const sheet = await gfetch(`${DRIVE_API_BASE}/files`, {
    method: 'POST',
    body: JSON.stringify({
      name: `DB_${projectName}`,
      mimeType: 'application/vnd.google-apps.spreadsheet',
      parents: [folder.id]
    })
  }, env);

  return { folderId: folder.id, sheetId: sheet.id };
};

export const syncProjectToSheet = async (env: any, sheetId: string, project: any) => {
  const values = [
    ["--- PROJECT METADATA ---"],
    ["Project ID", project.id],
    ["Project Name", project.name],
    ["Description", project.description],
    ["Last Updated", new Date(project.updatedAt).toISOString()],
    ["Template Content", project.template], // Lưu template vào hàng 6
    [],
    ["--- API DOCUMENTATION DATA ---"],
    ["ID", "Name", "Method", "Endpoint", "Description", "Auth", "Input Params (JSON)", "Output Params (JSON)"]
  ];

  project.apis.forEach((api: any) => {
    values.push([
      api.id,
      api.name,
      api.method,
      api.endpoint,
      api.description,
      api.authType,
      JSON.stringify(api.inputParams),
      JSON.stringify(api.outputParams)
    ]);
  });

  const url = `${SHEETS_API_BASE}/${sheetId}/values/A1:H500?valueInputOption=USER_ENTERED`;
  
  return await gfetch(url, {
    method: 'PUT',
    body: JSON.stringify({ values })
  }, env);
};

export const uploadDocFile = async (env: any, folderId: string, fileName: string, htmlContent: string) => {
  const metadata = {
    name: `${fileName}.doc`,
    parents: [folderId],
    mimeType: 'application/msword'
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', new Blob(['\ufeff', htmlContent], { type: 'text/html' }));

  return await gfetch(`${UPLOAD_API_BASE}/files?uploadType=multipart`, {
    method: 'POST',
    body: form
  }, env);
};

export const uploadRawFile = async (env: any, folderId: string, file: File) => {
  const metadata = {
    name: `TEMPLATE_${file.name}`,
    parents: [folderId],
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', file);

  return await gfetch(`${UPLOAD_API_BASE}/files?uploadType=multipart`, {
    method: 'POST',
    body: form
  }, env);
};

export const uploadImageFile = async (env: any, folderId: string, file: File, apiName: string) => {
  const cleanApiName = apiName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const metadata = {
    name: `SD_${cleanApiName}_${file.name}`,
    parents: [folderId],
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', file);

  return await gfetch(`${UPLOAD_API_BASE}/files?uploadType=multipart`, {
    method: 'POST',
    body: form
  }, env);
};
