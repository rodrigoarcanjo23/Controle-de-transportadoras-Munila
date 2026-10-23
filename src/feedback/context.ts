import { createContext, useContext } from 'react';

export type ToastKind = 'success' | 'error' | 'warning' | 'info';
export interface ToastInput { title: string; text?: string; kind?: ToastKind; duration?: number }

export interface ConfirmInput {
  title: string;
  text?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

export interface FeedbackApi {
  toast: (t: ToastInput) => void;
  confirm: (c: ConfirmInput) => Promise<boolean>;
}

export const FeedbackContext = createContext<FeedbackApi | null>(null);

export function useFeedback(): FeedbackApi {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error('useFeedback fora do FeedbackProvider');
  return ctx;
}
