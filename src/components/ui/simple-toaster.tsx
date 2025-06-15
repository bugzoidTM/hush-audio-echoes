
import React from 'react';
import { useSimpleToast } from '@/hooks/useSimpleToast';
import { X } from 'lucide-react';

const SimpleToaster: React.FC = () => {
  const { toasts, dismiss } = useSimpleToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`
            min-w-80 rounded-md border p-4 shadow-lg
            ${toast.variant === 'destructive' 
              ? 'border-destructive bg-destructive text-destructive-foreground' 
              : 'border bg-background text-foreground'
            }
          `}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              {toast.title && (
                <div className="text-sm font-semibold mb-1">{toast.title}</div>
              )}
              {toast.description && (
                <div className="text-sm opacity-90">{toast.description}</div>
              )}
            </div>
            <button
              onClick={() => dismiss(toast.id)}
              className="ml-2 text-foreground/50 hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default SimpleToaster;
