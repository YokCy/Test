import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type ToastVariant = "success" | "error";

type ToastItem = {
  id: number;
  message: string;
  variant: ToastVariant;
};

type ToastContextValue = {
  showToast: (message: string, variant?: ToastVariant) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

/** トースト1件が自動的に消えるまでの表示時間。手動で閉じる操作を必須にしないための既定値。 */
const TOAST_DURATION_MS = 4000;

const VARIANT_CLASSES: Record<ToastVariant, string> = {
  success: "bg-emerald-600",
  error: "bg-red-600",
};

/**
 * D&Dの楽観的更新ロールバック時のエラー表示（frontend-tasks.md 5.5）等、
 * 特定のコンポーネントツリーに紐づかない箇所からもトーストを出せるよう、
 * Context経由でアプリ全体から`useToast().showToast(...)`を呼べるようにする。
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextIdRef = useRef(0);

  const showToast = useCallback((message: string, variant: ToastVariant = "success") => {
    const id = nextIdRef.current;
    nextIdRef.current += 1;
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, TOAST_DURATION_MS);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {createPortal(
        <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              role="alert"
              data-testid="toast"
              className={`rounded-md px-4 py-3 text-sm font-medium text-white shadow-lg ${VARIANT_CLASSES[toast.variant]}`}
            >
              {toast.message}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToastはToastProvider配下でのみ使用できます");
  }
  return context;
}
