import { useEffect, useRef, type FormEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  onClose: () => void;
  /** Quando informado, corpo + rodapé viram um <form> (Enter e Ctrl+Enter salvam). */
  onSubmit?: (e: FormEvent) => void;
  banner?: ReactNode;
  footer?: ReactNode;
  /** foca o primeiro campo ao abrir (desligue em telas de consulta com campos lá embaixo) */
  autoFocus?: boolean;
  children: ReactNode;
}

export function Modal({ title, subtitle, size = 'md', onClose, onSubmit, banner, footer, autoFocus = true, children }: ModalProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // só o modal mais acima reage
        const all = document.querySelectorAll('.modal');
        if (all[all.length - 1] === boxRef.current) onCloseRef.current();
      }
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && formRef.current) {
        e.preventDefault();
        formRef.current.requestSubmit();
      }
    };
    window.addEventListener('keydown', onKey);
    const first = boxRef.current?.querySelector<HTMLElement>('.modal__body input:not([type=hidden]):not([type=checkbox]):not([readonly]), .modal__body select, .modal__body textarea');
    if (autoFocus && first && window.matchMedia('(min-width: 768px)').matches) first.focus();
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const inner = (
    <>
      <div className="modal__body">{children}</div>
      {footer && <div className="modal__footer">{footer}</div>}
    </>
  );

  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal modal--${size}`} ref={boxRef} role="dialog" aria-modal="true">
        {title && (
          <div className="modal__header">
            <div>
              <h2 className="modal__title">{title}</h2>
              {subtitle && <p className="modal__subtitle">{subtitle}</p>}
            </div>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar"><X size={20} /></button>
          </div>
        )}
        {banner && <div className="modal__banner">{banner}</div>}
        {onSubmit ? (
          <form ref={formRef} onSubmit={onSubmit} style={{ display: 'contents' }} noValidate={false}>{inner}</form>
        ) : inner}
      </div>
    </div>,
    document.body,
  );
}

/** Rodapé padrão: dica de atalho + Cancelar + Salvar. */
export function ModalActions({ onCancel, submitLabel, submitting, disabled, danger }: {
  onCancel: () => void; submitLabel: string; submitting?: boolean; disabled?: boolean; danger?: boolean;
}) {
  return (
    <>
      <span className="hint"><span className="kbd">Ctrl</span>+<span className="kbd">Enter</span> salva · <span className="kbd">Esc</span> fecha</span>
      <button type="button" className="btn" onClick={onCancel}>Cancelar</button>
      <button type="submit" className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} disabled={submitting || disabled}>
        {submitting ? 'Salvando…' : submitLabel}
      </button>
    </>
  );
}
