
export interface ApiField {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

export interface ApiInfo {
  id: string;
  name: string;
  method: string;
  endpoint: string;
  description: string;
  authType: string;
  requestBody: string;
  responseBody: string;
  inputParams: ApiField[];
  outputParams: ApiField[];
  sequenceDiagram?: string; // Base64 image string
}

export interface CloudConfig {
  googleDriveFolderId: string;
  googleSheetId?: string;
  autoSync: boolean;
}

export interface GlobalConfig {
  defaultGoogleDriveFolderId: string;
  autoSaveToCloud: boolean;
  accessToken?: string; // Lưu token tạm thời cho session
}

export interface Project {
  id: string;
  name: string;
  description: string;
  template: string;
  apis: ApiInfo[];
  updatedAt: number;
  cloudConfig: CloudConfig;
}

export type AppView = 'dashboard' | 'project-detail' | 'api-edit' | 'settings';
export type AppStatus = 'idle' | 'processing' | 'completed' | 'error' | 'syncing' | 'unauthorized';
