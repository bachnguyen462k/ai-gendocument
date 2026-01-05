
/**
 * Mock service for Google Drive, Sheets, and Docs integration.
 * In a production app, this would use the Google API Client Library (gapi).
 */

export const uploadToDrive = async (folderId: string, fileName: string, content: string, mimeType: string) => {
  console.log(`[Drive] Uploading ${fileName} to folder ${folderId}...`);
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1500));
  return { id: Math.random().toString(36).substr(2, 9), url: `https://drive.google.com/file/d/${folderId}` };
};

export const syncToGoogleSheet = async (folderId: string, projectName: string, apis: any[]) => {
  console.log(`[Sheets] Syncing ${apis.length} APIs to Google Sheet in folder ${folderId}...`);
  await new Promise(resolve => setTimeout(resolve, 2000));
  return { id: 'mock-sheet-id', url: 'https://docs.google.com/spreadsheets/d/mock' };
};

export const exportToWordDoc = async (folderId: string, docName: string, markdownContent: string) => {
  console.log(`[Docs] Exporting markdown to Google Doc: ${docName} in folder ${folderId}...`);
  await new Promise(resolve => setTimeout(resolve, 1800));
  return { id: 'mock-doc-id', url: 'https://docs.google.com/document/d/mock' };
};
