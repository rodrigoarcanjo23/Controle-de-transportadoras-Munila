import { useEffect, useState } from 'react';
import { ClipboardCopy, ExternalLink, Link2, Mail, MessageCircle, Power } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { mensagemErro, registrarLog } from '../../lib/db';
import { formatDateTimeBR } from '../../lib/format';
import { useAppData } from '../../state/context';
import { useFeedback } from '../../feedback/context';
import { Modal } from '../../components/ui/Modal';
import type { Transportadora } from '../../types';

interface Token { token: string; ativo: boolean; created_at: string; ultimo_acesso: string | null }

/** Gera/mostra o link do portal da transportadora (onde ela informa ocorrências e canhotos). */
export function ModalPortal({ t, onClose }: { t: Transportadora; onClose: () => void }) {
  const { email } = useAppData();
  const { toast, confirm } = useFeedback();
  const [tk, setTk] = useState<Token | null | undefined>(undefined);
  const [erro, setErro] = useState('');

  useEffect(() => {
    let vivo = true;
    supabase.from('portal_tokens').select('token, ativo, created_at, ultimo_acesso').eq('transportadora_id', String(t.id)).maybeSingle()
      .then(({ data, error }) => {
        if (!vivo) return;
        if (error) setErro(/does not exist|schema cache/i.test(error.message) ? 'Rode o arquivo supabase/fase1_portal_frete_expedicao.sql no Supabase para liberar o portal.' : mensagemErro(error));
        setTk((data as Token) ?? null);
      });
    return () => { vivo = false; };
  }, [t.id]);

  // No app Android (Capacitor) e no servidor de teste o endereço é "localhost": o link enviado
  // precisa ser o do sistema publicado (VITE_APP_URL, se definido no .env/Vercel).
  const base = (import.meta.env.VITE_APP_URL as string | undefined)?.replace(/\/$/, '') || window.location.origin;
  const linkLocal = /localhost|127\.0\.0\.1|capacitor:/.test(base);
  const link = tk ? `${base}/portal/${tk.token}` : '';
  const msg = `Olá, equipe ${t.nome}! Este é o portal da Munila para vocês informarem coleta, agendamento, entrega (com foto do canhoto) e ocorrências das nossas NFs, sem precisar de login:\n${link}\n\nObrigado!`;
  const fone = (t.telefone ?? '').replace(/\D/g, '');

  async function gerar() {
    const { data, error } = await supabase.from('portal_tokens').insert({ transportadora_id: String(t.id), criado_por: email }).select('token, ativo, created_at, ultimo_acesso').single();
    if (error) { toast({ kind: 'error', title: 'Não foi possível gerar o link', text: mensagemErro(error) }); return; }
    setTk(data as Token);
    registrarLog('CRIOU', 'TRANSPORTADORAS', `Gerou o link do portal da transportadora ${t.nome}`);
  }
  async function alternar() {
    if (!tk) return;
    if (tk.ativo && !(await confirm({ title: 'Desativar o link?', text: 'A transportadora não conseguirá mais acessar o portal até você reativar.', confirmLabel: 'Desativar', danger: true }))) return;
    const { error } = await supabase.from('portal_tokens').update({ ativo: !tk.ativo }).eq('token', tk.token);
    if (error) { toast({ kind: 'error', title: 'Erro', text: mensagemErro(error) }); return; }
    setTk({ ...tk, ativo: !tk.ativo });
    registrarLog('EDITOU', 'TRANSPORTADORAS', `${tk.ativo ? 'Desativou' : 'Reativou'} o link do portal da transportadora ${t.nome}`);
  }
  async function trocar() {
    if (!tk || !(await confirm({ title: 'Gerar um link novo?', text: 'O link atual para de funcionar. Use se o link foi compartilhado com quem não deveria.', confirmLabel: 'Gerar novo link', danger: true }))) return;
    await supabase.from('portal_tokens').delete().eq('token', tk.token);
    await gerar();
  }

  return (
    <Modal title={`Portal · ${t.nome}`} subtitle="A transportadora informa coleta, agendamento, entrega e ocorrências sem login" onClose={onClose}
      footer={<button type="button" className="btn" onClick={onClose}>Fechar</button>}>
      {erro ? <div className="callout tone-red">{erro}</div>
        : tk === undefined ? <p className="muted">Carregando…</p>
        : !tk ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'flex-start' }}>
            <p>Ainda não existe link para esta transportadora. O link mostra <b>somente as NFs da {t.nome}</b> que estão em aberto, e cada ocorrência informada atualiza o Painel de Entregas na hora.</p>
            <button className="btn btn-primary" onClick={gerar}><Link2 size={16} /> Gerar link do portal</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="portal-link">
              <code>{link}</code>
              <span className={`badge tone-${tk.ativo ? 'green' : 'red'}`}>{tk.ativo ? 'Ativo' : 'Desativado'}</span>
            </div>
            {linkLocal && (
              <div className="badge tone-amber" style={{ whiteSpace: 'normal', padding: '8px 10px', lineHeight: 1.4 }}>
                Este endereço é local (servidor de teste ou app). Para enviar à transportadora, abra o sistema publicado na Vercel ou defina VITE_APP_URL com o endereço do sistema.
              </div>
            )}
            <div className="muted" style={{ fontSize: '0.82rem' }}>
              Criado em {formatDateTimeBR(tk.created_at)} · {tk.ultimo_acesso ? `última ocorrência enviada em ${formatDateTimeBR(tk.ultimo_acesso)}` : 'ainda não usado'}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn" onClick={async () => { await navigator.clipboard.writeText(link); toast({ kind: 'success', title: 'Link copiado' }); }}><ClipboardCopy size={15} /> Copiar link</button>
              <a className="btn" href={`https://wa.me/${fone.length >= 10 ? (fone.startsWith('55') ? fone : '55' + fone) : ''}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer"><MessageCircle size={15} /> Enviar no WhatsApp</a>
              <a className="btn" href={`mailto:${t.email ?? ''}?subject=${encodeURIComponent('Portal de ocorrências — Munila')}&body=${encodeURIComponent(msg)}`}><Mail size={15} /> E-mail</a>
              <a className="btn btn-ghost" href={link} target="_blank" rel="noreferrer"><ExternalLink size={15} /> Abrir</a>
            </div>
            <div style={{ display: 'flex', gap: 8, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              <button className="btn btn-ghost btn-sm" onClick={alternar}><Power size={14} /> {tk.ativo ? 'Desativar link' : 'Reativar link'}</button>
              <button className="btn btn-ghost btn-sm" onClick={trocar}>Gerar novo link</button>
            </div>
          </div>
        )}
    </Modal>
  );
}
