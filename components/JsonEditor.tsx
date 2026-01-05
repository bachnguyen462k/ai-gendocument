
import React from 'react';

interface JsonEditorProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}

const JsonEditor: React.FC<JsonEditorProps> = ({ label, value, onChange, placeholder }) => {
  return (
    <div className="flex flex-col space-y-2">
      <label className="text-sm font-semibold text-gray-700">{label}</label>
      <textarea
        className="w-full h-48 p-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent code-font bg-gray-50"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || 'Paste JSON here...'}
      />
    </div>
  );
};

export default JsonEditor;
