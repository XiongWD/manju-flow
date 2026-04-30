"use client";
import { useState, useEffect, useCallback, createContext, useContext } from "react";

interface Toast {
  id: number;
  message: string;
  type: "error" | "success" | "info";
}

const ToastContext = createContext<{
  showToast: (message: string, type?: "error" | "success" | "info") => void;
}>({ showToast: () => {} });

export function useToast() { return useContext(ToastContext); }

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  let counter = 0;

  const showToast = useCallback((message: string, type: "error" | "success" | "info" = "error") => {
    const id = ++counter;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map(t => (
          <div key={t.id} className={`px-4 py-2 rounded-lg shadow-lg text-white text-sm ${
            t.type === "error" ? "bg-red-500" : t.type === "success" ? "bg-green-500" : "bg-blue-500"
          }`}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
