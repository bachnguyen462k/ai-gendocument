
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  FileText, Send, Loader2, Info, BookOpen, Layers, 
  UploadCloud, Plus, ChevronLeft, Trash2, Edit3, 
  Settings as SettingsIcon, Share2, Table, Cloud, CheckCircle, Database,
  ArrowLeft, HardDrive, ShieldCheck, Zap, RefreshCw, List,
  Upload, File, Save, ExternalLink, AlertCircle, FilePlus,
  ArrowRightLeft, Code2, ClipboardList, Image as ImageIcon,
  LogIn, Globe, Key, FolderOpen, LogOut, HelpCircle, ShieldAlert, X, Terminal
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
  
  // Kiểm tra biến môi trường bằng truy cập tĩnh (Static Access)
  // Đây là cách duy nhất để bundler như Vite/Webpack inject giá trị vào
  const envStatus = useMemo(() => ({
    hasApiKey: !!process.env.API_KEY,
    hasToken: !!process.env.GOOGLE_ACCESS_TOKEN,
    hasFolderId: !!process.env.GOOGLE_DRIVE_FOLDER_ID,
    apiKeyPreview: process.env.API_KEY ? `${process.env.API_KEY.substring(0, 6)}...` : 'N/A',
    tokenPreview: process.env.GOOGLE_ACCESS_TOKEN ? `${process.env.GOOGLE_ACCESS_TOKEN.substring(0, 10)}...` : 'N/A'
  }), []);

  useEffect(() => {
    console.group("🚀 [Khởi động API Doc Architect]");
    console.log("API_KEY Status:", envStatus.hasApiKey ? "✅ FOUND" : "❌ MISSING");
    console.log("GOOGLE_ACCESS_TOKEN Status:", envStatus.hasToken ? "✅ FOUND" : "❌ MISSING");
    console.log("GOOGLE_DRIVE_FOLDER_ID Status:", envStatus.hasFolderId ? "✅ FOUND" : "❌ MISSING");
    console.log("Nếu thông tin trên báo MISSING, hãy chắc chắn bạn đã chạy lệnh khởi động lại server dev.");
    console.groupEnd();
  }, [envStatus]);

  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [currentApiId, setCurrentApiId] = useState<string | null>(null);
  const [view, setView] = useState<AppView>('dashboard');
  const [status, setStatus] = useState<AppStatus>('idle');
  const [result, setResult] = useState<string>('');
  const [error, setError] = useState<{message: string, isAuth: boolean, isCors?: boolean} | null>(null);
  const [showSyncSuccess, setShowSyncSuccess] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  
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

  const getMissingKeys = (): string[] => {
    const missing = [];
    if (!process.env.API_KEY) missing.push("API_KEY");
    if (!process.env.GOOGLE_ACCESS_TOKEN) missing.push("GOOGLE_ACCESS_TOKEN");
    if (!process.env.GOOGLE_DRIVE_FOLDER_ID) missing.push("GOOGLE_DRIVE_FOLDER_ID");
    return missing;
  };

  const handleError = (err: any) => {
    console.error("App Error:", err);
    const msg = err.message || "Đã có lỗi xảy ra";
    
    if (msg === 'UNAUTHORIZED' || msg === 'MISSING_TOKEN') {
      setError({ 
        message: "Lỗi xác thực: GOOGLE_ACCESS_TOKEN không hợp lệ hoặc đã hết hạn. Vui lòng lấy token mới.", 
        isAuth: true 
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
        // Sử dụng token trực tiếp từ biến tĩnh
        if (process.env.GOOGLE_ACCESS_TOKEN && updated.cloudConfig.googleSheetId) {
          syncProjectToSheet(process.env.GOOGLE_ACCESS_TOKEN, updated.cloudConfig.googleSheetId, updated)
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
    const missing = getMissingKeys();
    if (missing.length > 0) {
      setError({ 
        message: `Vui lòng cấu hình các biến sau trong .env: ${missing.join(", ")}`, 
        isAuth: true 
      });
      return;
    }

    setStatus('syncing');
    try {
      const projectName = `Dự án ${new Date().toLocaleDateString()}`;
      const { folderId, sheetId } = await createProjectStructure(
        process.env.GOOGLE_ACCESS_TOKEN || "", 
        projectName, 
        process.env.GOOGLE_DRIVE_FOLDER_ID || 'root'
      );

      const newProj: Project = {
        id: crypto.randomUUID(),
        name: projectName,
        description: 'Tài liệu đồng bộ Google Cloud',
        template: DEFAULT_TEMPLATE,
        apis: [],
        updatedAt: Date.now(),
        cloudConfig: { 
          googleDriveFolderId: folderId, 
          googleSheetId: sheetId,
          autoSync: true 
        }
      };

      await syncProjectToSheet(process.env.GOOGLE_ACCESS_TOKEN || "", sheetId, newProj);
      const newProjectsList = [newProj, ...projects];
      setProjects(newProjectsList);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newProjectsList));
      setCurrentProjectId(newProj.id);
      setView('project-detail');
      setStatus('idle');
    } catch (err: any) {
      handleError(err);
    }
  };

  const handleGenerateFullDoc = async () => {
    if (!process.env.API_KEY) {
      setError({ message: "Thiếu API_KEY của Gemini trong cấu hình.", isAuth: true });
      return;
    }

    if (!currentProject || currentProject.apis.length === 0) return;
    setStatus('processing');
    try {
      const doc = await generateApiDoc(currentProject.apis, currentProject.template);
      setResult(doc);
      setStatus('completed');

      if (process.env.GOOGLE_ACCESS_TOKEN && currentProject.cloudConfig.googleDriveFolderId) {
        await uploadDocFile(
          process.env.GOOGLE_ACCESS_TOKEN,
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

  const missingKeys = getMissingKeys();

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
                  <Globe size={16} /> <span className="text-[10px] font-black uppercase tracking-tight">Cấu hình .env thành công</span>
               </div>
             ) : (
               <div className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 rounded-xl border border-red-100 animate-pulse">
                  <ShieldAlert size={16} /> <span className="text-[10px] font-black uppercase tracking-tight">LỖI KEY: THIẾU {missingKeys.join(", ")}</span>
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
                <h2 className="text-4xl font-black text-gray-900 tracking-tighter">Dự án của tôi</h2>
                <p className="text-slate-400 font-bold text-xs mt-1 uppercase tracking-widest">Excel-Powered API Documentation</p>
              </div>
              <button onClick={createProject} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-3xl font-black shadow-xl flex items-center gap-3 transition-all active:scale-95 disabled:opacity-50" disabled={status === 'syncing'}>
                {status === 'syncing' ? <Loader2 size={24} className="animate-spin" /> : <Plus size={24} />} Tạo Dự án Mới
              </button>
            </div>

            {missingKeys.length > 0 && (
              <div className="bg-red-50 border-2 border-red-200 p-8 rounded-[2.5rem] shadow-lg shadow-red-500/5 flex flex-col md:flex-row items-center gap-6">
                <div className="bg-red-100 p-4 rounded-3xl text-red-600">
                  <Terminal size={32} />
                </div>
                <div className="flex-1 text-center md:text-left">
                  <h4 className="font-black text-red-900 uppercase tracking-tight">CHƯA LOAD ĐƯỢC CẤU HÌNH .ENV</h4>
                  <p className="text-sm text-red-700/80 font-medium mt-1">
                    Hãy đảm bảo tên biến trong file <code className="bg-red-200/50 px-2 py-0.5 rounded">.env</code> khớp hoàn toàn với danh sách: {missingKeys.join(", ")}.
                    Sau khi sửa file, bạn **BẮT BUỘC** phải khởi động lại server dev trong Terminal.
                  </p>
                </div>
              </div>
            )}

            {projects.length === 0 ? (
              <div className="bg-white rounded-[3rem] p-20 border-4 border-dashed border-slate-100 flex flex-col items-center justify-center text-center">
                <Database size={64} className="text-slate-100 mb-6" />
                <h3 className="text-2xl font-black text-slate-300">Chưa có dự án nào</h3>
                <p className="text-slate-400 mt-2 max-w-sm font-medium leading-relaxed">Sẵn sàng tạo tài liệu API chuyên nghiệp và đồng bộ tự động lên Cloud.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {projects.map(p => (
                  <div key={p.id} onClick={() => { setCurrentProjectId(p.id); setView('project-detail'); }} className="group bg-white p-8 rounded-[2.5rem] border border-gray-200 shadow-sm hover:shadow-xl cursor-pointer transition-all">
                    <div className="bg-blue-50 p-4 rounded-3xl text-blue-600 w-fit mb-6 group-hover:bg-blue-600 group-hover:text-white transition-all"><Database size={24} /></div>
                    <h3 className="text-xl font-black text-gray-900 mb-2 truncate">{p.name}</h3>
                    <div className="flex items-center gap-2 text-emerald-500 text-[10px] font-black uppercase">
                      <Table size={12} /> Google Cloud Active
                    </div>
                  </div>
                ))}
              </div>
            )}
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
                }} className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-black text-sm flex items-center gap-2 shadow-xl shadow-blue-200"><Plus size={16} /> Thêm API</button>
              </div>
            </div>

            {showSyncSuccess && (
              <div className="bg-emerald-500 text-white p-4 rounded-2xl font-black text-center animate-bounce shadow-xl">
                 ĐỒNG BỘ THÀNH CÔNG VỚI GOOGLE DRIVE!
              </div>
            )}

            <div className="grid grid-cols-12 gap-8">
              <div className="col-span-8">
                {status === 'completed' ? <MarkdownPreview content={result} /> : (
                  <div className="bg-white rounded-[3rem] border border-slate-100 overflow-hidden shadow-sm min-h-[400px]">
                    <div className="px-8 py-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
                       <span className="font-black uppercase text-[10px] text-slate-400 tracking-widest flex items-center gap-2"><Table size={14} /> Dữ liệu từ Google Sheets</span>
                       <span className="text-[10px] font-bold text-emerald-500 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">Syncing...</span>
                    </div>
                    {currentProject.apis.length === 0 ? (
                      <div className="p-20 text-center flex flex-col items-center">
                        <Code2 size={48} className="text-slate-100 mb-4" />
                        <p className="text-slate-400 font-bold text-xs uppercase">Bắt đầu thiết kế API đầu tiên của bạn</p>
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
              <div className="col-span-4">
                <div className="bg-slate-900 p-8 rounded-[3rem] text-white shadow-2xl">
                  <h3 className="text-[10px] font-black uppercase text-blue-400 mb-6 tracking-widest">Mẫu Tài Liệu (.docx)</h3>
                  <button onClick={() => fileInputRef.current?.click()} className="w-full py-4 bg-blue-600 hover:bg-blue-700 rounded-2xl font-black text-xs flex items-center justify-center gap-2 mb-6 transition-all">
                    <UploadCloud size={18} /> Tải lên File Mẫu
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
                  <input className="text-2xl font-black outline-none bg-transparent" value={currentApi.name} onChange={e => {
                    const newApis = currentProject!.apis.map(a => a.id === currentApi.id ? { ...a, name: e.target.value } : a);
                    updateProjectAndCloud({ apis: newApis }, currentProject!.id);
                  }} />
                  <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                    <span className="font-black text-blue-600 uppercase">{currentApi.method}</span>
                    <span>{currentApi.endpoint}</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setView('project-detail')} className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-black text-xs shadow-xl active:scale-95 transition-all">LƯU & QUAY LẠI</button>
            </div>

            <div className="grid grid-cols-12 gap-8">
               <div className="col-span-8 space-y-8">
                 <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100">
                    <div className="flex justify-between items-center mb-10">
                      <h3 className="font-black text-slate-900 text-lg uppercase tracking-tight">Cấu trúc Request/Response</h3>
                      <div className="flex gap-2">
                        <button onClick={() => { setJsonModalType('request'); setIsJsonModalOpen(true); }} className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-[10px] font-black shadow-lg shadow-blue-200 flex items-center gap-2">
                          <Code2 size={14} /> NHẬP JSON REQUEST
                        </button>
                        <button onClick={() => { setJsonModalType('response'); setIsJsonModalOpen(true); }} className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-[10px] font-black shadow-lg shadow-emerald-200 flex items-center gap-2">
                          <Code2 size={14} /> NHẬP JSON RESPONSE
                        </button>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mô tả logic xử lý API</label>
                      <textarea 
                        className="w-full bg-slate-50 p-6 rounded-3xl border border-transparent focus:border-blue-100 outline-none transition-all text-sm h-32"
                        value={currentApi.description}
                        onChange={e => {
                           const newApis = currentProject!.apis.map(a => a.id === currentApi.id ? { ...a, description: e.target.value } : a);
                           updateProjectAndCloud({ apis: newApis }, currentProject!.id);
                        }}
                        placeholder="API này dùng để xử lý logic gì? (Nghiệp vụ, ràng buộc...)"
                      />
                    </div>
                 </div>
               </div>
               
               <div className="col-span-4">
                  <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 space-y-6">
                    <h3 className="font-black text-sm uppercase">Sơ đồ Sequence</h3>
                    {currentApi.sequenceDiagram ? (
                       <div className="relative group">
                         <img src={currentApi.sequenceDiagram} className="w-full rounded-2xl border" />
                         <button onClick={() => {
                            const newApis = currentProject!.apis.map(a => a.id === currentApi.id ? { ...a, sequenceDiagram: undefined } : a);
                            updateProjectAndCloud({ apis: newApis }, currentProject!.id);
                         }} className="absolute top-2 right-2 p-2 bg-red-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={16} /></button>
                       </div>
                    ) : (
                       <div onClick={() => diagramInputRef.current?.click()} className="border-4 border-dashed border-slate-50 rounded-3xl p-10 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition-all">
                          <ImageIcon size={32} className="text-slate-200 mb-2" />
                          <span className="text-[10px] font-black text-slate-300 uppercase">Tải lên sơ đồ ảnh</span>
                       </div>
                    )}
                  </div>
               </div>
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="bg-red-600 p-3 rounded-2xl shadow-lg shadow-red-500/30">
                  {error.isAuth ? <ShieldAlert size={24} /> : error.isCors ? <Globe size={24} /> : <AlertCircle size={24} />}
                </div>
                <div>
                  <p className="font-black uppercase text-[10px] tracking-widest text-red-500">
                    LỖI CẤU HÌNH .ENV
                  </p>
                  <p className="text-sm font-bold mt-1 leading-relaxed">{error.message}</p>
                </div>
              </div>
              <button onClick={() => setError(null)} className="p-2 hover:bg-white/10 rounded-full transition-all">
                <X size={20} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
