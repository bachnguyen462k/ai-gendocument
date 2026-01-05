
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  FileText, Send, Loader2, Info, BookOpen, Layers, 
  UploadCloud, Plus, ChevronLeft, Trash2, Edit3, 
  Settings as SettingsIcon, Share2, Table, Cloud, CheckCircle, Database,
  ArrowLeft, HardDrive, ShieldCheck, Zap, RefreshCw, List,
  Upload, File, Save, ExternalLink, AlertCircle, FilePlus,
  ArrowRightLeft, Code2, ClipboardList, Image as ImageIcon,
  LogIn, Globe, Key, FolderOpen, LogOut, HelpCircle, ShieldAlert, X, Terminal,
  Cpu, FileSearch, Eye, Type, Asterisk
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

const App: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  
  const env = useMemo(() => {
    const metaEnv = (import.meta as any).env || {};
    const procEnv = (window.process as any)?.env || {};
    return {
      API_KEY: procEnv.API_KEY || metaEnv.VITE_API_KEY || "",
      GOOGLE_ACCESS_TOKEN: procEnv.GOOGLE_ACCESS_TOKEN || metaEnv.VITE_GOOGLE_ACCESS_TOKEN || "",
      GOOGLE_DRIVE_FOLDER_ID: procEnv.GOOGLE_DRIVE_FOLDER_ID || metaEnv.VITE_GOOGLE_DRIVE_FOLDER_ID || ""
    };
  }, []);

  const missingKeys = useMemo(() => {
    const missing = [];
    if (!env.API_KEY) missing.push("API_KEY");
    if (!env.GOOGLE_ACCESS_TOKEN) missing.push("GOOGLE_ACCESS_TOKEN");
    if (!env.GOOGLE_DRIVE_FOLDER_ID) missing.push("GOOGLE_DRIVE_FOLDER_ID");
    return missing;
  }, [env]);

  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [currentApiId, setCurrentApiId] = useState<string | null>(null);
  const [view, setView] = useState<AppView>('dashboard');
  const [status, setStatus] = useState<AppStatus>('idle');
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
    console.error("App Error:", err);
    const msg = err.message || "Đã có lỗi xảy ra";
    setError({ message: msg, isAuth: msg === 'UNAUTHORIZED' || msg === 'MISSING_TOKEN' });
    setStatus('error');
  };

  const updateProjectAndCloud = async (updates: Partial<Project>, projectId: string) => {
    const updatedProjects = projects.map(p => {
      if (p.id === projectId) {
        const updated = { ...p, ...updates, updatedAt: Date.now() };
        if (env.GOOGLE_ACCESS_TOKEN && updated.cloudConfig.googleSheetId) {
          syncProjectToSheet(env.GOOGLE_ACCESS_TOKEN, updated.cloudConfig.googleSheetId, updated).catch(handleError);
        }
        return updated;
      }
      return p;
    });
    setProjects(updatedProjects);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedProjects));
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
    <div className="mt-6 border border-slate-100 rounded-3xl overflow-hidden">
      <table className="w-full text-left border-collapse">
        <thead className="bg-slate-50 border-b border-slate-100">
          <tr>
            <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest w-1/4">Tên trường</th>
            <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest w-16 text-center">R</th>
            <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest w-1/4">Kiểu dữ liệu</th>
            <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Mô tả chi tiết (Nghiệp vụ)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50 bg-white">
          {fields.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-6 py-10 text-center text-slate-300 text-xs font-bold uppercase italic">
                Chưa có dữ liệu. Hãy nhập JSON để tự động trích xuất các trường.
              </td>
            </tr>
          ) : fields.map((field) => (
            <tr key={field.name} className="hover:bg-slate-50/50 transition-all">
              <td className="px-6 py-4">
                <div className="font-mono text-xs font-bold text-slate-600 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                  {field.name}
                </div>
              </td>
              <td className="px-6 py-4 text-center">
                <button 
                  onClick={() => handleUpdateField(currentApi!.id, type, field.name, { required: !field.required })}
                  className={`p-1 rounded-md transition-all ${field.required ? 'text-red-500 bg-red-50' : 'text-slate-200 hover:text-slate-400'}`}
                >
                  <Asterisk size={14} />
                </button>
              </td>
              <td className="px-6 py-4">
                <select 
                  className="bg-transparent text-[10px] font-black uppercase border-b-2 border-transparent focus:border-blue-500 outline-none text-blue-600"
                  value={field.type}
                  onChange={(e) => handleUpdateField(currentApi!.id, type, field.name, { type: e.target.value })}
                >
                  <option value="string">STRING</option>
                  <option value="number">NUMBER</option>
                  <option value="boolean">BOOLEAN</option>
                  <option value="object">OBJECT</option>
                  <option value="array">ARRAY</option>
                  <option value="null">NULL</option>
                </select>
              </td>
              <td className="px-6 py-4">
                <input 
                  className="w-full bg-transparent border-b border-transparent focus:border-blue-200 outline-none text-xs font-medium placeholder:text-slate-200 py-1 transition-all"
                  value={field.description}
                  onChange={(e) => handleUpdateField(currentApi!.id, type, field.name, { description: e.target.value })}
                  placeholder="Nhập ý nghĩa trường này..."
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
      setError({ message: `Cần cấu hình .env: ${missingKeys.join(", ")}`, isAuth: false });
      return;
    }
    setStatus('syncing');
    try {
      const projectName = `Dự án ${new Date().toLocaleDateString()}`;
      const { folderId, sheetId } = await createProjectStructure(env.GOOGLE_ACCESS_TOKEN, projectName, env.GOOGLE_DRIVE_FOLDER_ID);
      const newProj: Project = {
        id: crypto.randomUUID(),
        name: projectName,
        description: 'Tài liệu đồng bộ Google Cloud',
        template: DEFAULT_TEMPLATE,
        apis: [],
        updatedAt: Date.now(),
        cloudConfig: { googleDriveFolderId: folderId, googleSheetId: sheetId, autoSync: true }
      };
      await syncProjectToSheet(env.GOOGLE_ACCESS_TOKEN, sheetId, newProj);
      setProjects([newProj, ...projects]);
      localStorage.setItem(STORAGE_KEY, JSON.stringify([newProj, ...projects]));
      setCurrentProjectId(newProj.id);
      setView('project-detail');
      setStatus('idle');
    } catch (err: any) { handleError(err); }
  };

  const handleGenerateFullDoc = async () => {
    if (!env.API_KEY || !currentProject) return;
    setStatus('processing');
    try {
      const doc = await generateApiDoc(currentProject.apis, currentProject.template);
      setResult(doc);
      setStatus('completed');
      if (env.GOOGLE_ACCESS_TOKEN && currentProject.cloudConfig.googleDriveFolderId) {
        await uploadDocFile(env.GOOGLE_ACCESS_TOKEN, currentProject.cloudConfig.googleDriveFolderId, `Doc_${currentProject.name}`, doc);
        setShowSyncSuccess(true);
        setTimeout(() => setShowSyncSuccess(false), 3000);
      }
    } catch (err: any) { handleError(err); }
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
             {missingKeys.length === 0 ? (
               <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100 shadow-sm">
                  <Globe size={16} /> <span className="text-[10px] font-black uppercase tracking-tight">Cloud Sẵn sàng</span>
               </div>
             ) : (
               <div className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 rounded-xl border border-red-100 animate-pulse">
                  <ShieldAlert size={16} /> <span className="text-[10px] font-black uppercase tracking-tight">THIẾU KEY: {missingKeys.join(", ")}</span>
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
                <h2 className="text-4xl font-black text-gray-900 tracking-tighter">Bảng điều khiển</h2>
                <p className="text-slate-400 font-bold text-xs mt-1 uppercase tracking-widest">Thiết kế & Đồng bộ tài liệu</p>
              </div>
              <button onClick={createProject} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-3xl font-black shadow-xl flex items-center gap-3 transition-all active:scale-95 disabled:opacity-50" disabled={status === 'syncing'}>
                {status === 'syncing' ? <Loader2 size={24} className="animate-spin" /> : <Plus size={24} />} Tạo Dự án Mới
              </button>
            </div>
            {missingKeys.length > 0 && (
              <div className="bg-white border-2 border-red-200 p-8 rounded-[2.5rem] shadow-xl shadow-red-500/5">
                <div className="flex flex-col md:flex-row items-start gap-6">
                  <div className="bg-red-100 p-4 rounded-3xl text-red-600"><Terminal size={32} /></div>
                  <div className="flex-1 space-y-4">
                    <h4 className="font-black text-red-900 uppercase tracking-tight">CẦN CẤU HÌNH BIẾN MÔI TRƯỜNG</h4>
                    <p className="text-sm text-red-700/80 font-medium leading-relaxed">Để sử dụng đầy đủ tính năng, hãy thêm các key vào file <code>.env</code>.</p>
                  </div>
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {projects.map(p => (
                <div key={p.id} onClick={() => { setCurrentProjectId(p.id); setView('project-detail'); }} className="group bg-white p-8 rounded-[2.5rem] border border-gray-200 shadow-sm hover:shadow-xl cursor-pointer transition-all">
                  <div className="bg-blue-50 p-4 rounded-3xl text-blue-600 w-fit mb-6 group-hover:bg-blue-600 group-hover:text-white transition-all"><Database size={24} /></div>
                  <h3 className="text-xl font-black text-gray-900 mb-2 truncate">{p.name}</h3>
                  <div className="flex items-center gap-2 text-emerald-500 text-[10px] font-black uppercase tracking-tight"><Cloud size={12} /> Google Cloud Active</div>
                </div>
              ))}
            </div>
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
                <button onClick={handleGenerateFullDoc} disabled={status === 'processing' || currentProject.apis.length === 0} className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-black text-sm flex items-center gap-2 shadow-xl shadow-slate-200">
                  {status === 'processing' ? <Loader2 size={16} className="animate-spin" /> : <FilePlus size={16} />} GENERATE & SYNC
                </button>
                <button onClick={() => {
                  const newApi: ApiInfo = { id: crypto.randomUUID(), name: 'API mới', description: '', method: 'GET', endpoint: '/api/v1/', authType: 'Bearer', requestBody: '{}', responseBody: '{}', inputParams: [], outputParams: [] };
                  updateProjectAndCloud({ apis: [...currentProject.apis, newApi] }, currentProject.id);
                  setCurrentApiId(newApi.id); setView('api-edit');
                }} className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-black text-sm flex items-center gap-2 shadow-xl shadow-blue-200"><Plus size={16} /> Thêm API</button>
              </div>
            </div>
            <div className="grid grid-cols-12 gap-8">
              <div className="col-span-8">
                {status === 'completed' ? <MarkdownPreview content={result} /> : (
                  <div className="bg-white rounded-[3rem] border border-slate-100 overflow-hidden shadow-sm min-h-[500px]">
                    <div className="px-8 py-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
                       <span className="font-black uppercase text-[10px] text-slate-400 tracking-widest flex items-center gap-2"><Table size={14} /> Danh sách API</span>
                    </div>
                    {currentProject.apis.map(api => (
                      <div key={api.id} onClick={() => { setCurrentApiId(api.id); setView('api-edit'); }} className="px-10 py-7 hover:bg-blue-50/50 cursor-pointer transition-all flex items-center gap-6 group">
                        <div className={`px-4 py-1.5 rounded-xl font-black text-[10px] shadow-sm ${api.method === 'GET' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>{api.method}</div>
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
              <div className="col-span-4 space-y-6">
                <div className="bg-slate-900 p-8 rounded-[3rem] text-white shadow-2xl">
                  <h3 className="text-[10px] font-black uppercase text-blue-400 mb-6 tracking-widest">Mẫu Tài Liệu Hệ Thống</h3>
                  <button onClick={() => fileInputRef.current?.click()} disabled={isExtracting} className="w-full py-4 bg-blue-600 hover:bg-blue-700 rounded-2xl font-black text-xs flex items-center justify-center gap-2 transition-all shadow-lg">
                    {isExtracting ? <Loader2 size={18} className="animate-spin" /> : <UploadCloud size={18} />} {isExtracting ? "ĐANG XỬ LÝ..." : "TẢI LÊN FILE MẪU"}
                  </button>
                  <div onClick={() => setShowTemplateEditor(true)} className="mt-4 bg-white/5 p-6 rounded-2xl border border-white/10 cursor-pointer hover:bg-white/10 transition-all">
                    <p className="text-[10px] font-mono opacity-40 leading-relaxed line-clamp-[6] whitespace-pre-wrap">{currentProject.template}</p>
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
                  <input className="text-2xl font-black outline-none bg-transparent w-full" value={currentApi.name} onChange={e => {
                    const newApis = currentProject!.apis.map(a => a.id === currentApi.id ? { ...a, name: e.target.value } : a);
                    updateProjectAndCloud({ apis: newApis }, currentProject!.id);
                  }} />
                  <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                    <span className="font-black text-blue-600 uppercase tracking-tighter">{currentApi.method}</span>
                    <span className="opacity-50 px-1">|</span>
                    <span>{currentApi.endpoint}</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setView('project-detail')} className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-black text-xs shadow-xl active:scale-95 transition-all">LƯU & ĐÓNG</button>
            </div>

            <div className="grid grid-cols-12 gap-8 pb-20">
               <div className="col-span-8 space-y-8">
                 <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100">
                    <div className="flex justify-between items-center mb-8">
                      <h3 className="font-black text-slate-900 text-lg uppercase tracking-tight flex items-center gap-3">
                        <Code2 size={24} className="text-blue-600" /> Cấu trúc Request
                      </h3>
                      <button onClick={() => { setJsonModalType('request'); setIsJsonModalOpen(true); }} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-[10px] font-black shadow-lg shadow-blue-200 flex items-center gap-2">
                        <RefreshCw size={14} /> CẬP NHẬT JSON REQUEST
                      </button>
                    </div>
                    {renderFieldsTable(currentApi.inputParams, 'input')}
                 </div>

                 <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100">
                    <div className="flex justify-between items-center mb-8">
                      <h3 className="font-black text-slate-900 text-lg uppercase tracking-tight flex items-center gap-3">
                        <Code2 size={24} className="text-emerald-600" /> Cấu trúc Response
                      </h3>
                      <button onClick={() => { setJsonModalType('response'); setIsJsonModalOpen(true); }} className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-[10px] font-black shadow-lg shadow-emerald-200 flex items-center gap-2">
                        <RefreshCw size={14} /> CẬP NHẬT JSON RESPONSE
                      </button>
                    </div>
                    {renderFieldsTable(currentApi.outputParams, 'output')}
                 </div>

                 <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100">
                    <h3 className="font-black text-slate-900 text-lg uppercase tracking-tight mb-6">Mô tả nghiệp vụ bổ sung</h3>
                    <textarea 
                      className="w-full bg-slate-50 p-6 rounded-3xl border border-transparent focus:border-blue-100 outline-none transition-all text-sm h-40 leading-relaxed"
                      value={currentApi.description}
                      onChange={e => {
                         const newApis = currentProject!.apis.map(a => a.id === currentApi.id ? { ...a, description: e.target.value } : a);
                         updateProjectAndCloud({ apis: newApis }, currentProject!.id);
                      }}
                      placeholder="Mô tả các ràng buộc logic, cách tính toán của API này..."
                    />
                 </div>
               </div>

               <div className="col-span-4 space-y-8">
                  <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100">
                    <h3 className="font-black text-sm uppercase tracking-tight mb-6">Sequence Diagram</h3>
                    {currentApi.sequenceDiagram ? (
                       <div className="relative group">
                         <img src={currentApi.sequenceDiagram} className="w-full rounded-2xl border shadow-sm" />
                         <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-all rounded-2xl flex items-center justify-center gap-2">
                            <button onClick={() => diagramInputRef.current?.click()} className="p-3 bg-white text-slate-900 rounded-xl"><Edit3 size={18} /></button>
                            <button onClick={() => {
                               const newApis = currentProject!.apis.map(a => a.id === currentApi.id ? { ...a, sequenceDiagram: undefined } : a);
                               updateProjectAndCloud({ apis: newApis }, currentProject!.id);
                            }} className="p-3 bg-red-600 text-white rounded-xl"><Trash2 size={18} /></button>
                         </div>
                       </div>
                    ) : (
                       <div onClick={() => diagramInputRef.current?.click()} className="border-4 border-dashed border-slate-50 rounded-[2rem] p-12 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition-all">
                          <ImageIcon size={40} className="text-slate-200 mb-3" />
                          <span className="text-[10px] font-black text-slate-300 uppercase">Tải lên sơ đồ</span>
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
            const updates = jsonModalType === 'request' ? { requestBody: val, inputParams: fields } : { responseBody: val, outputParams: fields };
            updateProjectAndCloud({ apis: currentProject!.apis.map(a => a.id === currentApi.id ? { ...a, ...updates } : a) }, currentProject!.id);
          } catch (e) { handleError(new Error("JSON không hợp lệ")); }
        }} 
      />

      {/* Modal chỉnh sửa Template và File Inputs giữ nguyên như cũ... */}
      {showTemplateEditor && currentProject && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-200">
           <div className="bg-white w-full max-w-5xl h-[80vh] rounded-[3rem] shadow-2xl flex flex-col overflow-hidden">
              <div className="px-10 py-8 border-b border-slate-100 flex items-center justify-between">
                 <div className="flex items-center gap-4">
                    <div className="bg-slate-900 p-3 rounded-2xl text-white"><FileText size={20} /></div>
                    <div><h3 className="font-black text-lg uppercase tracking-tight">Trình chỉnh sửa Template</h3></div>
                 </div>
                 <button onClick={() => setShowTemplateEditor(false)} className="p-3 hover:bg-slate-100 rounded-full"><X size={24} /></button>
              </div>
              <div className="flex-1 p-10 overflow-hidden">
                 <textarea className="w-full h-full p-8 bg-slate-50 rounded-[2rem] font-mono text-sm border-none outline-none resize-none" value={currentProject.template} onChange={e => updateProjectAndCloud({ template: e.target.value }, currentProject.id)} />
              </div>
              <div className="px-10 py-8 bg-slate-50 flex justify-end">
                 <button onClick={() => setShowTemplateEditor(false)} className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-black text-xs shadow-xl transition-all">HOÀN TẤT & LƯU</button>
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
        } catch (err: any) { handleError(err); }
        finally { setIsExtracting(false); }
      }} className="hidden" accept=".docx,.pdf,.txt,.md" />
      
      <input type="file" ref={diagramInputRef} onChange={(e) => {
        const file = e.target.files?.[0];
        if (!file || !currentApiId) return;
        const reader = new FileReader();
        reader.onloadend = () => {
          updateProjectAndCloud({ apis: currentProject!.apis.map(a => a.id === currentApiId ? { ...a, sequenceDiagram: reader.result as string } : a) }, currentProject!.id);
        };
        reader.readAsDataURL(file);
      }} className="hidden" accept="image/*" />
    </div>
  );
};

export default App;
