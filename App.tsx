
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  FileText, Send, Loader2, Info, BookOpen, Layers, 
  UploadCloud, Plus, ChevronLeft, Trash2, Edit3, 
  Settings as SettingsIcon, Share2, Table, Cloud, CheckCircle, Database,
  ArrowLeft, HardDrive, ShieldCheck, Zap, RefreshCw, List,
  Upload, File, Save, ExternalLink, AlertCircle, FilePlus,
  ArrowRightLeft, Code2, ClipboardList, Image as ImageIcon,
  LogIn, Globe, Key, FolderOpen, LogOut, HelpCircle, ShieldAlert
} from 'lucide-react';
import { generateApiDoc } from './services/geminiService';
import { 
  createProjectStructure, 
  syncProjectToSheet, 
  uploadDocFile,
  checkConnection
} from './services/googleDriveService';
import { extractDocumentText } from './services/documentService';
import { Project, ApiInfo, AppView, AppStatus, CloudConfig, GlobalConfig, ApiField } from './types';
import { DEFAULT_TEMPLATE, METHODS } from './constants';
import MarkdownPreview from './components/MarkdownPreview';
import JsonEditorModal from './components/JsonEditorModal';

const STORAGE_KEY = 'api_doc_architect_data';
const CONFIG_KEY = 'api_doc_architect_config';

const App: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  
  // Khởi tạo globalConfig với kiểm tra an toàn cho môi trường trình duyệt
  const [globalConfig, setGlobalConfig] = useState<GlobalConfig>(() => {
    const savedConfig = localStorage.getItem(CONFIG_KEY);
    let config: GlobalConfig = {
      defaultGoogleDriveFolderId: 'root',
      autoSaveToCloud: true,
      accessToken: ''
    };

    if (savedConfig) {
      try {
        config = { ...config, ...JSON.parse(savedConfig) };
      } catch (e) {
        console.error("Error parsing config from localStorage", e);
      }
    }

    // Kiểm tra an toàn biến process một cách tuyệt đối
    // Tránh việc truy cập trực tiếp process.env nếu process không tồn tại
    const isProcessAvailable = typeof process !== 'undefined' && process !== null;
    
    if (isProcessAvailable) {
      try {
        // @ts-ignore
        const envToken = process.env?.GOOGLE_ACCESS_TOKEN;
        // @ts-ignore
        const envFolderId = process.env?.GOOGLE_DRIVE_FOLDER_ID;
        
        if (envToken) config.accessToken = envToken;
        if (envFolderId) config.defaultGoogleDriveFolderId = envFolderId;
      } catch (e) {
        console.warn("Không thể đọc được biến môi trường, tiếp tục với cấu hình mặc định.");
      }
    }

    return config;
  });

  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [currentApiId, setCurrentApiId] = useState<string | null>(null);
  const [view, setView] = useState<AppView>('dashboard');
  const [status, setStatus] = useState<AppStatus>('idle');
  const [result, setResult] = useState<string>('');
  const [error, setError] = useState<{message: string, isAuth: boolean, isCors?: boolean} | null>(null);
  const [showSyncSuccess, setShowSyncSuccess] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [apiEditTab, setApiEditTab] = useState<'request' | 'response' | 'diagram'>('request');
  
  const [isJsonModalOpen, setIsJsonModalOpen] = useState(false);
  const [jsonModalType, setJsonModalType] = useState<'request' | 'response'>('request');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const diagramInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try { setProjects(JSON.parse(saved)); } catch (e) { console.error(e); }
    }
  }, []);

  const saveConfig = (newConfig: GlobalConfig) => {
    setGlobalConfig(newConfig);
    localStorage.setItem(CONFIG_KEY, JSON.stringify(newConfig));
  };

  const currentProject = useMemo(() => projects.find(p => p.id === currentProjectId), [projects, currentProjectId]);
  const currentApi = useMemo(() => currentProject?.apis.find(a => a.id === currentApiId), [currentProject, currentApiId]);

  const handleError = (err: any) => {
    console.error("App Error:", err);
    const msg = err.message || "";
    
    if (msg === 'UNAUTHORIZED' || msg === 'MISSING_TOKEN') {
      setError({ message: "Phiên đăng nhập Google đã hết hạn hoặc thiếu Token. Vui lòng kiểm tra lại file .env hoặc cài đặt Cloud.", isAuth: true });
    } else if (msg.includes('Failed to fetch') || msg.includes('CORS')) {
      setError({ 
        message: "Lỗi kết nối (CORS). Hãy đảm bảo domain này được cấu hình trong Authorized Origins tại Google Cloud Console.", 
        isAuth: false,
        isCors: true 
      });
    } else {
      setError({ message: msg, isAuth: false });
    }
    setStatus('error');
  };

  const updateProjectAndCloud = async (updates: Partial<Project>, projectId: string) => {
    const updatedProjects = projects.map(p => {
      if (p.id === projectId) {
        const updated = { ...p, ...updates, updatedAt: Date.now() };
        if (globalConfig.accessToken && updated.cloudConfig.googleSheetId) {
          syncProjectToSheet(globalConfig.accessToken, updated.cloudConfig.googleSheetId, updated)
            .catch(handleError);
        }
        return updated;
      }
      return p;
    });
    setProjects(updatedProjects);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedProjects));
  };

  const createProject = async () => {
    if (!globalConfig.accessToken) {
      setError({ message: "Vui lòng cấu hình Google Access Token trước khi tạo dự án.", isAuth: true });
      setView('settings');
      return;
    }

    setStatus('syncing');
    try {
      const projectName = `Dự án ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`;
      const { folderId, sheetId } = await createProjectStructure(
        globalConfig.accessToken, 
        projectName, 
        globalConfig.defaultGoogleDriveFolderId
      );

      const newProj: Project = {
        id: crypto.randomUUID(),
        name: projectName,
        description: 'Tài liệu API lưu trữ trên Google Sheets',
        template: DEFAULT_TEMPLATE,
        apis: [],
        updatedAt: Date.now(),
        cloudConfig: { 
          googleDriveFolderId: folderId, 
          googleSheetId: sheetId,
          autoSync: true 
        }
      };

      await syncProjectToSheet(globalConfig.accessToken, sheetId, newProj);
      setProjects([newProj, ...projects]);
      setCurrentProjectId(newProj.id);
      setView('project-detail');
      setStatus('idle');
    } catch (err: any) {
      handleError(err);
    }
  };

  const handleGenerateFullDoc = async () => {
    if (!currentProject || currentProject.apis.length === 0) return;
    setStatus('processing');
    try {
      const doc = await generateApiDoc(currentProject.apis, currentProject.template);
      setResult(doc);
      setStatus('completed');

      if (globalConfig.accessToken && currentProject.cloudConfig.googleDriveFolderId) {
        await uploadDocFile(
          globalConfig.accessToken,
          currentProject.cloudConfig.googleDriveFolderId,
          `Doc_${currentProject.name}_${Date.now()}`,
          doc
        );
        setShowSyncSuccess(true);
        setTimeout(() => setShowSyncSuccess(false), 3000);
      }
    } catch (err: any) {
      handleError(err);
    }
  };

  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const handleTestConnection = async () => {
    setTestStatus('loading');
    try {
      await checkConnection(globalConfig.accessToken || '');
      setTestStatus('success');
      setTimeout(() => setTestStatus('idle'), 3000);
    } catch (e) {
      setTestStatus('error');
      setTimeout(() => setTestStatus('idle'), 3000);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <header className="bg-white/80 backdrop-blur-xl border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-18 flex items-center justify-between py-4">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setView('dashboard')}>
            <div className="bg-blue-600 p-2.5 rounded-2xl text-white shadow-lg"><Zap size={22} /></div>
            <h1 className="text-xl font-black tracking-tighter uppercase">API Doc <span className="text-blue-600">Architect</span></h1>
          </div>
          <div className="flex items-center gap-3">
             {globalConfig.accessToken ? (
               <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100 animate-pulse">
                  <Globe size={16} /> <span className="text-[10px] font-black uppercase tracking-tight">Cloud Online</span>
               </div>
             ) : (
               <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-400 rounded-xl border border-slate-200">
                  <Globe size={16} /> <span className="text-[10px] font-black uppercase tracking-tight">Cloud Offline</span>
               </div>
             )}
             <button onClick={() => setView('settings')} className={`p-2.5 rounded-xl transition-all ${view === 'settings' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'text-gray-400 hover:bg-gray-100'}`}>
               <SettingsIcon size={22} />
             </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10 min-h-[calc(100vh-72px)]">
        {view === 'dashboard' && (
          <div className="space-y-8">
            <div className="flex justify-between items-end">
              <div>
                <h2 className="text-4xl font-black text-gray-900 tracking-tighter">My Projects</h2>
                <p className="text-slate-400 font-bold text-xs mt-1 uppercase tracking-widest">Excel-Powered API Documentation</p>
              </div>
              <button onClick={createProject} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-3xl font-black shadow-xl flex items-center gap-3 transition-all active:scale-95 disabled:opacity-50" disabled={status === 'syncing'}>
                {status === 'syncing' ? <Loader2 size={24} className="animate-spin" /> : <Plus size={24} />} New Project
              </button>
            </div>
            {projects.length === 0 ? (
              <div className="bg-white rounded-[3rem] p-20 border-4 border-dashed border-slate-100 flex flex-col items-center justify-center text-center">
                <Database size={64} className="text-slate-100 mb-6" />
                <h3 className="text-2xl font-black text-slate-300">Chưa có dự án nào</h3>
                <p className="text-slate-400 mt-2">Dữ liệu dự án sẽ được lưu trữ trực tiếp trên file Excel trong Google Drive của bạn.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {projects.map(p => (
                  <div key={p.id} onClick={() => { setCurrentProjectId(p.id); setView('project-detail'); }} className="group bg-white p-8 rounded-[2.5rem] border border-gray-200 shadow-sm hover:shadow-xl cursor-pointer transition-all relative">
                    <div className="bg-blue-50 p-4 rounded-3xl text-blue-600 w-fit mb-6 group-hover:bg-blue-600 group-hover:text-white transition-all"><Database size={24} /></div>
                    <h3 className="text-xl font-black text-gray-900 mb-2 truncate">{p.name}</h3>
                    <div className="flex items-center gap-2 text-emerald-500 text-[10px] font-black uppercase">
                      <Table size={12} /> Spreadsheet Active
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {view === 'settings' && (
          <div className="max-w-2xl mx-auto space-y-8 animate-in slide-in-from-bottom-4 duration-300 pb-20">
            <div className="flex items-center gap-4 mb-8">
              <button onClick={() => setView('dashboard')} className="p-2 hover:bg-white rounded-full"><ChevronLeft size={24} /></button>
              <h2 className="text-3xl font-black tracking-tighter">Cloud Connection</h2>
            </div>

            <section className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 space-y-10">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest">
                    <Key size={14} /> Google Access Token
                  </label>
                  <a href="https://developers.google.com/oauthplayground/" target="_blank" className="text-[10px] font-black text-blue-600 flex items-center gap-1 hover:underline">
                    LẤY TOKEN MỚI <ExternalLink size={10} />
                  </a>
                </div>
                <div className="relative">
                  <textarea 
                    className="w-full bg-slate-50 p-4 rounded-2xl border border-slate-100 outline-none focus:ring-4 ring-blue-500/10 font-mono text-sm h-24 resize-none"
                    value={globalConfig.accessToken}
                    onChange={(e) => {
                      saveConfig({ ...globalConfig, accessToken: e.target.value });
                      if(error?.isAuth) setError(null);
                    }}
                    placeholder="Dán mã Access Token từ OAuth Playground (ya29...)"
                  />
                  {globalConfig.accessToken && testStatus !== 'error' && <CheckCircle size={20} className="absolute right-4 bottom-4 text-emerald-500" />}
                  {testStatus === 'error' && <AlertCircle size={20} className="absolute right-4 bottom-4 text-red-500" />}
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-[10px] text-slate-400 font-bold leading-relaxed px-1">
                    Token này được ứng dụng lấy tự động từ file .env nếu bạn đã cấu hình GOOGLE_ACCESS_TOKEN.
                  </p>
                  <button 
                    onClick={handleTestConnection}
                    disabled={testStatus === 'loading'}
                    className={`text-[10px] font-black px-4 py-2 rounded-xl border transition-all flex items-center gap-2 ${
                      testStatus === 'loading' ? 'bg-slate-50 text-slate-400' :
                      testStatus === 'success' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                      testStatus === 'error' ? 'bg-red-50 text-red-600 border-red-100' :
                      'bg-white text-blue-600 border-blue-100 hover:bg-blue-50'
                    }`}
                  >
                    {testStatus === 'loading' ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                    {testStatus === 'success' ? 'KẾT NỐI TỐT' : testStatus === 'error' ? 'TOKEN HẾT HẠN' : 'KIỂM TRA KẾT NỐI'}
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <label className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest">
                  <FolderOpen size={14} /> Google Drive Folder ID
                </label>
                <input 
                  className="w-full bg-slate-50 p-4 rounded-2xl border border-slate-100 outline-none focus:ring-4 ring-blue-500/10 font-mono text-sm"
                  value={globalConfig.defaultGoogleDriveFolderId}
                  onChange={(e) => saveConfig({ ...globalConfig, defaultGoogleDriveFolderId: e.target.value })}
                  placeholder="ID thư mục (Mặc định: 'root')"
                />
              </div>

              <div className="pt-6 border-t border-slate-50">
                <div className="flex items-center gap-4 p-6 bg-slate-900 rounded-3xl border border-slate-800 shadow-xl">
                  <div className="bg-blue-600 p-3 rounded-2xl text-white shadow-lg"><ShieldCheck size={24} /></div>
                  <div>
                    <h4 className="text-sm font-black text-white">Gemini AI Engine</h4>
                    <p className="text-[10px] text-blue-400 font-bold uppercase mt-0.5 tracking-widest">Sử dụng API_KEY từ biến môi trường</p>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => {
                  if(confirm("Xóa toàn bộ dữ liệu dự án trên trình duyệt?")) {
                    localStorage.clear();
                    window.location.reload();
                  }
                }}
                className="w-full py-4 rounded-2xl text-xs font-black text-red-500 hover:bg-red-50 transition-all flex items-center justify-center gap-2"
              >
                <LogOut size={16} /> RESET APPLICATION
              </button>
            </section>
          </div>
        )}

        {view === 'project-detail' && currentProject && (
          <div className="space-y-6 animate-in fade-in duration-300">
             <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button onClick={() => setView('dashboard')} className="p-2 hover:bg-white rounded-full text-gray-400"><ChevronLeft size={24} /></button>
                <h2 className="text-2xl font-black">{currentProject.name}</h2>
              </div>
              <div className="flex gap-3">
                <button onClick={handleGenerateFullDoc} disabled={status === 'processing'} className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-black text-sm flex items-center gap-2 shadow-xl shadow-slate-200">
                  {status === 'processing' ? <Loader2 size={16} className="animate-spin" /> : <FilePlus size={16} />} GENERATE & SAVE TO CLOUD
                </button>
                <button onClick={() => {
                  const newApi: ApiInfo = { id: crypto.randomUUID(), name: 'API mới', description: '', method: 'GET', endpoint: '/api/v1/', authType: 'Bearer', requestBody: '{}', responseBody: '{}', inputParams: [], outputParams: [] };
                  const newApis = [...currentProject.apis, newApi];
                  updateProjectAndCloud({ apis: newApis }, currentProject.id);
                  setCurrentApiId(newApi.id); setView('api-edit');
                }} className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-black text-sm flex items-center gap-2 shadow-xl shadow-blue-200"><Plus size={16} /> Add API</button>
              </div>
            </div>

            {showSyncSuccess && (
              <div className="bg-emerald-500 text-white p-4 rounded-2xl font-black text-center animate-bounce shadow-xl">
                 SUCCESS: DOCUMENT SAVED TO GOOGLE DRIVE
              </div>
            )}

            <div className="grid grid-cols-12 gap-8">
              <div className="col-span-8">
                {status === 'completed' ? <MarkdownPreview content={result} /> : (
                  <div className="bg-white rounded-[3rem] border border-slate-100 overflow-hidden shadow-sm">
                    <div className="px-8 py-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
                       <span className="font-black uppercase text-[10px] text-slate-400 tracking-widest flex items-center gap-2"><Table size={14} /> Cloud Database Sheet</span>
                       <span className="text-[10px] font-bold text-emerald-500 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">Live Sync</span>
                    </div>
                    {currentProject.apis.length === 0 ? (
                      <div className="p-20 text-center flex flex-col items-center">
                        <Code2 size={48} className="text-slate-100 mb-4" />
                        <p className="text-slate-400 font-bold text-xs uppercase">No APIs added yet</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-50">
                        {currentProject.apis.map(api => (
                          <div key={api.id} onClick={() => { setCurrentApiId(api.id); setView('api-edit'); }} className="px-10 py-7 hover:bg-blue-50/50 cursor-pointer transition-all flex items-center gap-6 group">
                            <div className={`px-4 py-1.5 rounded-xl font-black text-[10px] shadow-sm ${
                              api.method === 'GET' ? 'bg-emerald-100 text-emerald-700' :
                              api.method === 'POST' ? 'bg-blue-100 text-blue-700' :
                              'bg-slate-100 text-slate-700'
                            }`}>{api.method}</div>
                            <div className="flex-1">
                               <h4 className="font-black text-slate-900">{api.name}</h4>
                               <p className="text-xs text-slate-400 font-mono mt-1">{api.endpoint}</p>
                            </div>
                            <ChevronLeft size={20} className="rotate-180 text-slate-200 group-hover:text-blue-600 transition-all" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="col-span-4 space-y-6">
                <div className="bg-slate-900 p-8 rounded-[3rem] text-white shadow-2xl shadow-slate-300">
                  <h3 className="text-[10px] font-black uppercase text-blue-400 mb-6 tracking-widest">Project Template</h3>
                  <button onClick={() => fileInputRef.current?.click()} className="w-full py-4 bg-blue-600 hover:bg-blue-700 rounded-2xl font-black text-xs flex items-center justify-center gap-2 mb-6 transition-all shadow-lg shadow-blue-500/20 active:scale-95">
                    <UploadCloud size={18} /> Update Template
                  </button>
                  <div className="bg-white/5 p-6 rounded-2xl border border-white/10">
                    <p className="text-[10px] font-mono opacity-40 leading-relaxed line-clamp-[10]">{currentProject.template}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {view === 'api-edit' && currentApi && (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm flex items-center justify-between border border-slate-100">
              <div className="flex items-center gap-4">
                <button onClick={() => setView('project-detail')} className="p-2 hover:bg-slate-50 rounded-full"><ChevronLeft size={24} /></button>
                <div className="space-y-1">
                  <input className="text-2xl font-black outline-none bg-transparent block w-full" value={currentApi.name} onChange={e => {
                    const newApis = currentProject!.apis.map(a => a.id === currentApi.id ? { ...a, name: e.target.value } : a);
                    updateProjectAndCloud({ apis: newApis }, currentProject!.id);
                  }} />
                  <div className="flex items-center gap-2">
                    <select 
                      className="bg-slate-100 px-2 py-1 rounded text-[10px] font-black"
                      value={currentApi.method}
                      onChange={e => {
                        const newApis = currentProject!.apis.map(a => a.id === currentApi.id ? { ...a, method: e.target.value } : a);
                        updateProjectAndCloud({ apis: newApis }, currentProject!.id);
                      }}
                    >
                      {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <input className="text-xs font-mono text-slate-400 bg-transparent outline-none flex-1" value={currentApi.endpoint} onChange={e => {
                      const newApis = currentProject!.apis.map(a => a.id === currentApi.id ? { ...a, endpoint: e.target.value } : a);
                      updateProjectAndCloud({ apis: newApis }, currentProject!.id);
                    }} />
                  </div>
                </div>
              </div>
              <button onClick={() => setView('project-detail')} className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-black text-xs shadow-xl active:scale-95 transition-all">SAVE & EXIT</button>
            </div>

            <div className="flex gap-2 p-1.5 bg-slate-200/50 backdrop-blur-md rounded-2xl w-fit">
              <button onClick={() => setApiEditTab('request')} className={`px-8 py-3 rounded-xl text-[10px] font-black transition-all ${apiEditTab === 'request' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>REQUEST STRUCTURE</button>
              <button onClick={() => setApiEditTab('response')} className={`px-8 py-3 rounded-xl text-[10px] font-black transition-all ${apiEditTab === 'response' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>RESPONSE STRUCTURE</button>
              <button onClick={() => setApiEditTab('diagram')} className={`px-8 py-3 rounded-xl text-[10px] font-black transition-all ${apiEditTab === 'diagram' ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>SEQUENCE DIAGRAM</button>
            </div>

            <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 min-h-[600px]">
              {apiEditTab === 'request' && (
                <div className="space-y-8 animate-in fade-in duration-300">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-black text-slate-900 text-lg">Input Parameters</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Automatic detection from JSON payload</p>
                    </div>
                    <button onClick={() => { setJsonModalType('request'); setIsJsonModalOpen(true); }} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl text-xs font-black shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2">
                       <Code2 size={16} /> PASTE JSON REQUEST
                    </button>
                  </div>
                  <div className="overflow-hidden rounded-3xl border border-slate-50">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50/50 text-slate-400 font-black uppercase text-[10px] tracking-widest border-b border-slate-50">
                        <tr><th className="p-6 text-left">Field Key</th><th className="p-6 text-left">Data Type</th><th className="p-6 text-left">Detailed Description</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {currentApi.inputParams.map((p, i) => (
                          <tr key={i} className="hover:bg-slate-50/30 transition-all">
                            <td className="p-6 font-mono text-blue-600 text-xs font-bold">{p.name}</td>
                            <td className="p-6"><span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-lg text-[10px] font-black uppercase">{p.type}</span></td>
                            <td className="p-6">
                              <input 
                                className="w-full bg-slate-50/50 p-3 rounded-xl border border-transparent focus:border-blue-100 outline-none transition-all text-xs font-bold" 
                                value={p.description} 
                                onChange={e => {
                                  const params = [...currentApi.inputParams];
                                  params[i].description = e.target.value;
                                  const newApis = currentProject!.apis.map(a => a.id === currentApi.id ? { ...a, inputParams: params } : a);
                                  updateProjectAndCloud({ apis: newApis }, currentProject!.id);
                                }} 
                                placeholder="What does this field represent?" 
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {apiEditTab === 'response' && (
                <div className="space-y-8 animate-in fade-in duration-300">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-black text-slate-900 text-lg">Output Schema</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Documenting the response body</p>
                    </div>
                    <button onClick={() => { setJsonModalType('response'); setIsJsonModalOpen(true); }} className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-2xl text-xs font-black shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2">
                       <Code2 size={16} /> PASTE JSON RESPONSE
                    </button>
                  </div>
                  <div className="overflow-hidden rounded-3xl border border-slate-50">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50/50 text-slate-400 font-black uppercase text-[10px] tracking-widest border-b border-slate-50">
                        <tr><th className="p-6 text-left">Field Key</th><th className="p-6 text-left">Data Type</th><th className="p-6 text-left">Success Meaning</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {currentApi.outputParams.map((p, i) => (
                          <tr key={i} className="hover:bg-slate-50/30 transition-all">
                            <td className="p-6 font-mono text-emerald-600 text-xs font-bold">{p.name}</td>
                            <td className="p-6"><span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-lg text-[10px] font-black uppercase">{p.type}</span></td>
                            <td className="p-6">
                              <input 
                                className="w-full bg-slate-50/50 p-3 rounded-xl border border-transparent focus:border-emerald-100 outline-none transition-all text-xs font-bold" 
                                value={p.description} 
                                onChange={e => {
                                  const params = [...currentApi.outputParams];
                                  params[i].description = e.target.value;
                                  const newApis = currentProject!.apis.map(a => a.id === currentApi.id ? { ...a, outputParams: params } : a);
                                  updateProjectAndCloud({ apis: newApis }, currentProject!.id);
                                }} 
                                placeholder="Explain this response field..." 
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {apiEditTab === 'diagram' && (
                <div className="flex flex-col items-center justify-center h-full space-y-8 animate-in zoom-in-95 duration-300">
                  {currentApi.sequenceDiagram ? (
                    <div className="relative group">
                      <div className="bg-white p-4 rounded-[2rem] shadow-2xl border border-slate-100">
                        <img src={currentApi.sequenceDiagram} className="max-w-full max-h-[500px] rounded-xl" />
                      </div>
                      <button onClick={() => {
                        const newApis = currentProject!.apis.map(a => a.id === currentApi.id ? { ...a, sequenceDiagram: undefined } : a);
                        updateProjectAndCloud({ apis: newApis }, currentProject!.id);
                      }} className="absolute -top-4 -right-4 bg-red-600 text-white p-4 rounded-2xl shadow-xl opacity-0 group-hover:opacity-100 transition-all transform hover:scale-110"><Trash2 size={24} /></button>
                    </div>
                  ) : (
                    <div onClick={() => diagramInputRef.current?.click()} className="border-4 border-dashed border-slate-100 rounded-[4rem] p-32 flex flex-col items-center cursor-pointer hover:bg-slate-50 hover:border-blue-200 transition-all group">
                      <div className="bg-slate-50 p-8 rounded-[2rem] text-slate-200 group-hover:bg-blue-50 group-hover:text-blue-200 transition-all mb-6">
                        <ImageIcon size={64} />
                      </div>
                      <p className="font-black text-slate-300 group-hover:text-blue-300 tracking-tighter text-xl">UPLOAD SEQUENCE DIAGRAM</p>
                      <p className="text-slate-300 font-bold text-xs uppercase mt-2">Supports PNG, JPG, SVG</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Modals & Hidden Inputs */}
      <JsonEditorModal 
        isOpen={isJsonModalOpen} 
        onClose={() => setIsJsonModalOpen(false)} 
        initialValue={jsonModalType === 'request' ? currentApi?.requestBody || '{}' : currentApi?.responseBody || '{}'} 
        title={jsonModalType === 'request' ? 'Request Payload' : 'Response Body'} 
        onSave={val => {
          if (!currentApi) return;
          try {
            const obj = JSON.parse(val);
            const fields: ApiField[] = [];
            const flatten = (data: any, prefix = '') => {
              if (!data || typeof data !== 'object') return;
              Object.keys(data).forEach(key => {
                const v = data[key];
                const name = prefix ? `${prefix}.${key}` : key;
                fields.push({ name, type: Array.isArray(v) ? 'array' : typeof v, required: true, description: '' });
                if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, name);
              });
            };
            flatten(obj);
            
            const updates = jsonModalType === 'request' 
              ? { requestBody: val, inputParams: fields } 
              : { responseBody: val, outputParams: fields };
              
            const newApis = currentProject!.apis.map(a => a.id === currentApi.id ? { ...a, ...updates } : a);
            updateProjectAndCloud({ apis: newApis }, currentProject!.id);
          } catch (e) { handleError(new Error("JSON không hợp lệ")); }
        }} 
      />

      <input type="file" ref={fileInputRef} onChange={async (e) => {
        const file = e.target.files?.[0];
        if (!file || !currentProject) return;
        setIsExtracting(true);
        try {
          const text = await extractDocumentText(file);
          updateProjectAndCloud({ template: text }, currentProject.id);
        } catch (err: any) { handleError(err); }
        finally { setIsExtracting(false); }
      }} className="hidden" accept=".docx" />
      
      <input type="file" ref={diagramInputRef} onChange={(e) => {
        const file = e.target.files?.[0];
        if (!file || !currentApiId) return;
        const reader = new FileReader();
        reader.onloadend = () => {
          const newApis = currentProject!.apis.map(a => a.id === currentApiId ? { ...a, sequenceDiagram: reader.result as string } : a);
          updateProjectAndCloud({ apis: newApis }, currentProject!.id);
        };
        reader.readAsDataURL(file);
      }} className="hidden" accept="image/*" />
      
      {error && (
        <div className="fixed bottom-10 right-10 z-[300] animate-in slide-in-from-right-10">
          <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-2xl border border-white/10 flex flex-col gap-6 max-w-sm">
            <div className="flex items-center gap-4">
              <div className="bg-red-600 p-3 rounded-2xl shadow-lg shadow-red-500/30">
                {error.isAuth ? <ShieldAlert size={24} /> : error.isCors ? <Globe size={24} /> : <AlertCircle size={24} />}
              </div>
              <div>
                <p className="font-black uppercase text-[10px] tracking-widest text-red-500">
                  {error.isAuth ? 'THIẾT LẬP SAI' : error.isCors ? 'KẾT NỐI BỊ CHẶN' : 'LỖI HỆ THỐNG'}
                </p>
                <p className="text-sm font-bold mt-1 leading-relaxed">{error.message}</p>
              </div>
            </div>
            
            <button 
              onClick={() => { setView('settings'); setError(null); }}
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-xs shadow-xl shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
            >
              <LogIn size={16} /> KIỂM TRA CÀI ĐẶT
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
