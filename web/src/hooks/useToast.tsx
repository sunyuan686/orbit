import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { MOTION_SLOW_MS } from "../lib/motion";
import { Toast, ToastStack, type ToastVariant } from "../components/ui/Toast";

export type ToastKind = ToastVariant;

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

export interface ToastContextValue {
  success: (message: string) => void;
  error: (message: string) => void;
  info?: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS: Record<ToastKind, number> = {
  success: 2800,
  error: 4200,
  info: 3200,
};

function ToastHostItem({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: number) => void;
}) {
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
    <Toast
      variant={item.kind}
      visible={visible}
      onDismiss={dismiss}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {item.message}
    </Toast>
  );
}

function ToastHost({
  items,
  onDismiss,
}: {
  items: ToastItem[];
  onDismiss: (id: number) => void;
}) {
  if (items.length === 0) return null;

  return (
    <ToastStack>
      {items.map((item) => (
        <ToastHostItem key={item.id} item={item} onDismiss={onDismiss} />
      ))}
    </ToastStack>
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
  const info = useCallback((message: string) => push("info", message), [push]);

  const onDismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value = useMemo(() => ({ success, error, info }), [success, error, info]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastHost items={items} onDismiss={onDismiss} />
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
  info: (msg: string) => {
    if (import.meta.env.DEV) {
      console.warn("[useToast] ToastProvider missing, info message:", msg);
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
