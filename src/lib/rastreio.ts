// Rastreio para o cliente: dados públicos de UMA NF (pelo código secreto do link)
// e os e-mails automáticos de "coletado" e "entregue". Arquivo puro: usado pela
// página pública e pelas funções da Vercel (api/rastreio.ts e api/avisos-clientes.ts).

export interface OcorrenciaPublica { codigo: string; descricao: string; data: string }
export interface RastreioDados {
  nf: string; cliente: string; cidade: string; uf: string; transportadora: string;
  status: string; faturamento: string | null; coleta: string | null; previsao: string | null;
  entrega: string | null; agendamento: string | null;
  ocorrencias: OcorrenciaPublica[];
  canhotoUrl?: string | null;
}

/** Linha do tempo simples para o cliente. */
export type EtapaRastreio = 'faturado' | 'coletado' | 'transito' | 'entregue';
export function etapaAtual(d: Pick<RastreioDados, 'status' | 'coleta'>): EtapaRastreio {
  if (d.status === 'Entregue') return 'entregue';
  if (d.status === 'Em Transporte' || d.status === 'Agendado' || d.status === 'Reagendado') return d.coleta ? 'transito' : 'coletado';
  return d.coleta ? 'transito' : 'faturado';
}

/** Texto do status para o cliente (sem jargão interno). */
export function statusParaCliente(d: Pick<RastreioDados, 'status' | 'coleta'>): string {
  const s = d.status;
  if (s === 'Entregue') return 'Entregue';
  if (['Devolvido', 'Devolução', 'Em devolução', 'Recusa'].includes(s)) return 'Em devolução';
  if (s === 'Problema' || s === 'Atrasado') return 'Em trânsito — com ocorrência';
  if (s === 'Agendado' || s === 'Reagendado') return 'Entrega agendada';
  if (s === 'Pendente agendamento' || s === 'Solicitado Agendamento') return 'Aguardando agendamento da entrega';
  if (s === 'Em Transporte' || d.coleta) return 'Em trânsito';
  return 'Pedido faturado — aguardando coleta';
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const dbr = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '—');

/** E-mail HTML do aviso ao cliente (tabelas simples para Outlook/Gmail). */
export function emailAviso(tipo: 'coletado' | 'entregue', d: RastreioDados, linkRastreio: string, empresa = 'Munila'): { assunto: string; html: string } {
  const entregue = tipo === 'entregue';
  const assunto = entregue ? `NF ${d.nf} entregue — ${empresa}` : `Seu pedido saiu para entrega — NF ${d.nf} (${empresa})`;
  const linha = (rot: string, val: string) => `<tr><td style="padding:6px 0;font:13px Arial;color:#64748b;width:150px">${esc(rot)}</td><td style="padding:6px 0;font:600 13px Arial;color:#0f1b2d">${esc(val)}</td></tr>`;
  const corpo = entregue
    ? `<p style="font:15px Arial;color:#0f1b2d;margin:0 0 14px">Olá, <b>${esc(d.cliente)}</b>! A mercadoria da <b>NF ${esc(d.nf)}</b> foi entregue${d.entrega ? ` em <b>${dbr(d.entrega)}</b>` : ''}.</p>`
    : `<p style="font:15px Arial;color:#0f1b2d;margin:0 0 14px">Olá, <b>${esc(d.cliente)}</b>! A mercadoria da <b>NF ${esc(d.nf)}</b> foi coletada pela transportadora e está a caminho.</p>`;
  const tabela = `<table cellpadding="0" cellspacing="0" style="margin:0 0 18px">
    ${linha('Nota fiscal', d.nf)}${linha('Destino', [d.cidade, d.uf].filter(Boolean).join('/') || '—')}${linha('Transportadora', d.transportadora || '—')}
    ${entregue ? linha('Entregue em', dbr(d.entrega)) : `${linha('Coletada em', dbr(d.coleta))}${linha('Previsão de entrega', dbr(d.previsao))}`}
  </table>`;
  const botoes = `<a href="${esc(linkRastreio)}" style="display:inline-block;background:#0095da;color:#fff;font:600 14px Arial;text-decoration:none;padding:11px 18px;border-radius:8px;margin-right:8px">Acompanhar a entrega</a>`
    + (entregue && d.canhotoUrl ? `<a href="${esc(d.canhotoUrl)}" style="display:inline-block;background:#eef2f6;color:#0f1b2d;font:600 14px Arial;text-decoration:none;padding:11px 18px;border-radius:8px">Ver comprovante (canhoto)</a>` : '');
  const html = `<!doctype html><html><body style="margin:0;background:#f4f6f9;padding:24px 12px">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff;border-radius:14px;padding:26px">
      <tr><td>
        <div style="font:800 19px Arial;color:#0b1f33;margin-bottom:16px">${esc(empresa)} · ${entregue ? 'Entrega realizada' : 'Pedido em trânsito'}</div>
        ${corpo}${tabela}${botoes}
        <div style="font:12px Arial;color:#94a3b8;margin-top:22px">${entregue && d.canhotoUrl ? 'O link do comprovante vale por 7 dias. ' : ''}Mensagem automática — em caso de dúvida, responda este e-mail ou fale com seu vendedor.</div>
      </td></tr>
    </table></body></html>`;
  return { assunto, html };
}
