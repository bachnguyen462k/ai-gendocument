
import React, { useState } from 'react';
import { X, Check, Code2 } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (val: string) => void;
  initialValue: string;
  title: string;
}

const JsonEditorModal: React.FC<Props> = ({ isOpen, onClose, onSave, initialValue, title }) => {
  const [value, setValue] = useState(initialValue);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h3 className="font-bold flex items-center gap-2"><Code2 size={18}/> {title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
        </div>
        <div className="p-6">
          <textarea
            className="w-full h-80 p-4 bg-gray-900 text-green-400 font-mono text-sm rounded-xl outline-none"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder='{ "key": "value" }'
          />
        </div>
        <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-gray-600">Hủy</button>
          <button 
            onClick={() => onSave(value)}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold flex items-center gap-2"
          >
            <Check size={18}/> Lưu cấu trúc
          </button>
        </div>
      </div>
    </div>
  );
};

export default JsonEditorModal;
