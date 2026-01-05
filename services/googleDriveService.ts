
const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
const UPLOAD_API_BASE = 'https://www.googleapis.com/upload/drive/v3';
const OAUTH_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

// Biến cục bộ để lưu token trong phiên làm việc
let currentAccessToken = '';

/**
 * Lấy Access Token mới bằng Refresh Token
 */
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

/**
 * Hàm fetch trung tâm xử lý Authorization và Tự động Retry khi token hết hạn
 */
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

    // Nếu lỗi 401 và có Refresh Token, thử làm mới và gọi lại 1 lần nữa
    if (res.status === 401 && env.GOOGLE_REFRESH_TOKEN && env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
      console.log('Token hết hạn, đang tự động làm mới...');
      const newToken = await refreshGoogleToken(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, env.GOOGLE_REFRESH_TOKEN);
      
      // Gọi lại chính request đó với token mới
      headers['Authorization'] = `Bearer ${newToken}`;
      res = await fetch(url, { ...options, headers, mode: 'cors' });
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: { message: `HTTP Error ${res.status}` } }));
      throw new Error(err.error?.message || `Lỗi ${res.status}`);
    }
    
    return res.json();
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED' || error.message === 'MISSING_TOKEN') throw error;
    throw error;
  }
}

export const checkConnection = async (env: any) => {
  return await gfetch(`${DRIVE_API_BASE}/about?fields=user`, { method: 'GET' }, env);
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
