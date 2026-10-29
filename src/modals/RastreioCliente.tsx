import { ClipboardCopy, ExternalLink, Mail, MessageCircle, Send } from 'lucide-react';
import { useFeedback } from '../feedback/context';
import type { Entrega } from '../types';

/** Endereço público do sistema (no app/servidor de teste o endereço é "localhost"). */
const enderecoPublico = () => (import.meta.env.VITE_APP_URL as string | undefined)?.replace(/\/$/, '') || window.location.origin;

/** Link de rastreio da NF para enviar ao cliente. */
export function RastreioCliente({ entrega }: { entrega: Entrega }) {
  const { toast } = useFeedback();
  if (!entrega.rastreio_token) return null; // SQL do rastreio ainda não rodado
  const link = `${enderecoPublico()}/rastreio/${entrega.rastreio_token}`;
  const cli = entrega.clientes;
  const msg = `Olá${cli?.nome ? `, ${cli.nome}` : ''}! Acompanhe a entrega da NF ${entrega.nota_fiscal} da Munila por este link: ${link}`;
  const fone = (cli?.telefone ?? '').replace(/\D/g, '');
  const copiar = async () => { try { await navigator.clipboard.writeText(link); toast({ kind: 'success', title: 'Link de rastreio copiado' }); } catch { toast({ kind: 'error', title: 'Não foi possível copiar' }); } };
  return (
    <div className="rast-box">
      <div className="rast-box__txt">
        <h4 className="hist__tit"><Send size={13} /> Rastreio para o cliente</h4>
        <span className="muted">Link público só desta NF (status, previsão e comprovante de entrega).</span>
      </div>
      <div className="rast-box__btns">
        <button type="button" className="btn btn-sm" onClick={copiar}><ClipboardCopy size={14} /> Copiar link</button>
        <a className="btn btn-sm" href={`https://wa.me/${fone.length >= 10 ? (fone.startsWith('55') ? fone : '55' + fone) : ''}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer"><MessageCircle size={14} /> WhatsApp</a>
        {cli?.email && <a className="btn btn-sm" href={`mailto:${cli.email}?subject=${encodeURIComponent(`Rastreio da NF ${entrega.nota_fiscal} — Munila`)}&body=${encodeURIComponent(msg)}`}><Mail size={14} /> E-mail</a>}
        <a className="btn btn-sm btn-ghost" href={link} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Abrir</a>
      </div>
    </div>
  );
}
