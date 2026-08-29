import { useEffect, useRef, type MouseEvent, type ReactNode } from "react";
import { CloseIcon } from "./Icons";

type SettingsDialogProps = {
  children: ReactNode;
  description: string;
  dialogId?: string;
  open: boolean;
  title: string;
  onClose: () => void;
};

export function SettingsDialog({
  children,
  description,
  dialogId = "settings-dialog",
  open,
  title,
  onClose,
}: SettingsDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = `${dialogId}-title`;
  const descriptionId = `${dialogId}-description`;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const previousBodyOverflow = document.body.style.overflow;
    const previousDocumentOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousDocumentOverflow;
    };
  }, [open]);

  const handleBackdropClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  return (
    <dialog
      id={dialogId}
      ref={dialogRef}
      className="settings-dialog"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
      onClick={handleBackdropClick}
    >
      <div className="settings-dialog-shell">
        <header className="settings-dialog-header">
          <div>
            <h2 id={titleId}>{title}</h2>
            <p id={descriptionId}>{description}</p>
          </div>
          <button className="modal-close-button" type="button" onClick={onClose} aria-label={`${title}を閉じる`}>
            <CloseIcon />
          </button>
        </header>
        <div className="settings-dialog-body">{children}</div>
      </div>
    </dialog>
  );
}
