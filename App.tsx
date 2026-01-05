
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  FileText, Send, Loader2, Info, BookOpen, Layers, 
  UploadCloud, Plus, ChevronLeft, Trash2, Edit3, 
  Settings as SettingsIcon, Share2, Table, Cloud, CheckCircle, Database,
  ArrowLeft, HardDrive, ShieldCheck, Zap, RefreshCw, List,
  Upload, File, Save, ExternalLink, AlertCircle, FilePlus,
  ArrowRightLeft, Code2, ClipboardList, Image as ImageIcon,
  LogIn, Globe, Key, FolderOpen, LogOut, HelpCircle, ShieldAlert, X, Terminal,
  Cpu, FileSearch, Eye, Type, Asterisk, Activity, Wifi, WifiOff
} from 'lucide-react';
import { generateApiDoc } from './services/geminiService';
import { 
  createProjectStructure, 
  syncProjectToSheet, 
  uploadDocFile,
  uploadRawFile,
  checkConnection
} from './services/googleDriveService';
import { extractDocumentText } from './services/documentService';
import { Project, ApiInfo, AppView, AppStatus, CloudConfig, GlobalConfig, ApiField } from './types';
import { DEFAULT_TEMPLATE, METHODS } from './constants';
import MarkdownPreview from './components/MarkdownPreview';
import JsonEditorModal from './components/JsonEditorModal';

const STORAGE_KEY = 'api_doc_architect_data';

const App: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  
  const env = useMemo(() => {
    const metaEnv = (import.meta as any).env || {};
    const procEnv = (window.process as any)?.env || {};

    return {
      API_KEY: procEnv.API_KEY || metaEnv.VITE_API_KEY || "",
      GOOGLE_ACCESS_TOKEN: procEnv.GOOGLE_ACCESS_TOKEN || metaEnv.VITE_GOOGLE_ACCESS_TOKEN || "",
      GOOGLE_REFRESH_TOKEN: procEnv.GOOGLE_REFRESH_TOKEN || metaEnv.VITE_GOOGLE_REFRESH_TOKEN || "",
      GOOGLE_CLIENT_ID: procEnv.GOOGLE_CLIENT_ID || metaEnv.VITE_GOOGLE_CLIENT_ID || "",
      GOOGLE_CLIENT_SECRET: procEnv.GOOGLE_CLIENT_SECRET || metaEnv.VITE_GOOGLE_CLIENT_SECRET || "",
      GOOGLE_DRIVE_FOLDER_ID: procEnv.GOOGLE_DRIVE_FOLDER_ID || metaEnv.VITE_GOOGLE_DRIVE_FOLDER_ID || ""
    };
  }, []);

  const missingKeys = useMemo(() => {
    const missing = [];
    if (!env.API_KEY) missing.push("API_KEY");
    if (!env.GOOGLE_ACCESS_TOKEN && !env.GOOGLE_REFRESH_TOKEN) missing.push("TOKEN (Access or Refresh)");
    return missing;
  }, [env]);

  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [currentApiId, setCurrentApiId] = useState<string | null>(null);
  const [view, setView] = useState<AppView>('dashboard');
  const [status, setStatus] = useState<AppStatus>('idle');
  const [syncStatus, setSyncStatus] = useState<'synced' | 'pending' | 'failed'>('synced');
  const [result, setResult] = useState<string>('');
  const [error, setError] = useState<{message: string, isAuth: boolean} | null>(null);
  const [showSyncSuccess, setShowSyncSuccess] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  
  const [isJsonModalOpen, setIsJsonModalOpen] = useState(false);
  const [jsonModalType, setJsonModalType] = useState<'request' | 'response'>('request');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const diagramInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try { 
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setProjects(parsed);
      } catch (e) { console.error("Error loading projects", e); }
    }
  }, []);

  const currentProject = useMemo(() => projects.find(p => p.id === currentProjectId), [projects, currentProjectId]);
  const currentApi = useMemo(() => currentProject?.apis.find(a => a.id === currentApiId), [currentProject, currentApiId]);

  const handleError = (err: any) => {
    console.error("Critical Error Catch:", err);
    let msg = err.message || "Đã có lỗi xảy ra";
    const isAuth = msg.includes('UNAUTHORIZED') || msg.includes('MISSING_TOKEN') || msg.includes('401');
    
    if (isAuth && !env.GOOGLE_REFRESH_TOKEN) {
      msg = "Lỗi xác thực (401). Token đã hết hạn và bạn chưa cấu hình Refresh Token để tự động gia hạn.";
    }
    
    setError({ message: msg, isAuth });
    setStatus('error');
    if (isAuth) setSyncStatus('failed');
  };

  const updateProjectLocal = (updates: Partial<Project>, projectId: string) => {
    const updatedProjects = projects.map(p => {
      if (p.id === projectId) {
        return { ...p, ...updates, updatedAt: Date.now() };
      }
      return p;
    });
    setProjects(updatedProjects);
    setSyncStatus('pending');
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedProjects));
  };

  const triggerSync = async (projectId: string) => {
    const projectToSync = projects.find(p => p.id === projectId);
    if (!projectToSync || !projectToSync.cloudConfig.googleSheetId) return;
    
    setSyncStatus('pending');
    try {
      await syncProjectToSheet(env, projectToSync.cloudConfig.googleSheetId, projectToSync);
      setSyncStatus('synced');
    } catch (err: any) {
      handleError(err);
    }
  };

  const updateProjectAndCloud = async (updates: Partial<Project>, projectId: string) => {
    updateProjectLocal(updates, projectId);
    const project = projects.find(p => p.id === projectId);
    if (project?.cloudConfig.autoSync) {
      const updatedProject = { ...project, ...updates };
      if (updatedProject.cloudConfig.googleSheetId) {
        try {
          await syncProjectToSheet(env, updatedProject.cloudConfig.googleSheetId, updatedProject);
          setSyncStatus('synced');
        } catch (err: any) {
          handleError(err);
        }
      }
    }
  };

  const handleUpdateField = (apiId: string, type: 'input' | 'output', fieldName: string, updates: Partial<ApiField>) => {
    if (!currentProject) return;
    const newApis = currentProject.apis.map(api => {
      if (api.id === apiId) {
        const fieldKey = type === 'input' ? 'inputParams' : 'outputParams';
        const newFields = api[fieldKey].map(f => f.name === fieldName ? { ...f, ...updates } : f);
        return { ...api, [fieldKey]: newFields };
      }
      return api;
    });
    updateProjectAndCloud({ apis: newApis }, currentProject.id);
  };

  const renderFieldsTable = (fields: ApiField[], type: 'input' | 'output') => (
    <div className="mt-6 border border-slate-100 rounded-3xl overflow-hidden shadow-sm bg-white">
      <table className="w-full text-left border-collapse">
        <thead className="bg-slate-50 border-b border-slate-100">
          <tr>
            <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest w-1/4">Trường dữ liệu</th>
            <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest w-16 text-center">Req</th>
            <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest w-1/4">Kiểu</th>
            <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Mô tả ý nghĩa / Business Logic</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {fields.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-6 py-12 text-center text-slate-300 text-xs font-bold uppercase italic">
                Chưa có dữ liệu. Hãy dán JSON mẫu vào Request/Response Payload.
              </td>
            </tr>
          ) : fields.map((field) => (
            <tr key={field.name} className="hover:bg-blue-50/20 transition-all group">
              <td className="px-6 py-4">
                <div className="font-mono text-xs font-bold text-slate-600 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
                  {field.name}
                </div>
              </td>
              <td className="px-6 py-4 text-center">
                <button 
                  onClick={() => handleUpdateField(currentApi!.id, type, field.name, { required: !field.required })}
                  className={`p-1.5 rounded-lg transition-all ${field.required ? 'text-red-500 bg-red-50' : 'text-slate-200 hover:text-slate-400'}`}
                >
                  <Asterisk size={14} />
                </button>
              </td>
              <td className="px-6 py-4">
                <span className="text-[9px] font-black bg-slate-100 text-slate-500 px-2 py-1 rounded-md uppercase tracking-tighter">
                  {field.type}
                </span>
              </td>
              <td className="px-6 py-4">
                <input 
                  className="w-full bg-slate-50/50 group-hover:bg-white px-3 py-2 rounded-xl border border-transparent focus:border-blue-200 focus:bg-white outline-none text-xs font-medium transition-all shadow-inner"
                  value={field.description}
                  onChange={(e) => handleUpdateField(currentApi!.id, type, field.name, { description: e.target.value })}
                  placeholder="Ví dụ: Mã định danh duy nhất của người dùng..."
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const createProject = async () => {
    if (missingKeys.length > 0) {
      setError({ message: `Lỗi: Thiếu cấu hình trong .env (${missingKeys.join(", ")})`, isAuth: false });
      return;
    }
    setStatus('syncing');
    try {
      const projectName = `Dự án ${new Date().toLocaleDateString()}`;
      const { folderId, sheetId } = await createProjectStructure(env, projectName, env.GOOGLE_DRIVE_FOLDER_ID);
      const newProj: Project = {
        id: crypto.randomUUID(),
        name: projectName,
        description: 'Tài liệu đồng bộ Google Cloud',
        template: DEFAULT_TEMPLATE,
        apis: [],
        updatedAt: Date.now(),
        cloudConfig: { googleDriveFolderId: folderId, googleSheetId: sheetId, autoSync: true }
      };
      await syncProjectToSheet(env, sheetId, newProj);
      const updatedProjects = [newProj, ...projects];
      setProjects(updatedProjects);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedProjects));
      setCurrentProjectId(newProj.id);
      setView('project-detail');
      setStatus('idle');
      setSyncStatus('synced');
    } catch (err: any) { handleError(err); }
  };

  const handleGenerateFullDoc = async () => {
    if (!env.API_KEY || !currentProject) {
      handleError(new Error("Thiếu API_KEY hoặc chưa chọn dự án"));
      return;
    }
    setStatus('processing');
    try {
      if (!(window.process as any).env.API_KEY) {
        (window.process as any).env.API_KEY = env.API_KEY;
      }
      
      const doc = await generateApiDoc(currentProject.apis, currentProject.template);
      setResult(doc);
      setStatus('completed');
      if (currentProject.cloudConfig.googleDriveFolderId) {
        await uploadDocFile(env, currentProject.cloudConfig.googleDriveFolderId, `Doc_${currentProject.name}`, doc);
        setShowSyncSuccess(true);
        setTimeout(() => setShowSyncSuccess(false), 3000);
      }
    } catch (err: any) { handleError(err); }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900">
      <header className="bg-white/80 backdrop-blur-xl border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-18 flex items-center justify-between py-4">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setView('dashboard')}>
            <div className="bg-blue-600 p-2.5 rounded-2xl text-white shadow-lg group-hover:rotate-12 transition-all"><Zap size={22} /></div>
            <h1 className="text-xl font-black tracking-tighter uppercase">API Doc <span className="text-blue-600">Architect</span></h1>
          </div>
          <div className="flex items-center gap-4">
             {currentProjectId && (
               <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                 syncStatus === 'synced' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                 syncStatus === 'pending' ? 'bg-amber-50 text-amber-600 border-amber-100 animate-pulse' :
                 'bg-red-50 text-red-600 border-red-100'
               }`}>
                 {syncStatus === 'synced' ? <Wifi size={14} /> : syncStatus === 'pending' ? <RefreshCw size={14} className="animate-spin" /> : <WifiOff size={14} />}
                 {syncStatus === 'synced' ? 'Cloud Synced' : syncStatus === 'pending' ? 'Syncing...' : 'Sync Failed'}
                 {syncStatus !== 'synced' && (
                   <button onClick={() => triggerSync(currentProjectId)} className="ml-2 hover:bg-black/5 p-1 rounded-md transition-all">
                     <RefreshCw size={12} />
                   </button>
                 )}
               </div>
             )}
             <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border shadow-sm transition-all ${missingKeys.length === 0 ? 'bg-slate-50 text-slate-700 border-slate-100' : 'bg-red-50 text-red-700 border-red-100 animate-pulse'}`}>
                {missingKeys.length === 0 ? <CheckCircle size={16} /> : <ShieldAlert size={16} />}
                <span className="text-[10px] font-black uppercase tracking-tight">
                  {missingKeys.length === 0 ? (env.GOOGLE_REFRESH_TOKEN ? 'Auto-Renew Mode' : 'Fixed Token Mode') : `Setup Required`}
                </span>
             </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        {view === 'dashboard' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-end">
              <div>
                <h2 className="text-4xl font-black text-gray-900 tracking-tighter">Chào mừng quay lại</h2>
                <p className="text-slate-400 font-bold text-xs mt-1 uppercase tracking-widest">Hệ thống thiết kế API đặc tả thông minh</p>
              </div>
              <button onClick={createProject} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-3xl font-black shadow-xl flex items-center gap-3 transition-all active:scale-95 disabled:opacity-50" disabled={status === 'syncing'}>
                {status === 'syncing' ? <Loader2 size={24} className="animate-spin" /> : <Plus size={24} />} Tạo Dự án Mới
              </button>
            </div>

            {missingKeys.length > 0 && (
              <div className="bg-white border-2 border-red-200 p-8 rounded-[2.5rem] shadow-xl shadow-red-500/5">
                <div className="flex flex-col md:flex-row items-start gap-8">
                  <div className="bg-red-100 p-5 rounded-3xl text-red-600 shadow-inner"><Terminal size={32} /></div>
                  <div className="flex-1 space-y-4">
                    <h4 className="font-black text-red-900 uppercase tracking-tight text-lg">CẦN CẤU HÌNH TRƯỚC KHI SỬ DỤNG</h4>
                    <p className="text-sm text-red-700/80 font-medium">Để sử dụng "vĩnh viễn", hãy cấu hình đầy đủ Client ID và Refresh Token trong <code>.env</code>:</p>
                    <div className="bg-slate-900 p-6 rounded-3xl text-blue-200 font-mono text-[10px] border border-blue-500/20 shadow-2xl overflow-x-auto">
                       <p><span className="text-pink-400">VITE_GOOGLE_CLIENT_ID</span>=...apps.googleusercontent.com</p>
                       <p><span className="text-blue-400">VITE_GOOGLE_CLIENT_SECRET</span>=GOCSPX-...</p>
                       <p><span className="text-emerald-400">VITE_GOOGLE_REFRESH_TOKEN</span>=1//0...</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {projects.length === 0 ? (
                <div className="col-span-full py-32 text-center flex flex-col items-center justify-center bg-white rounded-[3rem] border-4 border-dashed border-slate-100">
                  <div className="p-8 bg-slate-50 rounded-[2.5rem] text-slate-200 mb-6"><Database size={64} /></div>
                  <h3 className="text-2xl font-black text-slate-300">Chưa có dự án nào</h3>
                  <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-2">Bắt đầu bằng cách tạo dự án mới</p>
                </div>
              ) : projects.map(p => (
                <div key={p.id} onClick={() => { setCurrentProjectId(p.id); setView('project-detail'); }} className="group bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm hover:shadow-2xl hover:-translate-y-1 cursor-pointer transition-all duration-300">
                  <div className="bg-blue-50 p-5 rounded-[2rem] text-blue-600 w-fit mb-8 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300"><Database size={32} /></div>
                  <h3 className="text-2xl font-black text-gray-900 mb-3 truncate tracking-tight">{p.name}</h3>
                  <p className="text-slate-400 text-sm font-medium line-clamp-2 mb-6 h-10">{p.description}</p>
                  <div className="flex items-center justify-between pt-6 border-t border-slate-50">
                    <div className="flex items-center gap-2 text-emerald-500 text-[10px] font-black uppercase tracking-tight"><Cloud size={14} /> Ready</div>
                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{p.apis.length} APIs</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === 'project-detail' && currentProject && (
          <div className="space-y-6 animate-in fade-in duration-300">
             <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button onClick={() => setView('dashboard')} className="p-3 hover:bg-white hover:shadow-sm rounded-2xl text-gray-400 transition-all"><ChevronLeft size={24} /></button>
                <div className="space-y-1">
                   <h2 className="text-3xl font-black tracking-tighter">{currentProject.name}</h2>
                   <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Project Workspace</p>
                </div>
              </div>
              <div className="flex gap-4">
                <button onClick={handleGenerateFullDoc} disabled={status === 'processing' || currentProject.apis.length === 0} className="bg-slate-900 text-white px-10 py-4 rounded-[1.5rem] font-black text-sm flex items-center gap-3 shadow-2xl shadow-slate-300 hover:bg-black transition-all disabled:opacity-50 active:scale-95">
                  {status === 'processing' ? <Loader2 size={18} className="animate-spin" /> : <FilePlus size={18} />} XUẤT TÀI LIỆU
                </button>
                <button onClick={() => {
                  const newApi: ApiInfo = { id: crypto.randomUUID(), name: 'API mới', description: '', method: 'GET', endpoint: '/api/v1/', authType: 'Bearer', requestBody: '{}', responseBody: '{}', inputParams: [], outputParams: [] };
                  updateProjectAndCloud({ apis: [...currentProject.apis, newApi] }, currentProject.id);
                  setCurrentApiId(newApi.id); setView('api-edit');
                }} className="bg-blue-600 text-white px-8 py-4 rounded-[1.5rem] font-black text-sm flex items-center gap-3 shadow-2xl shadow-blue-300 hover:bg-blue-700 transition-all active:scale-95"><Plus size={18} /> THÊM API</button>
              </div>
            </div>

            {showSyncSuccess && (
              <div className="bg-emerald-500 text-white p-5 rounded-3xl font-black text-center animate-bounce shadow-xl flex items-center justify-center gap-3">
                 <CheckCircle size={20} /> HOÀN TẤT ĐỒNG BỘ CLOUD!
              </div>
            )}
            
            <div className="grid grid-cols-12 gap-8">
              <div className="col-span-8">
                {status === 'completed' ? <MarkdownPreview content={result} /> : (
                  <div className="bg-white rounded-[3rem] border border-slate-100 overflow-hidden shadow-sm min-h-[600px] flex flex-col">
                    <div className="px-10 py-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
                       <span className="font-black uppercase text-[10px] text-slate-400 tracking-widest flex items-center gap-2"><Table size={16} /> Danh mục đặc tả</span>
                    </div>
                    <div className="flex-1 divide-y divide-slate-50 overflow-auto">
                      {currentProject.apis.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center p-20">
                           <div className="p-6 bg-slate-50 rounded-3xl text-slate-200 mb-4"><Code2 size={48} /></div>
                           <p className="text-slate-300 font-black uppercase text-xs tracking-widest">Chưa có API nào.</p>
                        </div>
                      ) : currentProject.apis.map(api => (
                        <div key={api.id} onClick={() => { setCurrentApiId(api.id); setView('api-edit'); }} className="px-12 py-8 hover:bg-blue-50/50 cursor-pointer transition-all flex items-center gap-8 group">
                          <div className={`px-5 py-2 rounded-2xl font-black text-xs shadow-sm transition-all group-hover:scale-110 ${api.method === 'GET' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>{api.method}</div>
                          <div className="flex-1">
                             <h4 className="font-black text-slate-900 text-lg group-hover:text-blue-600 transition-all">{api.name}</h4>
                             <p className="text-xs text-slate-400 font-mono mt-1 opacity-70">{api.endpoint}</p>
                          </div>
                          <ChevronLeft size={24} className="rotate-180 text-slate-200 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="col-span-4 space-y-8">
                <div className="bg-slate-900 p-10 rounded-[3.5rem] text-white shadow-2xl relative overflow-hidden group">
                  <h3 className="text-[10px] font-black uppercase text-blue-400 mb-8 tracking-widest flex items-center gap-2 relative z-10"><Layers size={14} /> Template File</h3>
                  <div className="space-y-6 relative z-10">
                    <button onClick={() => fileInputRef.current?.click()} disabled={isExtracting} className="w-full py-5 bg-blue-600 hover:bg-blue-700 rounded-2xl font-black text-xs flex items-center justify-center gap-3 transition-all shadow-xl active:scale-95">
                      {isExtracting ? <Loader2 size={20} className="animate-spin" /> : <UploadCloud size={20} />} 
                      {isExtracting ? "ĐANG XỬ LÝ..." : "TẢI LÊN MẪU MỚI"}
                    </button>
                    <div className="bg-white/5 p-6 rounded-3xl border border-white/10 hover:bg-white/10 transition-all cursor-pointer" onClick={() => setShowTemplateEditor(true)}>
                      <p className="text-[10px] font-mono opacity-40 leading-relaxed line-clamp-[8] whitespace-pre-wrap">{currentProject.template}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm space-y-6">
                   <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2"><Cloud size={14} /> Cloud Status</h4>
                   <div className="space-y-4">
                      <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl">
                         <div className={`p-3 rounded-xl shadow-sm ${env.GOOGLE_REFRESH_TOKEN ? 'text-emerald-500 bg-emerald-50' : 'text-amber-500 bg-amber-50'}`}>
                           {env.GOOGLE_REFRESH_TOKEN ? <ShieldCheck size={18} /> : <Key size={18} />}
                         </div>
                         <div>
                            <p className="text-[11px] font-black text-slate-900">{env.GOOGLE_REFRESH_TOKEN ? 'Permanent Access' : 'Temporary Session'}</p>
                            <p className="text-[9px] text-slate-400 uppercase">{env.GOOGLE_REFRESH_TOKEN ? 'Auto-Refresh Active' : 'Requires Manual Sync'}</p>
                         </div>
                      </div>
                   </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {view === 'api-edit' && currentApi && (
          <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
            <div className="bg-white p-10 rounded-[3.5rem] shadow-sm flex items-center justify-between border border-slate-100">
              <div className="flex items-center gap-6">
                <button onClick={() => setView('project-detail')} className="p-4 hover:bg-slate-50 rounded-2xl transition-all"><ChevronLeft size={28} /></button>
                <div className="space-y-1">
                  <input className="text-3xl font-black outline-none bg-transparent w-full tracking-tighter" value={currentApi.name} onChange={e => {
                    const newApis = currentProject!.apis.map(a => a.id === currentApi.id ? { ...a, name: e.target.value } : a);
                    updateProjectLocal({ apis: newApis }, currentProject!.id);
                  }} />
                  <div className="flex items-center gap-3 text-xs text-slate-400 font-mono font-bold uppercase tracking-widest">
                    <span className="text-blue-600">{currentApi.method}</span>
                    <span className="opacity-20">|</span>
                    <input className="bg-transparent outline-none w-96" value={currentApi.endpoint} onChange={e => {
                        const newApis = currentProject!.apis.map(a => a.id === currentApi.id ? { ...a, endpoint: e.target.value } : a);
                        updateProjectLocal({ apis: newApis }, currentProject!.id);
                    }} />
                  </div>
                </div>
              </div>
              <button onClick={() => setView('project-detail')} className="bg-slate-900 text-white px-12 py-5 rounded-[1.5rem] font-black text-xs shadow-2xl hover:bg-black transition-all active:scale-95 uppercase tracking-widest">LƯU & ĐÓNG</button>
            </div>

            <div className="grid grid-cols-12 gap-10 pb-40">
               <div className="col-span-8 space-y-10">
                 <div className="bg-white p-12 rounded-[3.5rem] shadow-sm border border-slate-100">
                    <div className="flex justify-between items-center mb-10">
                      <div className="flex items-center gap-4">
                         <div className="p-4 bg-blue-50 text-blue-600 rounded-[1.5rem]"><Code2 size={28} /></div>
                         <h3 className="font-black text-slate-900 text-xl uppercase tracking-tight">Request Data</h3>
                      </div>
                      <button onClick={() => { setJsonModalType('request'); setIsJsonModalOpen(true); }} className="bg-blue-600 text-white px-8 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all">Import JSON</button>
                    </div>
                    {renderFieldsTable(currentApi.inputParams, 'input')}
                 </div>

                 <div className="bg-white p-12 rounded-[3.5rem] shadow-sm border border-slate-100">
                    <div className="flex justify-between items-center mb-10">
                      <div className="flex items-center gap-4">
                         <div className="p-4 bg-emerald-50 text-emerald-600 rounded-[1.5rem]"><Code2 size={28} /></div>
                         <h3 className="font-black text-slate-900 text-xl uppercase tracking-tight">Response Data</h3>
                      </div>
                      <button onClick={() => { setJsonModalType('response'); setIsJsonModalOpen(true); }} className="bg-emerald-600 text-white px-8 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all">Import JSON</button>
                    </div>
                    {renderFieldsTable(currentApi.outputParams, 'output')}
                 </div>
               </div>

               <div className="col-span-4 space-y-10">
                  <div className="bg-white p-10 rounded-[3rem] border border-slate-100 sticky top-32">
                    <h3 className="font-black text-sm uppercase tracking-tight mb-8">Sequence Diagram</h3>
                    {currentApi.sequenceDiagram ? (
                       <div className="relative group overflow-hidden rounded-[2rem] border-2">
                         <img src={currentApi.sequenceDiagram} className="w-full h-auto" />
                         <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-3">
                            <button onClick={() => diagramInputRef.current?.click()} className="p-4 bg-white text-slate-900 rounded-2xl hover:scale-110 transition-all"><Edit3 size={20} /></button>
                            <button onClick={() => {
                               const newApis = currentProject!.apis.map(a => a.id === currentApi.id ? { ...a, sequenceDiagram: undefined } : a);
                               updateProjectLocal({ apis: newApis }, currentProject!.id);
                            }} className="p-4 bg-red-600 text-white rounded-2xl hover:scale-110 transition-all"><Trash2 size={20} /></button>
                         </div>
                       </div>
                    ) : (
                       <div onClick={() => diagramInputRef.current?.click()} className="border-4 border-dashed border-slate-50 rounded-[2.5rem] p-16 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition-all group">
                          <ImageIcon size={48} className="text-slate-200 group-hover:text-blue-500 mb-4 transition-all" />
                          <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Tải lên sơ đồ</span>
                       </div>
                    )}
                  </div>
               </div>
            </div>
          </div>
        )}
      </main>

      <JsonEditorModal 
        isOpen={isJsonModalOpen} 
        onClose={() => setIsJsonModalOpen(false)} 
        initialValue={jsonModalType === 'request' ? currentApi?.requestBody || '{}' : currentApi?.responseBody || '{}'} 
        title={jsonModalType === 'request' ? 'Request JSON' : 'Response JSON'} 
        onSave={val => {
          if (!currentApi) return;
          try {
            const obj = JSON.parse(val);
            const existingParams = jsonModalType === 'request' ? currentApi.inputParams : currentApi.outputParams;
            const fields: ApiField[] = [];
            const flatten = (data: any, prefix = '') => {
              if (!data || typeof data !== 'object') return;
              Object.keys(data).forEach(key => {
                const v = data[key];
                const name = prefix ? `${prefix}.${key}` : key;
                const existing = existingParams.find(p => p.name === name);
                fields.push({ 
                  name, 
                  type: Array.isArray(v) ? 'array' : typeof v, 
                  required: true, 
                  description: existing ? existing.description : '' 
                });
                if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, name);
              });
            };
            flatten(obj);
            const updates = jsonModalType === 'request' ? { requestBody: val, inputParams: fields } : { responseBody: val, outputParams: fields };
            const newApis = currentProject!.apis.map(a => a.id === currentApi.id ? { ...a, ...updates } : a);
            updateProjectLocal({ apis: newApis }, currentProject!.id);
          } catch (e) { handleError(new Error("JSON không hợp lệ")); }
        }} 
      />

      {showTemplateEditor && currentProject && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-6 bg-slate-900/90 backdrop-blur-xl animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-6xl h-[85vh] rounded-[4rem] shadow-2xl flex flex-col overflow-hidden border border-white/20">
              <div className="px-12 py-10 border-b border-slate-100 flex items-center justify-between">
                 <h3 className="font-black text-2xl uppercase tracking-tighter">Template Editor</h3>
                 <button onClick={() => setShowTemplateEditor(false)} className="p-4 hover:bg-slate-100 rounded-full transition-all text-slate-400"><X size={32} /></button>
              </div>
              <div className="flex-1 p-12 overflow-hidden bg-slate-50/50">
                 <textarea 
                    className="w-full h-full p-10 bg-white shadow-inner rounded-[3rem] font-mono text-sm border-none outline-none resize-none ring-4 ring-slate-100" 
                    value={currentProject.template} 
                    onChange={e => updateProjectLocal({ template: e.target.value }, currentProject.id)}
                    spellCheck={false}
                 />
              </div>
              <div className="px-12 py-8 bg-white border-t border-slate-100 flex justify-end">
                 <button onClick={() => setShowTemplateEditor(false)} className="bg-slate-900 text-white px-12 py-5 rounded-[2rem] font-black text-xs shadow-2xl hover:bg-black transition-all active:scale-95 uppercase tracking-widest">LƯU CẤU HÌNH</button>
              </div>
           </div>
        </div>
      )}

      <input type="file" ref={fileInputRef} onChange={async (e) => {
        const file = e.target.files?.[0];
        if (!file || !currentProject) return;
        setIsExtracting(true);
        try {
          const text = await extractDocumentText(file);
          updateProjectLocal({ template: text }, currentProject.id);
          if (env.GOOGLE_DRIVE_FOLDER_ID) {
             await uploadRawFile(env, env.GOOGLE_DRIVE_FOLDER_ID, file);
          }
          e.target.value = '';
        } catch (err: any) { handleError(err); }
        finally { setIsExtracting(false); }
      }} className="hidden" accept=".docx,.pdf,.txt,.md" />
      
      <input type="file" ref={diagramInputRef} onChange={(e) => {
        const file = e.target.files?.[0];
        if (!file || !currentApiId) return;
        const reader = new FileReader();
        reader.onloadend = () => {
          const newApis = currentProject!.apis.map(a => a.id === currentApiId ? { ...a, sequenceDiagram: reader.result as string } : a);
          updateProjectLocal({ apis: newApis }, currentProject!.id);
          e.target.value = '';
        };
        reader.readAsDataURL(file);
      }} className="hidden" accept="image/*" />

      {error && (
        <div className="fixed bottom-10 right-10 z-[300] animate-in slide-in-from-right-10 duration-500">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl border border-slate-100 flex flex-col gap-6 max-w-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-5 text-red-600">
                <div className="bg-red-50 p-4 rounded-3xl"><AlertCircle size={32} /></div>
                <div>
                  <p className="font-black uppercase text-[10px] tracking-widest">Hệ thống thông báo</p>
                  <p className="text-sm font-black mt-1 leading-relaxed text-slate-800">{error.message}</p>
                </div>
              </div>
              <button onClick={() => setError(null)} className="p-3 hover:bg-slate-100 rounded-full transition-all text-slate-400"><X size={20} /></button>
            </div>
            {error.isAuth && !env.GOOGLE_REFRESH_TOKEN && (
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                 <p className="text-[10px] font-black uppercase text-slate-500 mb-2">Để sử dụng vĩnh viễn:</p>
                 <ul className="text-[11px] space-y-1 text-slate-600 font-medium list-disc ml-4">
                    <li>Dùng Google OAuth Playground lấy <b>Refresh Token</b></li>
                    <li>Cấp quyền: <code className="bg-slate-200 px-1 rounded">drive.file</code> và <code className="bg-slate-200 px-1 rounded">spreadsheets</code></li>
                    <li>Thêm <code className="bg-slate-200 px-1 rounded">GOOGLE_CLIENT_ID</code> & <code className="bg-slate-200 px-1 rounded">REFRESH_TOKEN</code> vào .env</li>
                 </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
