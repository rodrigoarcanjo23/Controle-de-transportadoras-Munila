import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { CircleCheck, CircleAlert, Info, TriangleAlert, X } from 'lucide-react';
import { FeedbackContext, type ConfirmInput, type ToastInput } from './context';
import { Modal } from '../components/ui/Modal';

interface ToastItem extends ToastInput { id: number }

const ICONS = { success: CircleCheck, error: CircleAlert, warning: TriangleAlert, info: Info };

/** Toasts (avisos não bloqueantes) e diálogo de confirmação — substituem alert()/confirm(). */
export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmInput | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const toast = useCallback((t: ToastInput) => {
    const id = ++seq.current;
    setToasts((list) => [...list.slice(-3), { ...t, id }]);
    const dur = t.duration ?? (t.kind === 'error' || (t.text && t.text.length > 90) ? 8000 : 4500);
    window.setTimeout(() => dismiss(id), dur);
  }, [dismiss]);

  const confirm = useCallback((c: ConfirmInput) => {
    setConfirmState(c);
    return new Promise<boolean>((resolve) => { resolver.current = resolve; });
  }, []);

  const closeConfirm = (v: boolean) => {
    resolver.current?.(v);
    resolver.current = null;
    setConfirmState(null);
  };

  const api = useMemo(() => ({ toast, confirm }), [toast, confirm]);

  return (
    <FeedbackContext.Provider value={api}>
      {children}

      <div className="toasts" aria-live="polite">
        {toasts.map((t) => {
          const Icon = ICONS[t.kind ?? 'info'];
          return (
            <div key={t.id} className={`toast toast--${t.kind ?? 'info'}`} role="status">
              <Icon size={20} className="toast__icon" />
              <div className="toast__body">
                <div className="toast__title">{t.title}</div>
                {t.text && <div className="toast__text">{t.text}</div>}
              </div>
              <button className="icon-btn icon-btn--sm" onClick={() => dismiss(t.id)} aria-label="Fechar aviso"><X size={16} /></button>
            </div>
          );
        })}
      </div>

      {confirmState && (
        <Modal
          size="sm"
          onClose={() => closeConfirm(false)}
          footer={
            <>
              <button className="btn" onClick={() => closeConfirm(false)}>{confirmState.cancelLabel ?? 'Cancelar'}</button>
              <button className={`btn ${confirmState.danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => closeConfirm(true)} autoFocus>
                {confirmState.confirmLabel ?? 'Confirmar'}
              </button>
            </>
          }
        >
          <div className="confirm">
            <div className={`confirm__icon ${confirmState.danger ? 'tone-red' : 'tone-brand'}`}>
              {confirmState.danger ? <TriangleAlert size={22} /> : <Info size={22} />}
            </div>
            <h3 className="confirm__title">{confirmState.title}</h3>
            {confirmState.text && <p className="confirm__text">{confirmState.text}</p>}
          </div>
        </Modal>
      )}
    </FeedbackContext.Provider>
  );
}
