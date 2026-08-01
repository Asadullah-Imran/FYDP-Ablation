'use client';
import { useEffect } from 'react';
import { CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';

export default function Popup({ title, message, type, isConfirm, onConfirm, onCancel }) {
  // Keypress and backdrop lock handling
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onCancel();
      } else if (e.key === 'Enter') {
        onConfirm();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden'; // Lock scrolling
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = ''; // Unlock scrolling
    };
  }, [onConfirm, onCancel]);

  // Dynamic aesthetic classes based on popup type
  let accentColorClass = 'from-primary to-primary-container';
  let iconComponent = <Info className="h-6 w-6 text-primary" />;
  let iconBgClass = 'bg-primary/10 border-primary/20';
  let confirmBtnClass = 'bg-primary hover:bg-primary/90 text-white focus:ring-primary/20';

  if (type === 'success') {
    accentColorClass = 'from-emerald-500 to-emerald-400';
    iconComponent = <CheckCircle className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />;
    iconBgClass = 'bg-emerald-500/10 border-emerald-500/20';
    confirmBtnClass = 'bg-emerald-600 hover:bg-emerald-500 text-white focus:ring-emerald-500/20';
  } else if (type === 'error' || type === 'danger') {
    accentColorClass = 'from-error to-red-400';
    iconComponent = <AlertCircle className="h-6 w-6 text-error" />;
    iconBgClass = 'bg-error/10 border-error/20';
    confirmBtnClass = 'bg-error hover:bg-error/90 text-white focus:ring-error/20';
  } else if (type === 'warning' || type === 'alert') {
    accentColorClass = 'from-tertiary to-amber-500';
    iconComponent = <AlertTriangle className="h-6 w-6 text-tertiary" />;
    iconBgClass = 'bg-tertiary/10 border-tertiary/20';
    confirmBtnClass = 'bg-tertiary hover:bg-tertiary/90 text-white focus:ring-tertiary/20';
  }

  return (
    <div 
      className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-xs transition-opacity duration-300 animate-in fade-in"
      onClick={onCancel} // Click backdrop to dismiss / cancel
    >
      <div 
        className="relative w-full max-w-md bg-surface-container-lowest border border-outline-border p-6 rounded-lg shadow-xl overflow-hidden transform transition-all duration-200 animate-in fade-in zoom-in-95"
        onClick={(e) => e.stopPropagation()} // Stop click bubbling to backdrop
      >
        {/* Colorful Gradient Top Bar */}
        <div className={`absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r ${accentColorClass}`}></div>
        
        <div className="flex items-start gap-4 mt-2">
          {/* Accent Icon Container */}
          <div className={`p-2.5 rounded-default border ${iconBgClass} flex items-center justify-center shrink-0`}>
            {iconComponent}
          </div>
          
          <div className="space-y-1.5 flex-1 min-w-0">
            <h3 className="text-lg font-bold text-on-surface font-outfit tracking-tight truncate">
              {title}
            </h3>
            <p className="text-sm text-on-surface-variant leading-relaxed break-words whitespace-pre-wrap">
              {message}
            </p>
          </div>
        </div>
        
        {/* Buttons Action Area */}
        <div className="flex justify-end gap-3 mt-6 border-t border-outline-border/40 pt-4">
          {isConfirm && (
            <button
              type="button"
              onClick={onCancel}
              className="bg-surface-container-low hover:bg-surface-container text-on-surface border border-outline-border px-4 py-2 rounded-default text-xs sm:text-sm font-bold transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-outline/20"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            className={`${confirmBtnClass} px-4 py-2 rounded-default text-xs sm:text-sm font-bold transition-all cursor-pointer focus:outline-none focus:ring-2`}
            autoFocus
          >
            {isConfirm ? 'Confirm' : 'OK'}
          </button>
        </div>
      </div>
    </div>
  );
}
