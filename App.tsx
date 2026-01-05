
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  FileText, Send, Loader2, Info, BookOpen, Layers, 
  UploadCloud, Plus, ChevronLeft, Trash2, Edit3, 
  Settings, Share2, Table, Cloud, CheckCircle, Database,
  ArrowLeft, HardDrive, ShieldCheck, Zap, RefreshCw, List,
  Upload, File
} from 'lucide-react';
import { generateApiDoc } from './services/geminiService';
import { uploadToDrive, syncToGoogleSheet } from './services/googleDriveService';
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
    autoSaveToCloud: false
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

  useEffect(() => {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(globalConfig));
  }, [globalConfig]);

  const currentProject = useMemo(() => projects.find(p => p.id === currentProjectId), [projects, currentProjectId]);
  const currentApi = useMemo(() => currentProject?.apis.find(a => a.id === currentApiId), [currentProject, currentApiId]);

  const createProject = () => {
    const newProj: Project = {
      id: crypto.randomUUID(),
      name: 'Tài liệu mới ' + (projects.length + 1),
      description: 'Mô tả ngắn về dự án',
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

  const updateCloudConfig = (config: Partial<CloudConfig>) => {
    if (!currentProject) return;
    updateProject({ cloudConfig: { ...(currentProject.cloudConfig || { googleDriveFolderId: '', autoSync: false }), ...config } });
  };

  const updateApiField = (apiId: string, updates: Partial<ApiInfo>) => {
    if (!currentProject) return;
    updateProject({ apis: currentProject.apis.map(a => a.id === apiId ? { ...a, ...updates } : a) });
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

  const handleSaveToDrive = async () => {
    const folderId = currentProject?.cloudConfig?.googleDriveFolderId || globalConfig.defaultGoogleDriveFolderId;
    if (!currentProject || !currentApi || !result) return;
    if (!folderId) {
      setError("Vui lòng cấu hình Google Drive Folder ID.");
      return;
    }
    setStatus('syncing');
    try {
      await uploadToDrive(folderId, `API_${currentApi.name.replace(/\s+/g, '_')}.md`, result, 'text/markdown');
      setStatus('completed');
      setShowSyncSuccess(true);
      setTimeout(() => setShowSyncSuccess(false), 3000);
    } catch (err: any) {
      setError("Lỗi khi tải lên Google Drive.");
      setStatus('completed');
    }
  };

  const handleSyncToSheets = async () => {
    const folderId = currentProject?.cloudConfig?.googleDriveFolderId || globalConfig.defaultGoogleDriveFolderId;
    if (!currentProject) return;
    if (!folderId) {
      setError("Vui lòng cấu hình Google Drive Folder ID.");
      return;
    }
    setStatus('syncing');
    try {
      await syncToGoogleSheet(folderId, currentProject.name, currentProject.apis);
      setStatus('completed');
      setShowSyncSuccess(true);
      setTimeout(() => setShowSyncSuccess(false), 3000);
    } catch (err: any) {
      setError("Lỗi khi đồng bộ Google Sheets.");
      setStatus('completed');
    }
  };

  const handleTemplateUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsExtracting(true);
    setError(null);
    try {
      const text = await extractDocumentText(file);
      if (currentProjectId) {
        updateProject({ template: text });
      }
    } catch (err: any) {
      setError(err.message || "Lỗi khi xử lý file mẫu.");
    } finally {
      setIsExtracting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  /**
   * Cải thiện hàm parse JSON:
   * 1. Xử lý smart quotes.
   * 2. Xử lý dấu phẩy thừa.
   * 3. Phân tích đệ quy chính xác hơn cho null và root arrays.
   */
  const parseJsonToFields = (jsonStr: string): ApiField[] => {
    if (!jsonStr.trim()) return [];
    
    try {
      // 1. Dọn dẹp JSON "xấu"
      let cleanedJson = jsonStr
        .replace(/[\u201C\u201D]/g, '"') // Sửa smart quotes
        .replace(/,\s*([}\]])/g, '$1') // Xóa trailing commas (dấu phẩy thừa trước } hoặc ])
        .trim();

      const obj = JSON.parse(cleanedJson);
      const fields: ApiField[] = [];
      
      const flatten = (data: any, prefix = '') => {
        // Nếu data là array, lấy item đầu tiên để mẫu cấu trúc
        if (Array.isArray(data)) {
          if (data.length > 0) {
            flatten(data[0], prefix);
          }
          return;
        }

        if (typeof data !== 'object' || data === null) return;
        
        Object.keys(data).forEach(key => {
          const val = data[key];
          const name = prefix ? `${prefix}.${key}` : key;
          let type = 'String';
          
          if (val === null) type = 'Any/Null';
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

          // Tiếp tục đệ quy nếu là object (không phải null)
          if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
            flatten(val, name);
          }
          // Nếu là mảng của các object, cũng lấy mẫu cấu trúc bên trong
          if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'object' && val[0] !== null) {
            flatten(val[0], name);
          }
        });
      };

      flatten(obj);
      return fields;
    } catch (e: any) {
      console.error("JSON Parse Error:", e);
      throw new Error(`Định dạng JSON không đúng: ${e.message}`);
    }
  };

  const generateTableFromRequest = () => {
    if (!currentApi) return;
    try {
      const fields = parseJsonToFields(currentApi.requestBody);
      if (fields.length > 0) {
        updateApiField(currentApi.id, { inputParams: fields });
      } else {
        setError("JSON Request hợp lệ nhưng không tìm thấy trường dữ liệu nào để trích xuất.");
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  const generateTableFromResponse = () => {
    if (!currentApi) return;
    try {
      const fields = parseJsonToFields(currentApi.responseBody);
      if (fields.length > 0) {
        updateApiField(currentApi.id, { outputParams: fields });
      } else {
        setError("JSON Response hợp lệ nhưng không tìm thấy trường dữ liệu nào để trích xuất.");
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  // --- Views ---

  const SettingsView = () => (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4">
        <button onClick={() => setView('dashboard')} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-600">
          <ArrowLeft size={24} />
        </button>
        <div>
          <h2 className="text-3xl font-extrabold text-gray-900">Cấu hình hệ thống</h2>
          <p className="text-gray-500">Quản lý cài đặt lưu trữ tập trung và mặc định</p>
        </div>
      </div>
      <div className="bg-white rounded-3xl border border-gray-200 shadow-xl overflow-hidden p-8 space-y-6">
        <section className="space-y-4">
          <div className="flex items-center gap-3 text-blue-600 font-bold">
            <HardDrive size={24} />
            <h3>Lưu trữ Google Drive</h3>
          </div>
          <div className="space-y-4">
            <label className="block text-sm font-bold text-gray-700">Mã Folder ID Tập Trung</label>
            <input
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 ring-blue-500 transition-all"
              value={globalConfig.defaultGoogleDriveFolderId}
              onChange={e => setGlobalConfig({...globalConfig, defaultGoogleDriveFolderId: e.target.value})}
            />
          </div>
        </section>
        <button onClick={() => setView('dashboard')} className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg hover:bg-blue-700 transition-all">Lưu cài đặt</button>
      </div>
    </div>
  );

  const DashboardView = () => (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-extrabold text-gray-900">Dự án tài liệu</h2>
          <p className="text-gray-500 mt-1">Quản lý kho tài liệu API tập trung</p>
        </div>
        <button onClick={createProject} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-md">
          <Plus size={20} /> Tạo mới
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.length === 0 ? (
          <div onClick={createProject} className="col-span-full py-20 border-2 border-dashed border-gray-200 rounded-3xl flex flex-col items-center justify-center text-gray-400 hover:bg-white cursor-pointer transition-all">
            <Database size={48} className="mb-4 opacity-20" />
            <p className="font-bold">Chưa có dự án nào. Bấm để tạo mới!</p>
          </div>
        ) : (
          projects.map(project => (
            <div key={project.id} onClick={() => { setCurrentProjectId(project.id); setView('project-detail'); }}
                className="group bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-xl cursor-pointer transition-all relative">
              <div className="p-3 bg-blue-50 rounded-xl text-blue-600 w-fit mb-4 group-hover:bg-blue-600 group-hover:text-white transition-all"><Database size={24} /></div>
              <h3 className="text-lg font-bold text-gray-900 group-hover:text-blue-600">{project.name}</h3>
              <div className="flex justify-between items-center mt-6 text-xs text-gray-400 font-bold uppercase tracking-wider">
                 <span>{project.apis.length} APIs</span>
                 <div className="flex items-center gap-1"><Cloud size={14} className={project.cloudConfig?.googleDriveFolderId ? 'text-green-500' : 'text-gray-300'} /> Drive</div>
              </div>
              <button onClick={(e) => { e.stopPropagation(); if(confirm('Xóa?')) setProjects(projects.filter(p => p.id !== project.id)); }} className="absolute top-4 right-4 text-gray-300 hover:text-red-500 p-2"><Trash2 size={16} /></button>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const ProjectDetailView = () => (
    <div className="space-y-6 animate-in slide-in-from-right duration-300">
      <div className="flex items-center gap-4">
        <button onClick={() => setView('dashboard')} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 transition-colors"><ChevronLeft size={24} /></button>
        <h2 className="text-2xl font-black text-gray-900 flex-1">{currentProject?.name}</h2>
        <button onClick={() => { 
           const newApi: ApiInfo = {
             id: crypto.randomUUID(), name: 'API mới', method: 'GET', endpoint: '/api/v1/resource',
             authType: 'Token Authentication', requestBody: '{}', responseBody: '{}',
             inputParams: [], outputParams: []
           };
           updateProject({ apis: [...(currentProject?.apis || []), newApi] });
           setCurrentApiId(newApi.id); setView('api-edit');
        }} className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-md flex items-center gap-2 hover:bg-blue-700 transition-all">
          <Plus size={16} /> Thêm API
        </button>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8">
          <div className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-sm">
            <table className="w-full text-left">
              <thead className="bg-gray-50/50 text-[10px] font-black uppercase text-gray-400 tracking-widest">
                <tr><th className="px-6 py-4">Method</th><th className="px-6 py-4">Endpoint</th><th className="px-6 py-4">Name</th><th className="px-6 py-4"></th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {currentProject?.apis.length === 0 ? (
                  <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-400 text-sm italic">Chưa có API nào.</td></tr>
                ) : (
                  currentProject?.apis.map(api => (
                    <tr key={api.id} onClick={() => { setCurrentApiId(api.id); setView('api-edit'); }} className="hover:bg-blue-50/30 cursor-pointer transition-all group">
                      <td className="px-6 py-4"><span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-black rounded uppercase">{api.method}</span></td>
                      <td className="px-6 py-4 text-sm font-mono text-gray-500">{api.endpoint}</td>
                      <td className="px-6 py-4 text-sm font-bold text-gray-800 group-hover:text-blue-600">{api.name}</td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={(e) => { e.stopPropagation(); updateProject({ apis: currentProject.apis.filter(a => a.id !== api.id) }); }} className="text-gray-300 hover:text-red-500 p-2"><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <div className="bg-slate-900 p-6 rounded-3xl text-white shadow-xl space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2 text-blue-400">
                <BookOpen size={18} />
                <h3 className="font-bold uppercase tracking-widest text-xs">Mẫu Tài Liệu Gốc</h3>
              </div>
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isExtracting}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-blue-400 rounded-lg transition-all disabled:opacity-50 flex items-center gap-1"
                title="Tải lên mẫu (.docx, .pdf, .md, .txt)"
              >
                {isExtracting ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleTemplateUpload} 
                className="hidden" 
                accept=".docx,.pdf,.md,.txt"
              />
            </div>
            <div className="bg-blue-500/10 p-4 rounded-xl border border-blue-500/20">
               <p className="text-[10px] text-blue-300 leading-relaxed italic">
                AI sẽ trích xuất cấu trúc từ file bạn tải lên (DOCX/PDF) và chỉ chỉnh sửa phần chi tiết API. Bạn có thể sử dụng các thẻ: {'{{API_NAME}}'}, {'{{ENDPOINT}}'}, v.v.
               </p>
            </div>
            <textarea
              className="w-full h-80 bg-slate-800 border border-slate-700 rounded-2xl p-4 text-xs font-mono focus:ring-1 ring-blue-500 outline-none text-blue-100"
              value={currentProject?.template}
              onChange={e => updateProject({ template: e.target.value })}
              placeholder="Nội dung file mẫu sẽ xuất hiện ở đây sau khi upload..."
            />
          </div>
          
          <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-4">
            <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest flex items-center gap-2"><Cloud size={18} className="text-blue-600" /> Lưu trữ Cloud</h3>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase">Folder ID (Dự án này)</label>
              <input 
                className="w-full mt-1 px-3 py-2 border rounded-xl text-sm bg-gray-50 outline-none focus:ring-2 ring-blue-500 transition-all"
                placeholder={globalConfig.defaultGoogleDriveFolderId || "Nhập Drive Folder ID..."}
                value={currentProject?.cloudConfig?.googleDriveFolderId || ''}
                onChange={e => updateCloudConfig({ googleDriveFolderId: e.target.value })}
              />
            </div>
            <button 
              onClick={handleSyncToSheets}
              className="w-full py-2.5 bg-emerald-600 text-white font-bold rounded-xl shadow-md hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 text-xs"
            >
              <Table size={14} /> Đồng bộ Google Sheets
            </button>
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
            <h2 className="text-xl font-black text-gray-900">{currentApi.name}</h2>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">{currentApi.method} &rsaquo; {currentApi.endpoint}</p>
          </div>
          <button onClick={handleGenerate} disabled={status === 'processing'} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-2xl font-bold shadow-xl shadow-blue-200 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50">
            {status === 'processing' ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
            Viết tài liệu AI
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-8 overflow-y-auto max-h-[calc(100vh-200px)] pr-2 scrollbar-hide">
            <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-4">
               <h3 className="text-sm font-black text-gray-800 flex items-center gap-2 uppercase tracking-widest"><Settings size={16} className="text-blue-600"/> Cấu hình chung</h3>
               <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase">Tên API</label>
                    <input className="w-full mt-1 px-3 py-2 border rounded-xl text-sm outline-none bg-gray-50 focus:ring-2 ring-blue-500 transition-all" value={currentApi.name} onChange={e => updateApiField(currentApi.id, { name: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase">Xác thực</label>
                    <input className="w-full mt-1 px-3 py-2 border rounded-xl text-sm outline-none bg-gray-50 focus:ring-2 ring-blue-500 transition-all" value={currentApi.authType} onChange={e => updateApiField(currentApi.id, { authType: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase">Phương thức</label>
                    <select className="w-full mt-1 px-3 py-2 border rounded-xl text-sm outline-none bg-gray-50 transition-all" value={currentApi.method} onChange={e => updateApiField(currentApi.id, { method: e.target.value })}>
                      {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase">Đường dẫn</label>
                    <input className="w-full mt-1 px-3 py-2 border rounded-xl text-sm font-mono outline-none bg-gray-50 focus:ring-2 ring-blue-500 transition-all" value={currentApi.endpoint} onChange={e => updateApiField(currentApi.id, { endpoint: e.target.value })} />
                  </div>
               </div>
            </div>

            <div className="space-y-4">
               <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-black text-gray-800 flex items-center gap-2 uppercase tracking-widest"><RefreshCw size={16} className="text-blue-600"/> Request JSON</h3>
                    <button onClick={generateTableFromRequest} className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-all flex items-center gap-1">
                       <Table size={14} /> Trích xuất tham số
                    </button>
                  </div>
                  <textarea className="w-full h-32 p-3 border rounded-2xl bg-slate-900 text-slate-100 font-mono text-xs focus:ring-2 ring-blue-500 outline-none shadow-inner" value={currentApi.requestBody} onChange={e => updateApiField(currentApi.id, { requestBody: e.target.value })} />
               </div>

               {currentApi.inputParams.length > 0 && (
                  <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="bg-blue-900 px-6 py-3 flex justify-between items-center">
                       <h4 className="text-xs font-black text-white uppercase tracking-widest">Bảng tham số Input</h4>
                       <button onClick={() => updateApiField(currentApi.id, { inputParams: [...currentApi.inputParams, { name: '', type: 'String', required: false, description: '' }] })} className="text-white hover:bg-white/10 p-1 rounded transition-all"><Plus size={16}/></button>
                    </div>
                    <table className="w-full text-xs text-left">
                       <thead className="bg-blue-800 text-white font-bold">
                          <tr>
                            <th className="px-4 py-2 border-r border-blue-700">Tên</th>
                            <th className="px-4 py-2 border-r border-blue-700">Kiểu</th>
                            <th className="px-4 py-2 border-r border-blue-700 text-center">B.Buộc</th>
                            <th className="px-4 py-2">Mô tả</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-gray-100">
                          {currentApi.inputParams.map((f, i) => (
                            <tr key={i} className="hover:bg-gray-50 transition-colors">
                               <td className="px-2 py-1"><input className="w-full bg-transparent p-1 font-mono text-blue-700 outline-none" value={f.name} onChange={e => { const l = [...currentApi.inputParams]; l[i].name = e.target.value; updateApiField(currentApi.id, { inputParams: l }); }} /></td>
                               <td className="px-2 py-1"><input className="w-full bg-transparent p-1 outline-none" value={f.type} onChange={e => { const l = [...currentApi.inputParams]; l[i].type = e.target.value; updateApiField(currentApi.id, { inputParams: l }); }} /></td>
                               <td className="px-2 py-1 text-center"><input type="checkbox" checked={f.required} onChange={e => { const l = [...currentApi.inputParams]; l[i].required = e.target.checked; updateApiField(currentApi.id, { inputParams: l }); }} /></td>
                               <td className="px-2 py-1 flex items-center gap-1">
                                  <input className="flex-1 bg-transparent p-1 italic text-gray-500 outline-none" placeholder="Nhập mô tả..." value={f.description} onChange={e => { const l = [...currentApi.inputParams]; l[i].description = e.target.value; updateApiField(currentApi.id, { inputParams: l }); }} />
                                  <button onClick={() => updateApiField(currentApi.id, { inputParams: currentApi.inputParams.filter((_, idx) => idx !== i) })} className="text-gray-300 hover:text-red-500 transition-all p-1"><Trash2 size={12}/></button>
                               </td>
                            </tr>
                          ))}
                       </tbody>
                    </table>
                  </div>
               )}
            </div>

            <div className="space-y-4">
               <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-black text-gray-800 flex items-center gap-2 uppercase tracking-widest"><RefreshCw size={16} className="text-blue-600"/> Response JSON</h3>
                    <button onClick={generateTableFromResponse} className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-all flex items-center gap-1">
                       <Table size={14} /> Trích xuất tham số
                    </button>
                  </div>
                  <textarea className="w-full h-32 p-3 border rounded-2xl bg-slate-900 text-slate-100 font-mono text-xs focus:ring-2 ring-blue-500 outline-none shadow-inner" value={currentApi.responseBody} onChange={e => updateApiField(currentApi.id, { responseBody: e.target.value })} />
               </div>

               {currentApi.outputParams.length > 0 && (
                  <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="bg-emerald-900 px-6 py-3 flex justify-between items-center">
                       <h4 className="text-xs font-black text-white uppercase tracking-widest">Bảng tham số Output</h4>
                       <button onClick={() => updateApiField(currentApi.id, { outputParams: [...currentApi.outputParams, { name: '', type: 'String', required: false, description: '' }] })} className="text-white hover:bg-white/10 p-1 rounded transition-all"><Plus size={16}/></button>
                    </div>
                    <table className="w-full text-xs text-left">
                       <thead className="bg-emerald-800 text-white font-bold">
                          <tr>
                            <th className="px-4 py-2 border-r border-emerald-700">Tên</th>
                            <th className="px-4 py-2 border-r border-emerald-700">Kiểu</th>
                            <th className="px-4 py-2 border-r border-emerald-700 text-center">B.Buộc</th>
                            <th className="px-4 py-2">Mô tả</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-gray-100">
                          {currentApi.outputParams.map((f, i) => (
                            <tr key={i} className="hover:bg-gray-50 transition-colors">
                               <td className="px-2 py-1"><input className="w-full bg-transparent p-1 font-mono text-emerald-700 outline-none" value={f.name} onChange={e => { const l = [...currentApi.outputParams]; l[i].name = e.target.value; updateApiField(currentApi.id, { outputParams: l }); }} /></td>
                               <td className="px-2 py-1"><input className="w-full bg-transparent p-1 outline-none" value={f.type} onChange={e => { const l = [...currentApi.outputParams]; l[i].type = e.target.value; updateApiField(currentApi.id, { outputParams: l }); }} /></td>
                               <td className="px-2 py-1 text-center"><input type="checkbox" checked={f.required} onChange={e => { const l = [...currentApi.outputParams]; l[i].required = e.target.checked; updateApiField(currentApi.id, { outputParams: l }); }} /></td>
                               <td className="px-2 py-1 flex items-center gap-1">
                                  <input className="flex-1 bg-transparent p-1 italic text-gray-500 outline-none" placeholder="Mô tả trường..." value={f.description} onChange={e => { const l = [...currentApi.outputParams]; l[i].description = e.target.value; updateApiField(currentApi.id, { outputParams: l }); }} />
                                  <button onClick={() => updateApiField(currentApi.id, { outputParams: currentApi.outputParams.filter((_, idx) => idx !== i) })} className="text-gray-300 hover:text-red-500 transition-all p-1"><Trash2 size={12}/></button>
                               </td>
                            </tr>
                          ))}
                       </tbody>
                    </table>
                  </div>
               )}
            </div>
          </div>

          <div className="h-full sticky top-24">
            {status === 'completed' ? (
              <MarkdownPreview content={result} onSaveToDrive={handleSaveToDrive} isSyncing={status === 'syncing'} />
            ) : status === 'processing' ? (
              <div className="h-full min-h-[500px] bg-white border border-gray-200 rounded-[2.5rem] flex flex-col items-center justify-center p-12 text-center animate-pulse shadow-sm">
                 <div className="bg-blue-50 p-6 rounded-full mb-6">
                    <Loader2 size={48} className="text-blue-600 animate-spin" />
                 </div>
                 <h3 className="text-2xl font-black text-gray-800">Gemini AI đang viết...</h3>
                 <p className="text-gray-500 mt-2 max-w-sm">Đang sử dụng cấu trúc từ file mẫu (DOCX/PDF) bạn đã tải lên để sinh tài liệu API tương ứng.</p>
              </div>
            ) : (
              <div className="h-full min-h-[500px] bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2.5rem] flex flex-col items-center justify-center p-12 text-center">
                 <List size={64} className="text-slate-200 mb-6" />
                 <h3 className="text-xl font-bold text-slate-400">Xem trước tài liệu</h3>
                 <p className="text-slate-300 text-sm mt-2 max-w-xs">AI sẽ tự động điền các mục dựa trên mẫu gốc bạn đã tải lên ở màn hình chi tiết dự án.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-100">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm backdrop-blur-md bg-white/90">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setView('dashboard')}>
            <div className="bg-blue-600 p-2 rounded-xl text-white shadow-lg shadow-blue-200 flex items-center justify-center">
              <Share2 size={22} />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-lg font-black tracking-tighter text-slate-800 leading-none">API DOC ARCHITECT</h1>
              <p className="text-[9px] font-bold text-blue-600 uppercase tracking-widest leading-none mt-1">AI & Cloud Integrated</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-6">
            <button onClick={() => setView('dashboard')} className={`text-sm font-bold flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${view === 'dashboard' ? 'text-blue-600 bg-blue-50' : 'text-gray-500 hover:bg-gray-100'}`}>
              <Layers size={18} /> <span className="hidden sm:inline">Dự án</span>
            </button>
            <button onClick={() => setView('settings')} title="Cài đặt tập trung" className={`p-2.5 rounded-xl transition-all ${view === 'settings' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-100'}`}>
              <Settings size={22} />
            </button>
            <div className="w-8 h-8 rounded-full bg-slate-100 border border-gray-200 flex items-center justify-center text-slate-400"><Database size={14} /></div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 min-h-[calc(100vh-64px)]">
        {view === 'dashboard' && <DashboardView />}
        {view === 'project-detail' && <ProjectDetailView />}
        {view === 'api-edit' && <ApiEditView />}
        {view === 'settings' && <SettingsView />}
      </main>

      {showSyncSuccess && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-4 rounded-3xl shadow-2xl flex items-center gap-4 z-[100] animate-in slide-in-from-bottom-8 duration-500">
          <div className="bg-green-500 p-1 rounded-full"><CheckCircle size={20} /></div>
          <div><span className="font-bold block">Đồng bộ thành công!</span><span className="text-xs text-gray-400">Dữ liệu đã được lưu lên Google Drive.</span></div>
        </div>
      )}

      {error && (
        <div className="fixed bottom-6 right-6 p-4 bg-red-600 text-white rounded-2xl shadow-2xl flex items-center gap-3 z-[100] animate-bounce max-w-sm">
          <Info size={20} />
          <p className="text-sm font-bold">{error}</p>
          <button onClick={() => setError(null)} className="ml-2 bg-white/20 p-1 rounded-full hover:bg-white/30 transition-all">×</button>
        </div>
      )}
    </div>
  );
};

export default App;
