
const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
const UPLOAD_API_BASE = 'https://www.googleapis.com/upload/drive/v3';

async function gfetch(url: string, options: any = {}, token: string) {
  if (!token) {
    throw new Error('MISSING_TOKEN');
  }

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
    ...options.headers,
  };

  // Chỉ thêm Content-Type nếu có body và không phải FormData
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, {
    ...options,
    headers,
    mode: 'cors', // Đảm bảo luôn sử dụng chế độ CORS
  });

  if (res.status === 401) {
    throw new Error('UNAUTHORIZED');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: 'Unknown Google API Error' } }));
    throw new Error(err.error?.message || `Error ${res.status}: ${res.statusText}`);
  }
  
  return res.json();
}

export const checkConnection = async (token: string) => {
  return await gfetch(`${DRIVE_API_BASE}/about?fields=user`, { method: 'GET' }, token);
};

export const createProjectStructure = async (token: string, projectName: string, parentFolderId: string = 'root') => {
  // 1. Tạo Folder - Sử dụng Drive API
  const folder = await gfetch(`${DRIVE_API_BASE}/files`, {
    method: 'POST',
    body: JSON.stringify({
      name: `[API_DOC] ${projectName}`,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentFolderId || 'root']
    })
  }, token);

  // 2. Tạo Google Sheet - Sử dụng Drive API để tạo file với mimeType Spreadsheet
  const sheet = await gfetch(`${DRIVE_API_BASE}/files`, {
    method: 'POST',
    body: JSON.stringify({
      name: `DB_${projectName}`,
      mimeType: 'application/vnd.google-apps.spreadsheet',
      parents: [folder.id]
    })
  }, token);

  return { folderId: folder.id, sheetId: sheet.id };
};

export const syncProjectToSheet = async (token: string, sheetId: string, project: any) => {
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

  // Sử dụng Sheets API endpoint chuẩn
  const url = `${SHEETS_API_BASE}/${sheetId}/values/A1:H500?valueInputOption=USER_ENTERED`;
  
  await gfetch(url, {
    method: 'PUT',
    body: JSON.stringify({ values })
  }, token);
};

export const uploadDocFile = async (token: string, folderId: string, fileName: string, htmlContent: string) => {
  const metadata = {
    name: `${fileName}.doc`,
    parents: [folderId],
    mimeType: 'application/msword'
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', new Blob(['\ufeff', htmlContent], { type: 'text/html' }));

  // Multipart upload yêu cầu xử lý header đặc biệt (không set Content-Type để browser tự set boundary)
  const res = await fetch(`${UPLOAD_API_BASE}/files?uploadType=multipart`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: form,
    mode: 'cors'
  });

  if (res.status === 401) throw new Error('UNAUTHORIZED');
  if (!res.ok) throw new Error('Upload failed');
  
  return res.json();
};
