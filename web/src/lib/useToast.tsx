import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { MOTION_SLOW_MS } from "./motion";
import { CheckIcon, AlertIcon, CloseIcon } from "../components/OrbitIcons";

type ToastKind = "success" | "error";

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS: Record<ToastKind, number> = {
  success: 2800,
  error: 4200,
};

function ToastStack({ items, onDismiss }: { items: ToastItem[]; onDismiss: (id: number) => void }) {
  if (items.length === 0) return null;

  return (
    <div className="orbit-toast-stack" aria-live="polite">
      {items.map((item) => (
        <Toast key={item.id} item={item} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function Toast({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  const [visible, setVisible] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const dismiss = useCallback(() => {
    setVisible(false);
    window.setTimeout(() => onDismiss(item.id), MOTION_SLOW_MS);
  }, [item.id, onDismiss]);

  useEffect(() => {
    const enter = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(enter);
  }, []);

  useEffect(() => {
    if (isHovered) return;

    const timer = window.setTimeout(() => {
      dismiss();
    }, AUTO_DISMISS_MS[item.kind]);

    return () => window.clearTimeout(timer);
  }, [item.kind, isHovered, dismiss]);

  return (
    <div
      className={`orbit-toast orbit-toast--${item.kind}${visible ? " orbit-toast--visible" : ""}`}
      role="status"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <span className="orbit-toast-icon" aria-hidden>
        {item.kind === "success" ? <CheckIcon size="sm" /> : <AlertIcon size="sm" />}
      </span>
      <span className="orbit-toast-message">{item.message}</span>
      <button
        type="button"
        className="orbit-toast-dismiss"
        onClick={dismiss}
        aria-label="关闭通知"
      >
        <CloseIcon size="sm" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = Date.now() + Math.random();
    setItems((prev) => {
      if (prev.some((t) => t.kind === kind && t.message === message)) return prev;
      return [...prev.slice(-2), { id, kind, message }];
    });
  }, []);

  const success = useCallback((message: string) => push("success", message), [push]);
  const error = useCallback((message: string) => push("error", message), [push]);

  const onDismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value = useMemo(() => ({ success, error }), [success, error]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastStack items={items} onDismiss={onDismiss} />
    </ToastContext.Provider>
  );
}

const fallbackToast: ToastContextValue = {
  success: (msg: string) => {
    if (import.meta.env.DEV) {
      console.warn("[useToast] ToastProvider missing, success message:", msg);
    }
  },
  error: (msg: string) => {
    if (import.meta.env.DEV) {
      console.warn("[useToast] ToastProvider missing, error message:", msg);
    }
  },
};

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    if (import.meta.env.DEV) {
      console.warn("[useToast] ToastProvider not found in React tree. Returning fallback toast.");
    }
    return fallbackToast;
  }
  return ctx;
}
