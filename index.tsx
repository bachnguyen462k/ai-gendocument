
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Đảm bảo process.env tồn tại và ánh xạ API_KEY từ import.meta.env nếu cần
const metaEnv = (import.meta as any).env || {};
// Fix: Cast window to any to safely define process.env in a browser environment and avoid mismatch with Node.js types
(window as any).process = (window as any).process || { env: {} };
(window as any).process.env = {
  ...(window as any).process.env,
  API_KEY: (window as any).process.env.API_KEY || metaEnv.VITE_API_KEY || metaEnv.API_KEY || ""
};

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
