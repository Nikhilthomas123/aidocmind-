import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  message: string;
  type: ToastType;
  isVisible: boolean;
  onClose: () => void;
  duration?: number;
}

export const Toast: React.FC<ToastProps> = ({
  message,
  type,
  isVisible,
  onClose,
  duration = 4000,
}) => {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose, duration]);

  const icons = {
    success: <CheckCircle className="w-5 h-5 text-emerald-400" />,
    error: <AlertCircle className="w-5 h-5 text-rose-400" />,
    info: <Info className="w-5 h-5 text-indigo-400" />,
  };

  const borders = {
    success: 'border-emerald-500/20 shadow-emerald-500/5',
    error: 'border-rose-500/20 shadow-rose-500/5',
    info: 'border-indigo-500/20 shadow-indigo-500/5',
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -15, scale: 0.95 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className={`fixed top-4 right-4 z-50 flex items-center gap-3 p-4 rounded-xl border glass-panel shadow-xl ${borders[type]} max-w-sm`}
        >
          <div className="flex-shrink-0">{icons[type]}</div>
          <p className="text-sm font-medium text-slate-100 flex-grow pr-2">{message}</p>
          <button
            onClick={onClose}
            className="flex-shrink-0 p-1 text-slate-400 hover:text-slate-200 transition-colors rounded-lg hover:bg-white/5"
          >
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
