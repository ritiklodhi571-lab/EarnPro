
import React, { useEffect } from 'react';

interface ToastProps {
  message: string;
  isVisible: boolean;
  onClose: () => void;
  type?: 'success' | 'error' | 'info';
}

const Toast: React.FC<ToastProps> = ({ message, isVisible, onClose, type = 'info' }) => {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(onClose, 3000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose]);

  if (!isVisible) return null;

  const bgColor = {
    success: 'bg-green-600',
    error: 'bg-rose-600',
    info: 'bg-slate-900'
  }[type];

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] animate-slide-up">
      <div className={`${bgColor} text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 border border-white/10`}>
        <span className="text-sm font-bold">{message}</span>
      </div>
    </div>
  );
};

export default Toast;
