
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
import { Project, ApiInfo, AppView, AppStatus, ApiField } from './types';
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

  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [currentApiId, setCurrentApiId] = useState<string | null>(null);
  const [view, setView] = useState<AppView>('dashboard');
  const [status, setStatus] = useState<AppStatus>('idle');
  const [syncStatus, setSyncStatus] = useState<'synced' | 'pending' | 'failed'>('synced');
  const [result, setResult] = useState<string>('');
  const [error, setError] = useState<{message: string, isAuth: boolean} | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isJsonModalOpen, setIsJsonModalOpen] = useState(false);
  const [jsonModalType, setJsonModalType] = useState<'request' | 'response'>('request');
  
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
    let msg = err.message || "Đã có lỗi xảy ra";
    const isAuth = msg.includes('UNAUTHORIZED') || msg.includes('401');
    setError({ message: msg, isAuth });
    setStatus('error');
  };

  const updateProjectLocal = (updates: Partial<Project>, projectId: string) => {
    setProjects(prev => {
      const updated = prev.map(p => p.id === projectId ? { ...p, ...updates, updatedAt: Date.now() } : p);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const updateProjectAndCloud = async (updates: Partial<Project>, projectId: string) => {
    updateProjectLocal(updates, projectId);
    const project = projects.find(p => p.id === projectId);
    if (project?.cloudConfig.autoSync && project.cloudConfig.googleSheetId) {
      syncProjectToSheet(env, project.cloudConfig.googleSheetId, { ...project, ...updates })
        .then(() => setSyncStatus('synced'))
        .catch(err => handleError(err));
    }
  };

  const createProject = async () => {
    setStatus('syncing');
    try {
      const projectName = prompt("Nhập tên dự án/hệ thống:") || `Hệ thống ${new Date().toLocaleDateString()}`;
      const { folderId, sheetId } = await createProjectStructure(env, projectName, env.GOOGLE_DRIVE_FOLDER_ID);
      const newProj: Project = {
        id: crypto.randomUUID(),
        name: projectName,
        description: 'Đặc tả kỹ thuật API 8 phần',
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
      const doc = await generateApiDoc(currentProject.apis, DEFAULT_TEMPLATE, currentProject.name);
      setResult(doc);
      setStatus('completed');
    } catch (err: any) { handleError(err); }
  };

  const renderFieldsTable = (fields: ApiField[]) => (
    <div className="mt-6 border border-slate-100 rounded-3xl overflow-hidden shadow-sm bg-white">
      <table className="w-full text-left border-collapse">
        <thead className="bg-slate-50 border-b border-slate-100">
          <tr>
            <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest w-1/4">Trường</th>
            <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest w-16 text-center">Req</th>
            <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest w-1/4">Kiểu</th>
            <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Mô tả</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {fields.length === 0 ? (
            <tr><td colSpan={4} className="px-6 py-10 text-center text-slate-300 text-xs italic">Dán JSON để tạo bảng dữ liệu</td></tr>
          ) : fields.map((field) => (
            <tr key={field.name} className="hover:bg-blue-50/20 transition-all">
              <td className="px-6 py-4 font-mono text-xs font-bold text-slate-600">{field.name}</td>
              <td className="px-6 py-4 text-center">{field.required ? <Asterisk size={12} className="text-red-500 mx-auto" /> : '-'}</td>
              <td className="px-6 py-4"><span className="text-[9px] font-black bg-slate-100 text-slate-500 px-2 py-1 rounded-md uppercase">{field.type}</span></td>
              <td className="px-6 py-4"><input className="w-full bg-transparent border-none outline-none text-xs" value={field.description} onChange={(e) => {
                const newApis = currentProject!.apis.map(a => {
                  if (a.id === currentApiId) {
                    const params = field.required !== undefined ? a.inputParams : a.outputParams; // Placeholder logic
                    return a;
                  }
                  return a;
                });
              }} placeholder="Mô tả ý nghĩa..." /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <header className="bg-white/80 backdrop-blur-xl border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-18 flex items-center justify-between py-4">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => { setResult(''); setView('dashboard'); }}>
            <div className="bg-blue-600 p-2.5 rounded-2xl text-white shadow-lg"><Zap size={22} /></div>
            <h1 className="text-xl font-black tracking-tighter uppercase">API Doc <span className="text-blue-600">Architect</span></h1>
          </div>
          {currentProjectId && <div className="text-[10px] font-black uppercase bg-emerald-50 text-emerald-600 px-4 py-2 rounded-xl border border-emerald-100">Cấu trúc 8 phần Active</div>}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        {view === 'dashboard' && (
          <div className="space-y-8 animate-in fade-in">
            <div className="flex justify-between items-end">
              <div>
                <h2 className="text-4xl font-black text-gray-900 tracking-tighter">API Documentation</h2>
                <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">Hệ thống tạo đặc tả kỹ thuật chuyên sâu</p>
              </div>
              <button onClick={createProject} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-3xl font-black shadow-xl flex items-center gap-3 transition-all">
                <Plus size={24} /> Tạo Dự án
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {projects.map(p => (
                <div key={p.id} onClick={() => { setCurrentProjectId(p.id); setView('project-detail'); }} className="group bg-white p-10 rounded-[3rem] border shadow-sm hover:shadow-2xl cursor-pointer transition-all">
                  <div className="bg-blue-50 p-5 rounded-[2rem] text-blue-600 w-fit mb-8 group-hover:bg-blue-600 group-hover:text-white transition-all"><Database size={32} /></div>
                  <h3 className="text-2xl font-black text-gray-900 mb-3 truncate">{p.name}</h3>
                  <div className="flex items-center justify-between pt-6 border-t border-slate-50 text-[10px] font-black uppercase">
                    <span className="text-slate-300">{p.apis.length} APIs chi tiết</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === 'project-detail' && currentProject && (
          <div className="space-y-6 animate-in fade-in">
             <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button onClick={() => setView('dashboard')} className="p-3 hover:bg-white rounded-2xl transition-all"><ChevronLeft size={24} /></button>
                <h2 className="text-3xl font-black tracking-tighter">{currentProject.name}</h2>
              </div>
              <div className="flex gap-4">
                <button onClick={handleGenerateFullDoc} disabled={status === 'processing' || currentProject.apis.length === 0} className="bg-slate-900 text-white px-10 py-4 rounded-[1.5rem] font-black text-sm flex items-center gap-3 shadow-2xl hover:bg-black transition-all">
                  {status === 'processing' ? <Loader2 size={18} className="animate-spin" /> : <FilePlus size={18} />} XUẤT TÀI LIỆU .DOC
                </button>
                <button onClick={() => {
                  const newApi: ApiInfo = { id: crypto.randomUUID(), name: 'API Mới', description: '', method: 'POST', endpoint: '/api/v1/', authType: 'Bearer Token', requestBody: '{}', responseBody: '{}', inputParams: [], outputParams: [] };
                  updateProjectAndCloud({ apis: [...currentProject.apis, newApi] }, currentProject.id);
                  setCurrentApiId(newApi.id); setView('api-edit');
                }} className="bg-blue-600 text-white px-8 py-4 rounded-[1.5rem] font-black text-sm flex items-center gap-3 shadow-2xl transition-all"><Plus size={18} /> THÊM API</button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-8">
              {status === 'completed' ? <MarkdownPreview content={result} projectName={currentProject.name} /> : (
                <div className="bg-white rounded-[3rem] border shadow-sm min-h-[600px] flex flex-col">
                  <div className="px-10 py-8 border-b bg-slate-50/30 flex items-center justify-between">
                    <span className="font-black uppercase text-[10px] text-slate-400 tracking-widest flex items-center gap-2"><Table size={16} /> Danh sách API đặc tả</span>
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
          </div>
        )}

        {view === 'api-edit' && currentApi && (
          <div className="space-y-8 animate-in slide-in-from-right duration-500">
            <div className="bg-white p-10 rounded-[3.5rem] shadow-sm flex items-center justify-between border">
              <div className="flex items-center gap-6">
                <button onClick={() => setView('project-detail')} className="p-4 hover:bg-slate-50 rounded-2xl transition-all"><ChevronLeft size={28} /></button>
                <div className="space-y-1">
                  <input className="text-3xl font-black outline-none bg-transparent w-full tracking-tighter" value={currentApi.name} onChange={e => {
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
              <button onClick={() => setView('project-detail')} className="bg-slate-900 text-white px-12 py-5 rounded-[2rem] font-black text-xs hover:bg-black shadow-xl">HOÀN TẤT & LƯU</button>
            </div>

            <div className="grid grid-cols-12 gap-10">
               <div className="col-span-8 space-y-10 pb-20">
                 <div className="bg-white p-12 rounded-[3.5rem] shadow-sm border">
                    <h3 className="font-black text-slate-900 text-xl uppercase tracking-tight mb-8">Nội dung đặc tả API</h3>
                    <div className="space-y-8">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Mô tả nghiệp vụ & Chức năng</label>
                        <textarea className="w-full h-32 p-6 bg-slate-50 rounded-3xl outline-none text-sm transition-all shadow-inner" placeholder="API này giải quyết bài toán gì?..." value={currentApi.description} onChange={e => {
                            const newApis = currentProject!.apis.map(a => a.id === currentApi.id ? { ...a, description: e.target.value } : a);
                            updateProjectLocal({ apis: newApis }, currentProject!.id);
                        }} />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Phương thức xác thực</label>
                        <input className="w-full p-6 bg-slate-50 rounded-3xl outline-none text-sm shadow-inner" placeholder="Ví dụ: Bearer Token, API Key..." value={currentApi.authType} onChange={e => {
                            const newApis = currentProject!.apis.map(a => a.id === currentApi.id ? { ...a, authType: e.target.value } : a);
                            updateProjectLocal({ apis: newApis }, currentProject!.id);
                        }} />
                      </div>

                      <div className="grid grid-cols-2 gap-8">
                        <div>
                          <div className="flex justify-between items-center mb-4">
                            <h4 className="font-black text-xs uppercase text-slate-400 tracking-widest">Request JSON</h4>
                            <button onClick={() => { setJsonModalType('request'); setIsJsonModalOpen(true); }} className="text-[10px] font-black text-blue-600 uppercase">Cấu hình</button>
                          </div>
                          <div className="p-6 bg-slate-900 rounded-3xl text-green-400 font-mono text-xs overflow-auto max-h-48 shadow-xl">{currentApi.requestBody}</div>
                        </div>
                        <div>
                          <div className="flex justify-between items-center mb-4">
                            <h4 className="font-black text-xs uppercase text-slate-400 tracking-widest">Response JSON</h4>
                            <button onClick={() => { setJsonModalType('response'); setIsJsonModalOpen(true); }} className="text-[10px] font-black text-emerald-600 uppercase">Cấu hình</button>
                          </div>
                          <div className="p-6 bg-slate-900 rounded-3xl text-emerald-400 font-mono text-xs overflow-auto max-h-48 shadow-xl">{currentApi.responseBody}</div>
                        </div>
                      </div>
                    </div>
                 </div>
               </div>

               <div className="col-span-4">
                  <div className="bg-white p-10 rounded-[3rem] border sticky top-32 shadow-xl">
                    <h3 className="font-black text-sm uppercase tracking-tight mb-4 flex items-center gap-2"><ImageIcon size={18} className="text-blue-600"/> Sequence Diagram</h3>
                    <p className="text-[10px] text-slate-400 font-bold mb-6 uppercase">AI sẽ phân tích luồng logic từ ảnh này</p>
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
                       <div onClick={() => diagramInputRef.current?.click()} className="border-4 border-dashed border-slate-50 rounded-[2.5rem] p-16 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition-all group">
                          {isUploadingImage ? <Loader2 size={48} className="animate-spin text-blue-500" /> : <Upload size={48} className="text-slate-200 mb-4 group-hover:text-blue-600 transition-all" />}
                          <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Tải lên Sơ đồ</span>
                       </div>
                    )}
                  </div>
               </div>
            </div>
          </div>
        )}
      </main>

      <JsonEditorModal 
        isOpen={isJsonModalOpen} onClose={() => setIsJsonModalOpen(false)} 
        initialValue={jsonModalType === 'request' ? currentApi?.requestBody || '{}' : currentApi?.responseBody || '{}'} 
        title={jsonModalType === 'request' ? 'Cấu trúc Request JSON' : 'Cấu trúc Response JSON'} 
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
