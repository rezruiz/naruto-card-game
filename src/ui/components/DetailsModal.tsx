import { useEffect, type ReactNode } from 'react';

export function DetailsModal({
  title,
  subtitle,
  text,
  children,
  hideText,
  onClose,
}: {
  title: string;
  subtitle?: string;
  text?: string;
  children?: ReactNode;
  /** For tool popups (deck search etc.) that have no printed card text to show. */
  hideText?: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="details-overlay" onClick={onClose}>
      <div className="details-modal" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="details-modal__header">
          <div>
            <h2>{title}</h2>
            {subtitle && <div className="details-modal__subtitle">{subtitle}</div>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {children && <div className="details-modal__actions">{children}</div>}
        {!hideText && <pre className="details-modal__text">{text ?? 'No card text available.'}</pre>}
      </div>
    </div>
  );
}
