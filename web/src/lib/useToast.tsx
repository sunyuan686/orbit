import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

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
  success: 2600,
  error: 3800,
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

  useEffect(() => {
    const enter = requestAnimationFrame(() => setVisible(true));
    const timer = window.setTimeout(() => {
      setVisible(false);
      window.setTimeout(() => onDismiss(item.id), 220);
    }, AUTO_DISMISS_MS[item.kind]);
    return () => {
      cancelAnimationFrame(enter);
      window.clearTimeout(timer);
    };
  }, [item.id, item.kind, onDismiss]);

  return (
    <div
      className={`orbit-toast orbit-toast--${item.kind}${visible ? " orbit-toast--visible" : ""}`}
      role="status"
    >
      <span className="orbit-toast-icon" aria-hidden>
        {item.kind === "success" ? "✓" : "!"}
      </span>
      <span className="orbit-toast-message">{item.message}</span>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev.slice(-2), { id, kind, message }]);
  }, []);

  const success = useCallback((message: string) => push("success", message), [push]);
  const error = useCallback((message: string) => push("error", message), [push]);

  const onDismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ success, error }}>
      {children}
      <ToastStack items={items} onDismiss={onDismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
