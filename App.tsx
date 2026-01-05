
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  FileText, Send, Loader2, Info, BookOpen, Layers, 
  UploadCloud, Plus, ChevronLeft, Trash2, Edit3, 
  Settings, Share2, Table, Cloud, CheckCircle, Database,
  ArrowLeft, HardDrive, ShieldCheck, Zap, RefreshCw, List,
  Upload, File, Save, ExternalLink, AlertCircle
} from 'lucide-react';
import { generateApiDoc } from './services/geminiService';
import { syncDatabaseToSheet, saveDocToDrive } from './services/googleDriveService';
import { extractDocumentText } from './services/documentService';
import { Project, ApiInfo, AppView, AppStatus, CloudConfig, GlobalConfig, ApiField } from './types';
import { DEFAULT_TEMPLATE, METHODS } from './constants';
import MarkdownPreview from './components/MarkdownPreview';

const STORAGE_KEY = 'api_doc_architect_data';
const CONFIG_KEY = 'api_doc_architect_config';

const App: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [globalConfig, setGlobalConfig] = useState<GlobalConfig>({
    defaultGoogleDriveFolderId: '',
    autoSaveToCloud: true
  });
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [currentApiId, setCurrentApiId] = useState<string | null>(null);
  const [view, setView] = useState<AppView>('dashboard');
  const [status, setStatus] = useState<AppStatus>('idle');
  const [result, setResult] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [showSyncSuccess, setShowSyncSuccess] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Persistence
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try { setProjects(JSON.parse(saved)); } catch (e) { console.error(e); }
    }
    const savedConfig = localStorage.getItem(CONFIG_KEY);
    if (savedConfig) {
      try { setGlobalConfig(JSON.parse(savedConfig)); } catch (e) { console.error(e); }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  }, [projects]);

  const currentProject = useMemo(() => projects.find(p => p.id === currentProjectId), [projects, currentProjectId]);
  const currentApi = useMemo(() => currentProject?.apis.find(a => a.id === currentApiId), [currentProject, currentApiId]);

  const createProject = () => {
    const newProj: Project = {
      id: crypto.randomUUID(),
      name: 'Tài liệu mới ' + (projects.length + 1),
      description: 'Dự án quản lý tập trung nhiều API',
      template: DEFAULT_TEMPLATE,
      apis: [],
      updatedAt: Date.now(),
      cloudConfig: { 
        googleDriveFolderId: globalConfig.defaultGoogleDriveFolderId || '', 
        autoSync: globalConfig.autoSaveToCloud 
      }
    };
    setProjects([...projects, newProj]);
    setCurrentProjectId(newProj.id);
    setView('project-detail');
  };

  const updateProject = (updates: Partial<Project>) => {
    if (!currentProjectId) return;
    setProjects(projects.map(p => p.id === currentProjectId ? { ...p, ...updates, updatedAt: Date.now() } : p));
  };

  const updateApiField = (apiId: string, updates: Partial<ApiInfo>) => {
    if (!currentProject) return;
    updateProject({ apis: currentProject.apis.map(a => a.id === apiId ? { ...a, ...updates } : a) });
  };

  const handleTemplateUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentProject) return;

    setIsExtracting(true);
    setError(null);
    try {
      const text = await extractDocumentText(file);
      updateProject({ template: text });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsExtracting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleGenerate = async () => {
    if (!currentApi || !currentProject) return;
    setStatus('processing');
    setError(null);
    try {
      const doc = await generateApiDoc(currentApi, currentProject.template);
      setResult(doc);
      setStatus('completed');
    } catch (err: any) {
      setError(err.message);
      setStatus('error');
    }
  };

  // Hàm trích xuất bảng từ JSON thông minh hơn
  const extractTableFromJson = (jsonStr: string, fieldType: 'input' | 'output') => {
    if (!currentApi) return;
    setError(null);
    try {
      // 1. Làm sạch JSON thô
      let cleaned = jsonStr
        .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"') // Sửa smart quotes
        .replace(/,(\s*[}\]])/g, '$1') // Xóa trailing commas
        .trim();

      const obj = JSON.parse(cleaned);
      const fields: ApiField[] = [];

      const flatten = (data: any, prefix = '') => {
        if (data === null) return;
        
        // Trường hợp là mảng
        if (Array.isArray(data)) {
          if (data.length > 0) flatten(data[0], prefix);
          return;
        }

        // Trường hợp là object
        if (typeof data === 'object') {
          Object.keys(data).forEach(key => {
            const val = data[key];
            const name = prefix ? `${prefix}.${key}` : key;
            
            let type = 'String';
            if (val === null) type = 'Nullable/Any';
            else if (typeof val === 'number') type = Number.isInteger(val) ? 'Integer' : 'Number';
            else if (typeof val === 'boolean') type = 'Boolean';
            else if (Array.isArray(val)) type = 'Array';
            else if (typeof val === 'object') type = 'Object';

            fields.push({
              name,
              type,
              required: true,
              description: ''
            });

            // Đệ quy nếu lồng nhau
            if (val !== null && typeof val === 'object') {
              flatten(val, name);
            }
          });
        }
      };

      flatten(obj);
      
      if (fields.length === 0) throw new Error("JSON hợp lệ nhưng không tìm thấy trường dữ liệu.");

      if (fieldType === 'input') updateApiField(currentApi.id, { inputParams: fields });
      else updateApiField(currentApi.id, { outputParams: fields });

    } catch (e: any) {
      setError("Lỗi JSON: " + e.message);
    }
  };

  const handleSaveToCloudDoc = async () => {
    const folderId = currentProject?.cloudConfig?.googleDriveFolderId || globalConfig.defaultGoogleDriveFolderId;
    if (!currentProject || !currentApi || !result) return;
    if (!folderId) {
      setError("Vui lòng nhập Folder ID trong phần cài đặt trước khi lưu.");
      return;
    }
    setStatus('syncing');
    try {
      await saveDocToDrive(folderId, currentApi.name, result);
      setStatus('completed');
      setShowSyncSuccess(true);
      setTimeout(() => setShowSyncSuccess(false), 3000);
    } catch (err: any) {
      setError("Lỗi khi lưu vào Google Docs.");
      setStatus('completed');
    }
  };

  const handleSyncDatabase = async () => {
    const folderId = currentProject?.cloudConfig?.googleDriveFolderId || globalConfig.defaultGoogleDriveFolderId;
    if (!currentProject || !folderId) {
      setError("Vui lòng cấu hình Google Drive Folder ID.");
      return;
    }
    setStatus('syncing');
    try {
      // Giả lập đồng bộ toàn bộ API của dự án vào 1 file Excel tập trung
      await syncDatabaseToSheet(folderId, currentProject.name, currentProject.apis);
      setStatus('completed');
      setShowSyncSuccess(true);
      setTimeout(() => setShowSyncSuccess(false), 3000);
    } catch (err: any) {
      setError("Lỗi khi đồng bộ Excel.");
      setStatus('completed');
    }
  };

  // --- Views Components ---

  const DashboardView = () => (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-black text-gray-900 tracking-tighter">Kho tài liệu API</h2>
          <p className="text-gray-500 font-bold mt-2 uppercase tracking-widest text-[10px]">Quản lý {projects.length} dự án kỹ thuật</p>
        </div>
        <button onClick={createProject} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-3xl font-black shadow-2xl flex items-center gap-3 transition-all active:scale-95">
          <Plus size={24} /> Tạo dự án mới
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map(project => (
          <div key={project.id} onClick={() => { setCurrentProjectId(project.id); setView('project-detail'); }}
            className="group bg-white p-8 rounded-[2.5rem] border border-gray-200 shadow-sm hover:shadow-2xl hover:border-blue-400 transition-all cursor-pointer relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 opacity-5"><BookOpen size={80} /></div>
            <div className="flex items-start justify-between mb-6">
              <div className="bg-blue-50 p-4 rounded-3xl text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <Database size={24} />
              </div>
              <button onClick={(e) => { e.stopPropagation(); if(confirm('Xóa dự án?')) setProjects(projects.filter(p => p.id !== project.id)); }} className="text-gray-300 hover:text-red-500"><Trash2 size={20} /></button>
            </div>
            <h3 className="text-xl font-black text-gray-900 group-hover:text-blue-600 transition-colors">{project.name}</h3>
            <p className="text-gray-400 text-sm mt-2 line-clamp-2">{project.description}</p>
            <div className="mt-8 pt-6 border-t border-gray-50 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-gray-400">
               <span className="flex items-center gap-1"><List size={14} /> {project.apis.length} APIs</span>
               <span className="flex items-center gap-1 text-emerald-500"><Cloud size={14} /> Drive Linked</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const ProjectDetailView = () => (
    <div className="space-y-6 animate-in slide-in-from-right duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => setView('dashboard')} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 transition-colors"><ChevronLeft size={24} /></button>
          <div>
            <h2 className="text-2xl font-black text-gray-900">{currentProject?.name}</h2>
            <div className="flex items-center gap-2 mt-1">
               <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-black uppercase">{currentProject?.apis.length} Endpoint</span>
               <span className="text-[10px] text-gray-400 font-bold">Cập nhật: {new Date(currentProject?.updatedAt || 0).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
           <button onClick={handleSyncDatabase} disabled={status === 'syncing'} className="px-5 py-3 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-emerald-100 transition-all flex items-center gap-2 shadow-sm">
             {status === 'syncing' ? <Loader2 size={16} className="animate-spin" /> : <Table size={16} />} Đồng bộ Excel (DB)
           </button>
           <button onClick={() => { 
             const newApi: ApiInfo = { id: crypto.randomUUID(), name: 'API mới', method: 'GET', endpoint: '/api/v1/resource', authType: 'Bearer Token', requestBody: '{}', responseBody: '{}', inputParams: [], outputParams: [] };
             updateProject({ apis: [...(currentProject?.apis || []), newApi] });
             setCurrentApiId(newApi.id); setView('api-edit');
           }} className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-black text-sm shadow-xl hover:bg-blue-700 transition-all flex items-center gap-2">
             <Plus size={16} /> Thêm API
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8">
          <div className="bg-white border border-gray-200 rounded-[2.5rem] overflow-hidden shadow-sm">
            <div className="px-8 py-6 border-b border-gray-100 bg-gray-50/30">
               <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest">Danh sách Endpoint</h3>
            </div>
            <div className="divide-y divide-gray-100">
               {currentProject?.apis.length === 0 ? (
                 <div className="p-20 text-center text-gray-400 italic">Dự án trống. Hãy thêm API đầu tiên!</div>
               ) : (
                 currentProject?.apis.map(api => (
                   <div key={api.id} onClick={() => { setCurrentApiId(api.id); setView('api-edit'); }} className="group px-8 py-6 hover:bg-blue-50/50 cursor-pointer transition-all flex items-center gap-6">
                      <div className={`w-16 h-8 flex items-center justify-center rounded-xl text-[10px] font-black uppercase shadow-sm ${api.method === 'GET' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-600 text-white'}`}>{api.method}</div>
                      <div className="flex-1 min-w-0">
                         <h4 className="text-base font-bold text-gray-800 truncate group-hover:text-blue-600 transition-colors">{api.name}</h4>
                         <p className="text-xs font-mono text-gray-400 mt-1 truncate">{api.endpoint}</p>
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                        <button onClick={(e) => { e.stopPropagation(); setCurrentApiId(api.id); setView('api-edit'); }} className="p-2 bg-white rounded-lg border text-gray-400 hover:text-blue-600 shadow-sm"><Edit3 size={16} /></button>
                        <button onClick={(e) => { e.stopPropagation(); if(confirm('Xóa API?')) updateProject({ apis: currentProject.apis.filter(a => a.id !== api.id) }); }} className="p-2 bg-white rounded-lg border text-gray-400 hover:text-red-500 shadow-sm"><Trash2 size={16} /></button>
                      </div>
                   </div>
                 ))
               )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
           <div className="bg-slate-900 p-8 rounded-[3rem] text-white shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-10"><FileText size={120} /></div>
              <div className="relative z-10 space-y-5">
                 <div className="flex justify-between items-center">
                    <h3 className="text-xs font-black uppercase tracking-widest text-blue-400">File Mẫu (Template)</h3>
                    {isExtracting && <Loader2 size={16} className="animate-spin text-blue-400" />}
                 </div>
                 <p className="text-[11px] text-slate-400 leading-relaxed font-medium">Tải lên file Word (.docx) chứa cấu trúc tài liệu của công ty bạn. AI sẽ tự động "điền vào chỗ trống".</p>
                 <button onClick={() => fileInputRef.current?.click()} className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all">
                    <UploadCloud size={18} /> Upload Mẫu DOCX/PDF
                 </button>
                 <textarea className="w-full h-48 bg-slate-800 border border-slate-700 rounded-2xl p-4 text-[10px] font-mono text-blue-200 outline-none focus:ring-1 ring-blue-500" value={currentProject?.template} onChange={e => updateProject({ template: e.target.value })} placeholder="Nội dung file mẫu trích xuất..." />
              </div>
           </div>

           <div className="bg-white p-8 rounded-[2.5rem] border border-gray-200 shadow-sm space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-gray-500">Cấu hình Drive</h3>
              <input className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm outline-none focus:ring-2 ring-blue-500" placeholder="Folder ID dự án..." value={currentProject?.cloudConfig?.googleDriveFolderId || ''} onChange={e => updateProject({ cloudConfig: { ...(currentProject?.cloudConfig || { googleDriveFolderId: '', autoSync: true }), googleDriveFolderId: e.target.value } })} />
              <p className="text-[9px] text-gray-400 italic">* Các file Word/Excel sẽ tự động tạo trong folder này.</p>
           </div>
        </div>
      </div>
    </div>
  );

  const ApiEditView = () => {
    if (!currentApi) return null;
    return (
      <div className="space-y-6 animate-in slide-in-from-right duration-300 pb-12">
        <div className="flex items-center gap-4">
          <button onClick={() => setView('project-detail')} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 transition-colors"><ChevronLeft size={24} /></button>
          <div className="flex-1">
            <h2 className="text-xl font-black text-gray-900 leading-none">{currentApi.name}</h2>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-2">{currentApi.method} &bull; {currentApi.endpoint}</p>
          </div>
          <button onClick={handleGenerate} disabled={status === 'processing'} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-2xl font-black shadow-xl shadow-blue-200 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50">
            {status === 'processing' ? <Loader2 className="animate-spin" size={20} /> : <Zap size={20} />}
            AI VIẾT TÀI LIỆU
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-8 overflow-y-auto max-h-[calc(100vh-200px)] pr-2 doc-scroll">
            {/* Request Section */}
            <div className="bg-white p-8 rounded-[2.5rem] border border-gray-200 shadow-sm space-y-5">
               <div className="flex justify-between items-center">
                  <h3 className="text-xs font-black uppercase tracking-widest text-gray-800">Request Body (JSON)</h3>
                  <button onClick={() => extractTableFromJson(currentApi.requestBody, 'input')} className="text-[10px] font-black uppercase text-blue-600 bg-blue-50 px-3 py-1.5 rounded-xl hover:bg-blue-100 transition-all flex items-center gap-1">
                     <Table size={14} /> Trích xuất tham số
                  </button>
               </div>
               <textarea className="w-full h-48 p-4 bg-slate-900 text-blue-100 font-mono text-xs rounded-2xl outline-none focus:ring-2 ring-blue-500 shadow-inner" value={currentApi.requestBody} onChange={e => updateApiField(currentApi.id, { requestBody: e.target.value })} placeholder="Dán JSON từ log/debug vào đây..." />
            </div>

            {/* Response Section */}
            <div className="bg-white p-8 rounded-[2.5rem] border border-gray-200 shadow-sm space-y-5">
               <div className="flex justify-between items-center">
                  <h3 className="text-xs font-black uppercase tracking-widest text-gray-800">Response Body (JSON)</h3>
                  <button onClick={() => extractTableFromJson(currentApi.responseBody, 'output')} className="text-[10px] font-black uppercase text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-xl hover:bg-emerald-100 transition-all flex items-center gap-1">
                     <Table size={14} /> Trích xuất tham số
                  </button>
               </div>
               <textarea className="w-full h-48 p-4 bg-slate-900 text-emerald-100 font-mono text-xs rounded-2xl outline-none focus:ring-2 ring-emerald-500 shadow-inner" value={currentApi.responseBody} onChange={e => updateApiField(currentApi.id, { responseBody: e.target.value })} placeholder="Dán JSON kết quả trả về..." />
            </div>

            {/* Params Tables (Chỉ hiện khi có dữ liệu) */}
            {(currentApi.inputParams.length > 0 || currentApi.outputParams.length > 0) && (
              <div className="bg-white p-6 rounded-[2rem] border border-gray-200 shadow-sm space-y-6">
                 <h3 className="text-xs font-black uppercase tracking-widest text-gray-500">Bảng tham số kỹ thuật</h3>
                 <div className="space-y-4">
                    {currentApi.inputParams.length > 0 && (
                      <div className="border rounded-2xl overflow-hidden">
                        <div className="bg-blue-600 px-4 py-2 text-[10px] font-black text-white uppercase tracking-widest">Input Parameters</div>
                        <table className="w-full text-xs text-left">
                           <thead className="bg-gray-50 font-bold border-b">
                              <tr><th className="px-4 py-2">Trường</th><th className="px-4 py-2">Kiểu</th><th className="px-4 py-2">Mô tả</th></tr>
                           </thead>
                           <tbody className="divide-y divide-gray-50">
                              {currentApi.inputParams.map((p, i) => (
                                <tr key={i}><td className="px-4 py-2 font-mono text-blue-600">{p.name}</td><td className="px-4 py-2 text-gray-400">{p.type}</td><td className="px-4 py-2 italic text-gray-500">Auto-filled</td></tr>
                              ))}
                           </tbody>
                        </table>
                      </div>
                    )}
                 </div>
              </div>
            )}
          </div>

          <div className="h-full sticky top-24">
            {status === 'completed' ? (
              <MarkdownPreview content={result} onSaveToDrive={handleSaveToCloudDoc} isSyncing={status === 'syncing'} />
            ) : status === 'processing' ? (
              <div className="h-full min-h-[500px] bg-white border border-gray-200 rounded-[2.5rem] flex flex-col items-center justify-center p-12 text-center animate-pulse shadow-sm">
                 <Loader2 size={64} className="text-blue-600 animate-spin mb-8" />
                 <h3 className="text-2xl font-black text-gray-800 tracking-tight italic">Gemini AI đang viết...</h3>
                 <p className="text-gray-500 mt-2 font-medium">Đang trích xuất cấu trúc từ file mẫu và kết hợp với dữ liệu JSON của bạn.</p>
              </div>
            ) : (
              <div className="h-full min-h-[500px] bg-slate-100 border-2 border-dashed border-slate-300 rounded-[2.5rem] flex flex-col items-center justify-center p-12 text-center">
                 <div className="w-24 h-24 bg-white rounded-3xl shadow-xl flex items-center justify-center mb-8"><FileText size={48} className="text-blue-200" /></div>
                 <h3 className="text-xl font-bold text-slate-400">Xem trước tài liệu Word</h3>
                 <p className="text-slate-300 text-sm mt-2 max-w-xs font-medium">Sau khi nhấn nút, AI sẽ tự động điền các bảng và thông tin API vào file mẫu kỹ thuật.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const SettingsView = () => (
    <div className="max-w-2xl mx-auto space-y-8 animate-in slide-in-from-bottom-8 duration-500">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => setView('dashboard')} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 transition-colors"><ChevronLeft size={24} /></button>
        <h2 className="text-3xl font-black text-gray-900 tracking-tighter">Cấu hình Drive tập trung</h2>
      </div>
      <div className="bg-white p-10 rounded-[3rem] border border-gray-200 shadow-xl space-y-10">
        <div className="space-y-6">
          <label className="text-xs font-black text-gray-400 uppercase tracking-widest block">Root Google Drive Folder ID</label>
          <input className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 ring-blue-500 font-mono text-sm" value={globalConfig.defaultGoogleDriveFolderId} onChange={e => { const c = {...globalConfig, defaultGoogleDriveFolderId: e.target.value}; setGlobalConfig(c); localStorage.setItem(CONFIG_KEY, JSON.stringify(c)); }} placeholder="ID của thư mục mẹ trên Drive..." />
          <div className="flex items-center gap-4 p-5 bg-blue-50 rounded-2xl border border-blue-100">
             <AlertCircle size={20} className="text-blue-600" />
             <p className="text-xs text-blue-700 font-bold leading-relaxed">Khi Folder ID được cấu hình, hệ thống sẽ tự động tạo cấu trúc: <br/> [Tên Dự Án] / [API]_Doc.docx & DB_Export.xlsx</p>
          </div>
        </div>
        <button onClick={() => setView('dashboard')} className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl shadow-xl hover:bg-black transition-all">LƯU CÀI ĐẶT</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900">
      <header className="bg-white/80 backdrop-blur-xl border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-18 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setView('dashboard')}>
            <div className="bg-gradient-to-tr from-blue-600 to-indigo-700 p-2.5 rounded-2xl text-white shadow-xl shadow-blue-500/20"><Zap size={22} /></div>
            <h1 className="text-xl font-black tracking-tighter uppercase">API Architect <span className="text-blue-600">AI</span></h1>
          </div>
          <div className="flex items-center gap-3">
             <button onClick={() => setView('dashboard')} className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${view === 'dashboard' ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:bg-gray-100'}`}>Dự án</button>
             <button onClick={() => setView('settings')} className={`p-2.5 rounded-xl transition-all ${view === 'settings' ? 'bg-slate-900 text-white shadow-xl' : 'text-gray-400 hover:bg-gray-100'}`}><Settings size={22} /></button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10 min-h-[calc(100vh-72px)]">
        {view === 'dashboard' && <DashboardView />}
        {view === 'project-detail' && <ProjectDetailView />}
        {view === 'api-edit' && <ApiEditView />}
        {view === 'settings' && <SettingsView />}
      </main>

      {showSyncSuccess && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-8 py-5 rounded-[2.5rem] shadow-2xl flex items-center gap-4 z-[100] animate-in slide-in-from-bottom-10">
          <div className="bg-emerald-500 p-2 rounded-full"><CheckCircle size={22} /></div>
          <div><p className="font-black text-sm leading-none">Đã lưu lên Cloud!</p><p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mt-1.5">File của bạn đã sẵn sàng trên Google Drive</p></div>
        </div>
      )}

      {error && (
        <div className="fixed bottom-10 right-10 bg-red-600 text-white p-6 rounded-[2rem] shadow-2xl flex items-center gap-4 z-[100] animate-bounce max-w-sm">
          <AlertCircle size={28} />
          <div><p className="font-black leading-none">Cảnh báo dữ liệu</p><p className="text-xs opacity-90 mt-1.5 font-bold">{error}</p></div>
          <button onClick={() => setError(null)} className="ml-4 font-black text-xl hover:scale-110 transition-transform">×</button>
        </div>
      )}
      <input type="file" ref={fileInputRef} onChange={handleTemplateUpload} className="hidden" accept=".docx,.pdf,.md,.txt" />
    </div>
  );
};

export default App;
