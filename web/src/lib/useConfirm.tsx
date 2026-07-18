import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";

export interface ConfirmOptions {
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Destructive confirm — uses danger button */
  danger?: boolean;
}

type ConfirmFn = (options: ConfirmOptions | string) => Promise<boolean>;

interface ConfirmRequest extends ConfirmOptions {
  id: number;
}

interface ConfirmContextValue {
  confirm: ConfirmFn;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

function normalizeOptions(options: ConfirmOptions | string): ConfirmOptions {
  return typeof options === "string" ? { message: options } : options;
}

function ConfirmDialog({
  request,
  onResolve,
}: {
  request: ConfirmRequest;
  onResolve: (value: boolean) => void;
}) {
  const titleId = useId();
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmRef.current?.focus();
  }, [request.id]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onResolve(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onResolve]);

  const confirmLabel = request.confirmLabel ?? "确定";
  const cancelLabel = request.cancelLabel ?? "取消";

  return (
    <div className="orbit-confirm" role="presentation">
      <button
        type="button"
        className="orbit-overlay-scrim orbit-confirm-scrim orbit-overlay-scrim--visible"
        aria-label="关闭确认"
        onClick={() => onResolve(false)}
      />
      <div
        className="orbit-confirm-panel"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <p id={titleId} className="orbit-confirm-message">
          {request.message}
        </p>
        <div className="orbit-confirm-actions">
          <button type="button" className="orbit-btn" onClick={() => onResolve(false)}>
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={`orbit-btn${request.danger ? " orbit-btn-danger" : " orbit-btn-primary"}`}
            onClick={() => onResolve(true)}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const resolve = useCallback((value: boolean) => {
    const resolver = resolverRef.current;
    resolverRef.current = null;
    setRequest(null);
    resolver?.(value);
  }, []);

  const confirm = useCallback<ConfirmFn>((options) => {
    if (resolverRef.current) {
      resolverRef.current(false);
      resolverRef.current = null;
    }
    const normalized = normalizeOptions(options);
    return new Promise<boolean>((res) => {
      resolverRef.current = res;
      setRequest({ ...normalized, id: Date.now() + Math.random() });
    });
  }, []);

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {request ? <ConfirmDialog request={request} onResolve={resolve} /> : null}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx.confirm;
}
