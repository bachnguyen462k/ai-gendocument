
/**
 * Service tích hợp Google Drive.
 * Trong thực tế, bạn sẽ sử dụng Google Picker API và Drive/Sheets/Docs REST API.
 */

export interface GoogleSyncResult {
  id: string;
  url: string;
  status: 'created' | 'updated';
}

// Giả lập kiểm tra và tạo file Excel (Database)
export const syncDatabaseToSheet = async (folderId: string, projectName: string, apis: any[]): Promise<GoogleSyncResult> => {
  console.log(`[Database] Đang kiểm tra Database Excel cho dự án ${projectName} tại folder ${folderId}...`);
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Logic: Nếu chưa có file "DB_[ProjectName].xlsx", hệ thống sẽ tạo mới
  // Ở đây chúng ta giả lập việc lưu thành công
  return {
    id: 'sheet_' + Math.random().toString(36).substr(2, 9),
    url: 'https://docs.google.com/spreadsheets/d/mock-db',
    status: 'updated'
  };
};

// Giả lập tạo hoặc cập nhật bản Word tài liệu API
export const saveDocToDrive = async (folderId: string, apiName: string, content: string): Promise<GoogleSyncResult> => {
  console.log(`[Docs] Đang tạo file tài liệu Word cho: ${apiName}`);
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  return {
    id: 'doc_' + Math.random().toString(36).substr(2, 9),
    url: 'https://docs.google.com/document/d/mock-doc',
    status: 'created'
  };
};

export const createProjectFolder = async (parentFolderId: string, projectName: string): Promise<string> => {
  console.log(`[Drive] Đang tạo thư mục dự án: ${projectName}`);
  await new Promise(resolve => setTimeout(resolve, 1000));
  return 'folder_' + Math.random().toString(36).substr(2, 9);
};
