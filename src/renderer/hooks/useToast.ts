import { useState, useCallback, useRef, useEffect } from "react";
import type { Toast } from "../../shared/types";

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const onToast = (e: CustomEvent) => {
      const toast = e.detail as Toast;
      addToast(toast);
    };
    window.addEventListener("toast" as any, onToast);
    return () => window.removeEventListener("toast" as any, onToast);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const addToast = useCallback(
    (toast: Toast) => {
      const id = toast.id ?? `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const duration = toast.duration ?? 4000;
      const t = { ...toast, id };
      setToasts((prev) => [...prev.slice(-4), t]);
      const timer = setTimeout(() => removeToast(id), duration);
      timers.current.set(id, timer);
      return id;
    },
    [removeToast]
  );

  const success = useCallback(
    (message: string) =>
      addToast({ id: "", type: "success", message }),
    [addToast]
  );
  const error = useCallback(
    (message: string) =>
      addToast({ id: "", type: "error", message, duration: 6000 }),
    [addToast]
  );
  const info = useCallback(
    (message: string) =>
      addToast({ id: "", type: "info", message }),
    [addToast]
  );
  const warning = useCallback(
    (message: string) =>
      addToast({ id: "", type: "warning", message, duration: 5000 }),
    [addToast]
  );

  return { toasts, addToast, removeToast, success, error, info, warning };
}
