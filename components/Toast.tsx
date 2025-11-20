
import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircleIcon, XIcon, SparklesIcon } from './Icons';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within a ToastProvider');
  return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  const removeToast = (id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed top-5 right-5 z-[100] flex flex-col gap-3 pointer-events-none">
        {toasts.map(toast => (
          <div 
            key={toast.id}
            className={`
              pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg transform transition-all duration-500 animate-fade-in-up min-w-[300px]
              ${toast.type === 'success' ? 'bg-white border-l-4 border-green-500 text-gray-800' : ''}
              ${toast.type === 'error' ? 'bg-white border-l-4 border-red-500 text-gray-800' : ''}
              ${toast.type === 'info' ? 'bg-white border-l-4 border-indigo-500 text-gray-800' : ''}
            `}
          >
            <div className={`
              ${toast.type === 'success' ? 'text-green-500' : ''}
              ${toast.type === 'error' ? 'text-red-500' : ''}
              ${toast.type === 'info' ? 'text-indigo-500' : ''}
            `}>
              {toast.type === 'success' && <CheckCircleIcon className="w-5 h-5" />}
              {toast.type === 'error' && <XIcon className="w-5 h-5" />}
              {toast.type === 'info' && <SparklesIcon className="w-5 h-5" />}
            </div>
            <p className="flex-1 text-sm font-medium">{toast.message}</p>
            <button onClick={() => removeToast(toast.id)} className="text-gray-400 hover:text-gray-600">
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
