
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  FileText, Send, Loader2, Info, BookOpen, Layers, 
  UploadCloud, Plus, ChevronLeft, Trash2, Edit3, 
  Settings as SettingsIcon, Share2, Table, Cloud, CheckCircle, Database,
  ArrowLeft, HardDrive, ShieldCheck, Zap, RefreshCw, List,
  Upload, File, Save, ExternalLink, AlertCircle, FilePlus,
  ArrowRightLeft, Code2, ClipboardList, Image as ImageIcon,
  LogIn, Globe, Key, FolderOpen, LogOut, HelpCircle, ShieldAlert, X, Terminal,
  Cpu, FileSearch, Eye, Type, Asterisk, Activity, Wifi, WifiOff, Search
} from 'lucide-react';
import { generateApiDoc } from './services/geminiService';
import { 
  createProjectStructure, 
  syncProjectToSheet, 
  uploadDocFile,
  uploadRawFile,
  uploadImageFile,
  listRemoteProjectFolders,
  findProjectSheetInFolder,
  fetchProjectFromSheet
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
      GOOGLE_ACCESS_TOKEN: procEnv.GOOGLE_ACCESS_TOKEN || metaEnv.VITE_GOOGLE_ACCESS_TOKEN || "",
      GOOGLE_REFRESH_TOKEN: procEnv.GOOGLE_REFRESH_TOKEN || metaEnv.VITE_GOOGLE_REFRESH_TOKEN || "",
      GOOGLE_CLIENT_ID: procEnv.GOOGLE_CLIENT_ID || metaEnv.VITE_GOOGLE_CLIENT_ID || "",
      GOOGLE_CLIENT_SECRET: procEnv.GOOGLE_CLIENT_SECRET || metaEnv.VITE_GOOGLE_CLIENT_SECRET || "",
      GOOGLE_DRIVE_FOLDER_ID: procEnv.GOOGLE_DRIVE_FOLDER_ID || metaEnv.VITE_GOOGLE_DRIVE_FOLDER_ID || ""
    };
  }, []);

  const missingKeys = useMemo(() => {
    const missing = [];
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
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  
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
    const isAuth = msg.includes('UNAUTHORIZED') || msg.includes('MISSING_TOKEN') || msg.includes('401') || msg.includes('403');
    setError({ message: msg, isAuth });
    setStatus('error');
    if (isAuth) setSyncStatus('failed');
  };

  const updateProjectLocal = (updates: Partial<Project>, projectId: string) => {
    setProjects(prev => {
      const updated = prev.map(p => p.id === projectId ? { ...p, ...updates, updatedAt: Date.now() } : p);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
    setSyncStatus('pending');
  };

  const handleScanCloud = async () => {
    if (missingKeys.length > 0) {
      handleError(new Error("Cần cấu hình Token trước khi quét Cloud"));
      return;
    }
    setIsScanning(true);
    try {
      const folders = await listRemoteProjectFolders(env);
      const cloudFetchedProjects: Project[] = [];
      for (const folder of folders) {
        const sheet = await findProjectSheetInFolder(env, folder.id);
        if (sheet) {
          try {
            const projectData = await fetchProjectFromSheet(env, sheet.id, folder.id);
            if (!projectData.template) projectData.template = DEFAULT_TEMPLATE;
            cloudFetchedProjects.push(projectData);
          } catch (e) { console.error(e); }
        }
      }
      if (cloudFetchedProjects.length > 0) {
        setProjects(prevLocal => {
          const merged = [...prevLocal];
          cloudFetchedProjects.forEach(cp => {
            const existingIdx = merged.findIndex(p => p.cloudConfig.googleDriveFolderId === cp.cloudConfig.googleDriveFolderId);
            if (existingIdx !== -1) merged[existingIdx] = { ...cp, id: merged[existingIdx].id };
            else merged.unshift(cp);
          });
          const final = merged.sort((a, b) => b.updatedAt - a.updatedAt);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(final));
          return [...final];
        });
      }
    } catch (err: any) { handleError(err); } 
    finally { setIsScanning(false); }
  };

  const updateProjectAndCloud = async (updates: Partial<Project>, projectId: string) => {
    updateProjectLocal(updates, projectId);
    setProjects(currentProjects => {
      const project = currentProjects.find(p => p.id === projectId);
      if (project?.cloudConfig.autoSync && project.cloudConfig.googleSheetId) {
        syncProjectToSheet(env, project.cloudConfig.googleSheetId, project)
          .then(() => setSyncStatus('synced'))
          .catch(err => handleError(err));
      }
      return currentProjects;
    });
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
                Hãy dán JSON mẫu để tạo bảng mô tả tham số.
              </td>
            </tr>
          ) : fields.map((field) => (
            <tr key={field.name} className="hover:bg-blue-50/20 transition-all group">
              <td className="px-6 py-4">
                <div className="font-mono text-xs font-bold text-slate-600 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
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
                  className="w-full bg-slate-50/50 group-hover:bg-white px-3 py-2 rounded-xl border border-transparent focus:border-blue-200 focus:bg-white outline-none text-xs font-medium transition-all"
                  value={field.description}
                  onChange={(e) => handleUpdateField(currentApi!.id, type, field.name, { description: e.target.value })}
                  placeholder="Mô tả ý nghĩa trường dữ liệu..."
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const createProject = async () => {
    if (missingKeys.length > 0) return;
    setStatus('syncing');
    try {
      const projectName = prompt("Nhập tên dự án / Hệ thống:") || `Dự án ${new Date().toLocaleDateString()}`;
      const { folderId, sheetId } = await createProjectStructure(env, projectName, env.GOOGLE_DRIVE_FOLDER_ID);
      const newProj: Project = {
        id: crypto.randomUUID(),
        name: projectName,
        description: 'Tài liệu API đặc tả kỹ thuật',
        template: DEFAULT_TEMPLATE,
        apis: [],
        updatedAt: Date.now(),
        cloudConfig: { googleDriveFolderId: folderId, googleSheetId: sheetId, autoSync: true }
      };
      await syncProjectToSheet(env, sheetId, newProj);
      setProjects(prev => {
        const updated = [newProj, ...prev];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        return updated;
      });
      setCurrentProjectId(newProj.id);
      setView('project-detail');
      setStatus('idle');
      setSyncStatus('synced');
    } catch (err: any) { handleError(err); }
  };

  const handleGenerateFullDoc = async () => {
    if (!currentProject) return;
    setStatus('processing');
    try {
      const doc = await generateApiDoc(currentProject.apis, currentProject.template, currentProject.name);
      setResult(doc);
      setStatus('completed');
      if (currentProject.cloudConfig.googleDriveFolderId) {
        // Upload file docx lên Drive (chúng ta giả lập docx bằng HTML format word)
        await uploadDocFile(env, currentProject.cloudConfig.googleDriveFolderId, `DOCX_${currentProject.name}`, doc);
        setShowSyncSuccess(true);
        setTimeout(() => setShowSyncSuccess(false), 3000);
      }
    } catch (err: any) { handleError(err); }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900">
      <header className="bg-white/80 backdrop-blur-xl border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-18 flex items-center justify-between py-4">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => { setResult(''); setView('dashboard'); }}>
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
               </div>
             )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        {view === 'dashboard' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-end">
              <div>
                <h2 className="text-4xl font-black text-gray-900 tracking-tighter">API Workspace</h2>
                <p className="text-slate-400 font-bold text-xs mt-1 uppercase tracking-widest">Hệ thống tạo tài liệu kỹ thuật API thông minh</p>
              </div>
              <div className="flex gap-4">
                <button onClick={handleScanCloud} disabled={isScanning} className="bg-white border border-slate-200 hover:border-blue-500 hover:text-blue-600 text-slate-600 px-6 py-4 rounded-3xl font-black shadow-sm flex items-center gap-3 transition-all active:scale-95 disabled:opacity-50">
                  {isScanning ? <Loader2 size={24} className="animate-spin" /> : <Search size={24} />} QUÉT DỮ LIỆU CLOUD
                </button>
                <button onClick={createProject} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-3xl font-black shadow-xl flex items-center gap-3 transition-all active:scale-95 disabled:opacity-50" disabled={status === 'syncing'}>
                  {status === 'syncing' ? <Loader2 size={24} className="animate-spin" /> : <Plus size={24} />} Dự án mới
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {projects.map(p => (
                <div key={p.id} onClick={() => { setCurrentProjectId(p.id); setView('project-detail'); }} className="group bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm hover:shadow-2xl hover:-translate-y-1 cursor-pointer transition-all duration-300">
                  <div className="bg-blue-50 p-5 rounded-[2rem] text-blue-600 w-fit mb-8 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300"><Database size={32} /></div>
                  <h3 className="text-2xl font-black text-gray-900 mb-3 truncate tracking-tight">{p.name}</h3>
                  <div className="flex items-center justify-between pt-6 border-t border-slate-50 text-[10px] font-black uppercase tracking-tight">
                    <div className="text-emerald-500 flex items-center gap-2"><Cloud size={14} /> Cloud Ready</div>
                    <span className="text-slate-300">{p.apis.length} Endpoints</span>
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
                <h2 className="text-3xl font-black tracking-tighter">{currentProject.name}</h2>
              </div>
              <div className="flex gap-4">
                <button onClick={handleGenerateFullDoc} disabled={status === 'processing' || currentProject.apis.length === 0} className="bg-slate-900 text-white px-10 py-4 rounded-[1.5rem] font-black text-sm flex items-center gap-3 shadow-2xl hover:bg-black transition-all disabled:opacity-50">
                  {status === 'processing' ? <Loader2 size={18} className="animate-spin" /> : <FilePlus size={18} />} XUẤT FILE .DOCX
                </button>
                <button onClick={() => {
                  const newApi: ApiInfo = { id: crypto.randomUUID(), name: 'API mới', description: '', method: 'POST', endpoint: '/api/v1/resource', authType: 'Bearer Token', requestBody: '{}', responseBody: '{}', inputParams: [], outputParams: [] };
                  updateProjectAndCloud({ apis: [...currentProject.apis, newApi] }, currentProject.id);
                  setCurrentApiId(newApi.id); setView('api-edit');
                }} className="bg-blue-600 text-white px-8 py-4 rounded-[1.5rem] font-black text-sm flex items-center gap-3 shadow-2xl hover:bg-blue-700 transition-all"><Plus size={18} /> THÊM API</button>
              </div>
            </div>

            <div className="grid grid-cols-12 gap-8">
              <div className="col-span-8">
                {status === 'completed' ? <MarkdownPreview content={result} projectName={currentProject.name} /> : (
                  <div className="bg-white rounded-[3rem] border border-slate-100 overflow-hidden shadow-sm min-h-[600px] flex flex-col">
                    <div className="px-10 py-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
                       <span className="font-black uppercase text-[10px] text-slate-400 tracking-widest flex items-center gap-2"><Table size={16} /> Danh sách API kỹ thuật</span>
                    </div>
                    <div className="flex-1 divide-y divide-slate-50 overflow-auto">
                      {currentProject.apis.map(api => (
                        <div key={api.id} onClick={() => { setCurrentApiId(api.id); setView('api-edit'); }} className="px-12 py-8 hover:bg-blue-50/50 cursor-pointer transition-all flex items-center gap-8 group">
                          <div className={`px-5 py-2 rounded-2xl font-black text-xs ${api.method === 'GET' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>{api.method}</div>
                          <div className="flex-1">
                             <h4 className="font-black text-slate-900 text-lg group-hover:text-blue-600 transition-all">{api.name}</h4>
                             <p className="text-xs text-slate-400 font-mono mt-1">{api.endpoint}</p>
                          </div>
                          <ChevronLeft size={24} className="rotate-180 text-slate-200 group-hover:text-blue-600" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="col-span-4 space-y-8">
                <div className="bg-slate-900 p-10 rounded-[3.5rem] text-white shadow-2xl">
                  <h3 className="text-[10px] font-black uppercase text-blue-400 mb-6 tracking-widest flex items-center gap-2"><Layers size={14} /> Mẫu tài liệu gốc</h3>
                  <p className="text-xs text-slate-400 mb-6">Tải lên file mẫu công ty (.docx) hoặc chỉnh sửa cấu hình Markdown bên dưới.</p>
                  <button onClick={() => fileInputRef.current?.click()} className="w-full py-5 bg-blue-600 hover:bg-blue-700 rounded-2xl font-black text-xs flex items-center justify-center gap-3 mb-6 transition-all">
                    {isExtracting ? <Loader2 size={20} className="animate-spin" /> : <UploadCloud size={20} />} Cập nhật Template
                  </button>
                  <div className="bg-white/5 p-6 rounded-3xl border border-white/10 cursor-pointer hover:bg-white/10" onClick={() => setShowTemplateEditor(true)}>
                    <p className="text-[10px] font-mono opacity-40 line-clamp-6 text-white">{currentProject.template}</p>
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
                  <input className="text-3xl font-black outline-none bg-transparent w-full tracking-tighter" placeholder="Tên API..." value={currentApi.name} onChange={e => {
                    const newApis = currentProject!.apis.map(a => a.id === currentApi.id ? { ...a, name: e.target.value } : a);
                    updateProjectLocal({ apis: newApis }, currentProject!.id);
                  }} />
                  <div className="flex items-center gap-3 text-xs text-slate-400 font-mono font-bold uppercase tracking-widest">
                    <select className="bg-transparent text-blue-600 outline-none font-black" value={currentApi.method} onChange={e => {
                      const newApis = currentProject!.apis.map(a => a.id === currentApi.id ? { ...a, method: e.target.value } : a);
                      updateProjectLocal({ apis: newApis }, currentProject!.id);
                    }}>
                      {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <input className="bg-transparent outline-none w-96 border-b border-transparent focus:border-slate-200" value={currentApi.endpoint} onChange={e => {
                        const newApis = currentProject!.apis.map(a => a.id === currentApi.id ? { ...a, endpoint: e.target.value } : a);
                        updateProjectLocal({ apis: newApis }, currentProject!.id);
                    }} />
                  </div>
                </div>
              </div>
              <button onClick={() => setView('project-detail')} className="bg-slate-900 text-white px-12 py-5 rounded-[1.5rem] font-black text-xs hover:bg-black transition-all shadow-xl">HOÀN TẤT & LƯU</button>
            </div>

            <div className="grid grid-cols-12 gap-10">
               <div className="col-span-8 space-y-10 pb-20">
                 <div className="bg-white p-12 rounded-[3.5rem] shadow-sm border border-slate-100">
                    <h3 className="font-black text-slate-900 text-xl uppercase tracking-tight mb-8">2. Mô tả chi tiết API</h3>
                    <textarea 
                      className="w-full h-32 p-6 bg-slate-50 rounded-3xl border-transparent focus:border-blue-200 outline-none text-sm"
                      placeholder="Nhập mô tả nghiệp vụ của API này..."
                      value={currentApi.description}
                      onChange={e => {
                         const newApis = currentProject!.apis.map(a => a.id === currentApi.id ? { ...a, description: e.target.value } : a);
                         updateProjectLocal({ apis: newApis }, currentProject!.id);
                      }}
                    />
                    
                    <div className="mt-12">
                      <div className="flex justify-between items-center mb-6">
                         <div className="flex items-center gap-3"><Code2 className="text-blue-600" size={24} /><h4 className="font-black text-sm uppercase">Cấu trúc Request</h4></div>
                         <button onClick={() => { setJsonModalType('request'); setIsJsonModalOpen(true); }} className="bg-blue-600 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase shadow-lg">Import JSON</button>
                      </div>
                      {renderFieldsTable(currentApi.inputParams, 'input')}
                    </div>

                    <div className="mt-12">
                      <div className="flex justify-between items-center mb-6">
                         <div className="flex items-center gap-3"><Code2 className="text-emerald-600" size={24} /><h4 className="font-black text-sm uppercase">Cấu trúc Response</h4></div>
                         <button onClick={() => { setJsonModalType('response'); setIsJsonModalOpen(true); }} className="bg-emerald-600 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase shadow-lg">Import JSON</button>
                      </div>
                      {renderFieldsTable(currentApi.outputParams, 'output')}
                    </div>
                 </div>
               </div>

               <div className="col-span-4">
                  <div className="bg-white p-10 rounded-[3rem] border border-slate-100 sticky top-32 shadow-sm">
                    <h3 className="font-black text-sm uppercase tracking-tight mb-4 flex items-center gap-2"><ImageIcon size={18} className="text-blue-600"/> Sequence Diagram</h3>
                    <p className="text-[10px] text-slate-400 font-bold mb-6 uppercase">AI sẽ tự động phân tích luồng logic từ ảnh này</p>
                    {currentApi.sequenceDiagram ? (
                       <div className="relative group overflow-hidden rounded-[2rem] border-2 border-slate-100">
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
                       <div onClick={() => diagramInputRef.current?.click()} className="border-4 border-dashed border-slate-50 rounded-[2.5rem] p-12 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition-all">
                          {isUploadingImage ? <Loader2 size={48} className="animate-spin text-blue-500" /> : <Upload size={48} className="text-slate-200 mb-4" />}
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tải lên Sơ đồ</span>
                       </div>
                    )}
                  </div>
               </div>
            </div>
          </div>
        )}
      </main>

      {/* Modals and Hidden Inputs */}
      <JsonEditorModal 
        isOpen={isJsonModalOpen} 
        onClose={() => setIsJsonModalOpen(false)} 
        initialValue={jsonModalType === 'request' ? currentApi?.requestBody || '{}' : currentApi?.responseBody || '{}'} 
        title={jsonModalType === 'request' ? 'Nhập JSON Request mẫu' : 'Nhập JSON Response mẫu'} 
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
            const updates = jsonModalType === 'request' ? { requestBody: val, inputParams: fields } : { responseBody: val, outputParams: fields };
            const newApis = currentProject!.apis.map(a => a.id === currentApi.id ? { ...a, ...updates } : a);
            updateProjectLocal({ apis: newApis }, currentProject!.id);
            setIsJsonModalOpen(false);
          } catch (e) { alert("JSON không hợp lệ!"); }
        }} 
      />

      {showTemplateEditor && currentProject && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-6 bg-slate-900/90 backdrop-blur-xl">
           <div className="bg-white w-full max-w-6xl h-[85vh] rounded-[4rem] shadow-2xl flex flex-col overflow-hidden">
              <div className="px-12 py-8 border-b flex items-center justify-between">
                 <h3 className="font-black text-2xl uppercase tracking-tighter">Cấu hình Markdown Template</h3>
                 <button onClick={() => setShowTemplateEditor(false)} className="p-4 hover:bg-slate-100 rounded-full text-slate-400"><X size={32} /></button>
              </div>
              <textarea 
                  className="flex-1 p-16 font-mono text-sm outline-none resize-none bg-slate-50" 
                  value={currentProject.template} 
                  onChange={e => updateProjectLocal({ template: e.target.value }, currentProject.id)}
              />
              <div className="px-12 py-8 flex justify-end bg-white">
                 <button onClick={() => setShowTemplateEditor(false)} className="bg-blue-600 text-white px-12 py-5 rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-xl">LƯU THAY ĐỔI</button>
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
          updateProjectAndCloud({ template: text }, currentProject.id);
          e.target.value = '';
        } catch (err: any) { handleError(err); }
        finally { setIsExtracting(false); }
      }} className="hidden" accept=".docx,.txt,.md" />
      
      <input type="file" ref={diagramInputRef} onChange={async (e) => {
        const file = e.target.files?.[0];
        if (!file || !currentApiId || !currentProject) return;
        setIsUploadingImage(true);
        const reader = new FileReader();
        reader.onloadend = () => {
          const newApis = currentProject!.apis.map(a => a.id === currentApiId ? { ...a, sequenceDiagram: reader.result as string } : a);
          updateProjectLocal({ apis: newApis }, currentProject!.id);
          setIsUploadingImage(false);
        };
        reader.readAsDataURL(file);
      }} className="hidden" accept="image/*" />
    </div>
  );
};

export default App;
