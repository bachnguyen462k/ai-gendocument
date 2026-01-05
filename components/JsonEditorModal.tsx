
import React, { useState, useEffect } from 'react';
import { X, Check, Code2, Sparkles, AlertCircle } from 'lucide-react';

interface JsonEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (val: string) => void;
  initialValue: string;
  title: string;
}

const JsonEditorModal: React.FC<JsonEditorModalProps> = ({ isOpen, onClose, onSave, initialValue, title }) => {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setValue(initialValue);
      setError(null);
    }
  }, [isOpen, initialValue]);

  if (!isOpen) return null;

  const handleBeautify = () => {
    try {
      const obj = JSON.parse(value);
      setValue(JSON.stringify(obj, null, 2));
      setError(null);
    } catch (e: any) {
      setError("Không thể định dạng: JSON không hợp lệ");
    }
  };

  const handleSave = () => {
    try {
      if (value.trim()) JSON.parse(value);
      onSave(value);
      onClose();
    } catch (e: any) {
      setError("Lỗi cú pháp JSON: " + e.message);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-xl text-white"><Code2 size={20} /></div>
            <div>
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">{title}</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">JSON Editor Engine</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-400 transition-all"><X size={20} /></button>
        </div>

        <div className="flex-1 p-8 overflow-hidden flex flex-col gap-4">
          <div className="flex justify-between items-center px-1">
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Raw Data Input</span>
             <button onClick={handleBeautify} className="flex items-center gap-1.5 text-[10px] font-black text-blue-600 hover:text-blue-700 transition-all">
                <Sparkles size={14} /> TỰ ĐỘNG ĐỊNH DẠNG
             </button>
          </div>
          
          <div className="flex-1 relative group">
            <textarea
              className="w-full h-full p-6 bg-slate-900 text-blue-100 font-mono text-sm rounded-3xl outline-none ring-offset-2 focus:ring-4 ring-blue-500/10 transition-all resize-none"
              value={value}
              onChange={(e) => { setValue(e.target.value); setError(null); }}
              placeholder='{ "key": "value" }'
              spellCheck={false}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-500 text-xs font-bold animate-pulse px-2">
              <AlertCircle size={14} /> {error}
            </div>
          )}
        </div>

        <div className="px-8 py-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-3 rounded-2xl text-xs font-black text-slate-500 hover:bg-slate-200 transition-all">HỦY BỎ</button>
          <button onClick={handleSave} className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-black shadow-xl shadow-blue-500/20 flex items-center gap-2 transition-all active:scale-95">
            <Check size={18} /> CẬP NHẬT CẤU TRÚC
          </button>
        </div>
      </div>
    </div>
  );
};

export default JsonEditorModal;
