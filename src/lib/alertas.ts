// Regras dos alertas do dia. Arquivo "puro" (sem React nem navegador): é usado
// pela Central de Alertas no sistema E pela função diária que envia o e-mail
// (api/alertas-diarios.ts), garantindo que os dois mostrem a mesma coisa.
import type { Devolucao, Entrega, MetaFrete } from '../types';

export interface ConfigAlertas {
  ativo: boolean;
  emails: string[];
  /** NF faturada há mais de N dias ainda sem frete real (CTE) */
  dias_sem_cte: number;
  /** NF faturada há mais de N dias ainda sem data de coleta */
  dias_aguardando_coleta: number;
  /** devolução emitida há mais de N dias ainda não concluída */
  dias_devolucao_aberta: number;
  /** frete real acima do cotado em mais de X% */
  margem_cotado_pct: number;
}
export const CONFIG_ALERTAS_PADRAO: ConfigAlertas = {
  ativo: false, emails: [], dias_sem_cte: 15, dias_aguardando_coleta: 2, dias_devolucao_aberta: 15, margem_cotado_pct: 10,
};
export const lerConfigAlertas = (v: unknown): ConfigAlertas => {
  const o = (v && typeof v === 'object' ? v : {}) as Partial<ConfigAlertas>;
  const n = (x: unknown, d: number) => (typeof x === 'number' && isFinite(x) && x >= 0 ? x : d);
  const P = CONFIG_ALERTAS_PADRAO;
  return {
    ativo: !!o.ativo,
    emails: Array.isArray(o.emails) ? o.emails.filter((e): e is string => typeof e === 'string' && e.includes('@')) : [],
    dias_sem_cte: n(o.dias_sem_cte, P.dias_sem_cte),
    dias_aguardando_coleta: n(o.dias_aguardando_coleta, P.dias_aguardando_coleta),
    dias_devolucao_aberta: n(o.dias_devolucao_aberta, P.dias_devolucao_aberta),
    margem_cotado_pct: n(o.margem_cotado_pct, P.margem_cotado_pct),
  };
};

export type NivelAlerta = 'critico' | 'atencao' | 'info';
export interface ItemAlerta { nf: string; cliente: string; detalhe: string; dias?: number; /** id da entrega (para abrir no Painel) */ id?: string }
export interface Alerta {
  id: string; nivel: NivelAlerta; titulo: string; descricao: string;
  itens: ItemAlerta[];
  /** tela onde se resolve */
  rota: string;
  /** status para filtrar o Painel de Entregas, quando fizer sentido */
  status?: string[];
}

/* ---------- utilidades (sem depender do fuso do computador) ---------- */
const dia = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
const dias = (de: string, ate: string) => Math.round((dia(ate) - dia(de)) / 864e5);
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const num = (v: unknown) => { const n = typeof v === 'number' ? v : Number(v); return isFinite(n) ? n : 0; };
const temValor = (v: unknown) => v !== null && v !== undefined && v !== '';
const pct = (v: number) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
/** Data de hoje em Brasília (o servidor do e-mail roda em UTC). */
export const hojeBrasilia = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

/** Dia útil anterior (seg → sex). */
function diaUtilAnterior(iso: string) {
  const d = new Date(dia(iso));
  do d.setUTCDate(d.getUTCDate() - 1); while (d.getUTCDay() === 0 || d.getUTCDay() === 6);
  return d.toISOString().slice(0, 10);
}

const FINALIZADAS = new Set(['Entregue', 'Devolvido', 'Devolução', 'Em devolução']);
const CRITICOS = ['Atrasado', 'Problema', 'Em devolução'];
const DEV_CONCLUIDA = new Set(['Chegou no Galpão', 'Entregue', 'Recusa']);
const cliente = (e: Entrega) => e.clientes?.nome ?? '—';

export interface EntradaAlertas {
  entregas: Entrega[]; devolucoes: Devolucao[]; metas: MetaFrete[];
  /** dias já lançados nos Indicadores Diários ({area, data}); omita para pular esse alerta */
  indicadores?: { area: string; data: string }[];
  cfg: ConfigAlertas; hoje?: string;
}

export function gerarAlertas({ entregas, devolucoes, metas, indicadores, cfg, hoje = hojeBrasilia() }: EntradaAlertas): Alerta[] {
  const abertas = entregas.filter((e) => !FINALIZADAS.has(e.status));
  const out: Alerta[] = [];
  const add = (a: Alerta) => { if (a.itens.length) out.push(a); };
  const ordem = (xs: ItemAlerta[]) => xs.sort((a, b) => (b.dias ?? 0) - (a.dias ?? 0));

  // 1) Previsão de entrega vencida
  add({
    id: 'vencidas', nivel: 'critico', rota: '/dashboard', status: [],
    titulo: 'Entregas com previsão vencida',
    descricao: 'Ainda em aberto depois da data prevista de entrega. Confirme com a transportadora e atualize o status.',
    itens: ordem(abertas.filter((e) => e.data_previsao && e.data_previsao < hoje).map((e) => {
      const d = dias(e.data_previsao!, hoje);
      return { id: e.id, nf: e.nota_fiscal, cliente: cliente(e), dias: d, detalhe: `previsão ${ddmm(e.data_previsao!)} · ${d} dia${d > 1 ? 's' : ''} de atraso · ${e.transportadoras?.nome ?? 'sem transportadora'}` };
    })),
  });

  // 2) Ocorrências marcadas como críticas
  add({
    id: 'criticas', nivel: 'critico', rota: '/dashboard', status: CRITICOS,
    titulo: 'Entregas com status Atrasado, Problema ou Em devolução',
    descricao: 'Ocorrências abertas que precisam de tratativa.',
    itens: entregas.filter((e) => CRITICOS.includes(e.status)).map((e) => ({
      id: e.id, nf: e.nota_fiscal, cliente: cliente(e), detalhe: `${e.status} · ${e.transportadoras?.nome ?? 'sem transportadora'}`,
    })),
  });

  // 3) Previsão vence hoje
  add({
    id: 'vence_hoje', nivel: 'atencao', rota: '/dashboard',
    titulo: 'Previsão de entrega é hoje',
    descricao: 'Acompanhe para não virar atraso.',
    itens: abertas.filter((e) => e.data_previsao === hoje).map((e) => ({
      id: e.id, nf: e.nota_fiscal, cliente: cliente(e), detalhe: `${e.status} · ${e.transportadoras?.nome ?? 'sem transportadora'}`,
    })),
  });

  // 4) Faturada e ainda sem coleta
  add({
    id: 'coleta', nivel: 'atencao', rota: '/dashboard', status: ['Pendente', 'Pendente agendamento', 'Aguardando coleta', 'Solicitado Agendamento', 'Agendado'],
    titulo: `Faturadas há mais de ${cfg.dias_aguardando_coleta} dias sem coleta`,
    descricao: 'A transportadora ainda não coletou (sem data de coleta).',
    itens: ordem(abertas.filter((e) => !e.data_coleta && e.status !== 'Em Transporte' && e.data_faturamento && dias(e.data_faturamento, hoje) > cfg.dias_aguardando_coleta).map((e) => {
      const d = dias(e.data_faturamento!, hoje);
      return { id: e.id, nf: e.nota_fiscal, cliente: cliente(e), dias: d, detalhe: `faturada em ${ddmm(e.data_faturamento!)} (${d} dias) · ${e.status}` };
    })),
  });

  // 5) Frete acima da meta (últimos 30 dias)
  const metaDe = new Map(metas.map((m) => [`${m.cliente_id}|${m.transportadora_id}`, num(m.meta_percentual)]));
  const recentes = entregas.filter((e) => e.data_faturamento && dias(e.data_faturamento, hoje) <= 30 && temValor(e.valor_frete_real) && num(e.valor_nf) > 0);
  add({
    id: 'meta', nivel: 'atencao', rota: '/financeiro',
    titulo: 'Frete acima da meta (últimos 30 dias)',
    descricao: 'NFs cujo frete real (CTE) passou da meta cadastrada para o cliente × transportadora.',
    itens: recentes.flatMap((e) => {
      const meta = metaDe.get(`${e.cliente_id}|${e.transportadora_id ?? ''}`);
      if (meta === undefined) return [];
      const p = (num(e.valor_frete_real) / num(e.valor_nf)) * 100;
      return p > meta ? [{ id: e.id, nf: e.nota_fiscal, cliente: cliente(e), dias: p - meta, detalhe: `${pct(p)} de frete · meta ${pct(meta)} · ${e.transportadoras?.nome ?? ''}` }] : [];
    }).sort((a, b) => (b.dias ?? 0) - (a.dias ?? 0)),
  });

  // 6) Frete real bem acima do cotado (últimos 30 dias)
  add({
    id: 'cotado', nivel: 'atencao', rota: '/financeiro',
    titulo: `Frete real mais de ${cfg.margem_cotado_pct}% acima do cotado (últimos 30 dias)`,
    descricao: 'Vale conferir o CTE com a transportadora antes de pagar.',
    itens: recentes.filter((e) => num(e.valor_frete) > 0 && num(e.valor_frete_real) > num(e.valor_frete) * (1 + cfg.margem_cotado_pct / 100)).map((e) => {
      const r = num(e.valor_frete_real), c = num(e.valor_frete);
      return { id: e.id, nf: e.nota_fiscal, cliente: cliente(e), dias: ((r - c) / c) * 100, detalhe: `real ${brl(r)} × cotado ${brl(c)} (+${pct(((r - c) / c) * 100)}) · ${e.transportadoras?.nome ?? ''}` };
    }).sort((a, b) => (b.dias ?? 0) - (a.dias ?? 0)),
  });

  // 7) Devoluções paradas
  add({
    id: 'devolucoes', nivel: 'atencao', rota: '/devolucoes',
    titulo: `Devoluções em aberto há mais de ${cfg.dias_devolucao_aberta} dias`,
    descricao: 'A mercadoria ainda não voltou para o galpão.',
    itens: ordem(devolucoes.filter((d) => !DEV_CONCLUIDA.has(d.status) && d.data_emissao && dias(d.data_emissao, hoje) > cfg.dias_devolucao_aberta).map((d) => {
      const n = dias(d.data_emissao!, hoje);
      return { nf: d.notas_fiscais, cliente: d.clientes?.nome ?? '—', dias: n, detalhe: `emitida em ${ddmm(d.data_emissao!)} (${n} dias) · ${d.status}` };
    })),
  });

  // 8) Sem CTE há muito tempo
  add({
    id: 'sem_cte', nivel: 'info', rota: '/ctes',
    titulo: `NFs faturadas há mais de ${cfg.dias_sem_cte} dias sem CTE`,
    descricao: 'Sem o frete real, essas NFs ficam fora do % de frete do BI.',
    itens: ordem(entregas.filter((e) => !temValor(e.valor_frete_real) && e.data_faturamento && !['Devolvido', 'Devolução'].includes(e.status)
      && dias(e.data_faturamento, hoje) > cfg.dias_sem_cte && dias(e.data_faturamento, hoje) <= 180).map((e) => {
      const d = dias(e.data_faturamento!, hoje);
      return { id: e.id, nf: e.nota_fiscal, cliente: cliente(e), dias: d, detalhe: `faturada em ${ddmm(e.data_faturamento!)} (${d} dias) · ${e.transportadoras?.nome ?? ''}` };
    })),
  });

  // 9) Indicadores Diários do último dia útil não lançados
  if (indicadores) {
    const ontem = diaUtilAnterior(hoje);
    const lancadas = new Set(indicadores.filter((x) => x.data === ontem).map((x) => x.area));
    const faltam = [['recebimento', 'Recebimento'], ['expedicao', 'Expedição'], ['coleta', 'Coleta']].filter(([a]) => !lancadas.has(a));
    add({
      id: 'indicadores', nivel: 'info', rota: '/indicadores',
      titulo: `Indicadores Diários de ${ddmm(ontem)} não lançados`,
      descricao: 'Sem o lançamento, o bloco Armazém do BI fica incompleto.',
      itens: faltam.map(([, l]) => ({ nf: l, cliente: '', detalhe: 'sem lançamento' })),
    });
  }
  return out;
}

const NIVEL_TXT: Record<NivelAlerta, string> = { critico: '🔴', atencao: '🟡', info: '🔵' };

/** Resumo em texto (WhatsApp / copiar). */
export function resumoTexto(alertas: Alerta[], hoje = hojeBrasilia(), maxItens = 5): string {
  if (!alertas.length) return `✅ MunilaLog — ${ddmm(hoje)}: nenhum alerta hoje.`;
  const linhas = [`*MunilaLog — alertas de ${ddmm(hoje)}*`, ''];
  for (const a of alertas) {
    linhas.push(`${NIVEL_TXT[a.nivel]} *${a.titulo}* (${a.itens.length})`);
    a.itens.slice(0, maxItens).forEach((i) => linhas.push(`   • ${i.cliente ? `NF ${i.nf} — ${i.cliente}` : i.nf}: ${i.detalhe}`));
    if (a.itens.length > maxItens) linhas.push(`   … e mais ${a.itens.length - maxItens}`);
    linhas.push('');
  }
  return linhas.join('\n').trim();
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const COR: Record<NivelAlerta, [string, string, string]> = {
  critico: ['#fee2e2', '#991b1b', 'Crítico'], atencao: ['#fef3c7', '#92400e', 'Atenção'], info: ['#e0f2fe', '#075985', 'Informativo'],
};

/** E-mail HTML (tabelas simples para funcionar no Outlook/Gmail). */
export function resumoHtml(alertas: Alerta[], urlApp: string, hoje = hojeBrasilia(), maxItens = 15): string {
  const blocos = alertas.map((a) => {
    const [bg, fg, rot] = COR[a.nivel];
    const itens = a.itens.slice(0, maxItens).map((i) =>
      `<tr><td style="padding:6px 10px;border-top:1px solid #eef2f6;font:600 13px Arial;color:#0f1b2d;white-space:nowrap">${esc(i.cliente ? `NF ${i.nf}` : i.nf)}</td>` +
      `<td style="padding:6px 10px;border-top:1px solid #eef2f6;font:13px Arial;color:#334155">${esc(i.cliente)}</td>` +
      `<td style="padding:6px 10px;border-top:1px solid #eef2f6;font:12px Arial;color:#64748b">${esc(i.detalhe)}</td></tr>`).join('');
    const mais = a.itens.length > maxItens ? `<tr><td colspan="3" style="padding:6px 10px;font:12px Arial;color:#64748b">… e mais ${a.itens.length - maxItens}</td></tr>` : '';
    return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;border:1px solid #e3e8ef;border-radius:10px;overflow:hidden">
      <tr><td colspan="3" style="padding:12px 14px;background:${bg}">
        <span style="font:700 11px Arial;color:${fg};text-transform:uppercase;letter-spacing:.05em">${rot} · ${a.itens.length}</span><br>
        <span style="font:700 15px Arial;color:#0f1b2d">${esc(a.titulo)}</span><br>
        <span style="font:13px Arial;color:#475569">${esc(a.descricao)}</span>
      </td></tr>${itens}${mais}
      <tr><td colspan="3" style="padding:8px 14px;border-top:1px solid #eef2f6"><a href="${esc(urlApp + a.rota)}" style="font:600 13px Arial;color:#0284c7">Abrir no MunilaLog →</a></td></tr>
    </table>`;
  }).join('');
  const corpo = alertas.length ? blocos : '<p style="font:15px Arial;color:#166534">✅ Nenhum alerta hoje. Tudo em dia!</p>';
  return `<!doctype html><html><body style="margin:0;background:#f4f6f9;padding:24px 12px">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:720px;margin:0 auto;background:#fff;border-radius:14px;padding:24px">
      <tr><td><div style="font:800 20px Arial;color:#0b1f33">MunilaLog · Alertas do dia ${ddmm(hoje)}</div>
      <div style="font:13px Arial;color:#64748b;margin:4px 0 20px">Resumo automático das entregas, fretes e devoluções que precisam de atenção.</div>
      ${corpo}
      <div style="font:12px Arial;color:#94a3b8;margin-top:10px">Para mudar quem recebe este e-mail ou os prazos dos alertas: MunilaLog › Alertas › Configurar.</div></td></tr>
    </table></body></html>`;
}
