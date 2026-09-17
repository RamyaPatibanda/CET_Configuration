function Dialog({ open, title, children, onClose, footer, className = "" }) {
  if (!open) return null;

  const dialogClassName = ["common-dialog", className].filter(Boolean).join(" ");

  return (
    <div
      className="common-dialog-overlay"
      role="presentation"
      onMouseDown={onClose || undefined}
    >
      <div
        className={dialogClassName}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="common-dialog-header">
          <h2>{title}</h2>
          <button
            type="button"
            className="common-dialog-close"
            onClick={onClose}
            aria-label="Close"
            disabled={!onClose}
          >
            ×
          </button>
        </div>
        <div className="common-dialog-body">{children}</div>
        {footer && <div className="common-dialog-footer">{footer}</div>}
      </div>
    </div>
  );
}

export default Dialog;
