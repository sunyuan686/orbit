import { useEffect, type ReactNode } from "react";
import { CloseIcon } from "../OrbitIcons";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  maxWidth?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  maxWidth = "32rem",
  children,
  footer,
}: ModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="orbit-ui-modal-backdrop" onClick={onClose}>
      <div
        className="orbit-ui-modal-dialog"
        style={{ maxWidth }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="orbit-ui-modal-title"
      >
        <div className="orbit-ui-modal-header">
          <div>
            <h3 id="orbit-ui-modal-title" className="orbit-ui-modal-title">
              {title}
            </h3>
            {subtitle && (
              <p className="orbit-ui-modal-subtitle">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            className="orbit-icon-btn orbit-btn-sm"
            onClick={onClose}
            aria-label="关闭"
          >
            <CloseIcon size="sm" />
          </button>
        </div>

        <div className="orbit-ui-modal-body">{children}</div>

        {footer && <div className="orbit-ui-modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
