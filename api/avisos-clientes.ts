// Função da Vercel: envia os avisos automáticos aos clientes (NF coletada / NF entregue).
// Os avisos entram numa fila no banco (gatilho na tabela entregas) e esta função envia
// os pendentes. É chamada pelo próprio sistema logo depois de uma mudança de status
// (e uma vez por dia pelo agendamento, como garantia). Cada aviso é enviado uma única vez.
//
// Variáveis de ambiente (as mesmas do e-mail de alertas): SUPABASE_SERVICE_ROLE_KEY,
// RESEND_API_KEY, ALERTAS_REMETENTE (domínio verificado no Resend), APP_URL (opcional).
import { createClient } from '@supabase/supabase-js';
import { emailAviso, type RastreioDados } from '../src/lib/rastreio';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });

interface Aviso { id: number; entrega_id: string; tipo: 'coletado' | 'entregue'; tentativas: number }

async function processar(request: Request): Promise<Response> {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resend = process.env.RESEND_API_KEY;
  if (!url || !service) return json(500, { erro: 'Configure SUPABASE_SERVICE_ROLE_KEY na Vercel.' });
  const sb = createClient(url, service, { auth: { persistSession: false } });

  const { data: cfgRow } = await sb.from('configuracoes').select('valor').eq('chave', 'avisos_clientes').maybeSingle();
  const cfg = (cfgRow?.valor ?? {}) as { ativo?: boolean; copia?: string };
  if (!cfg.ativo) return json(200, { enviados: 0, motivo: 'Avisos aos clientes desligados.' });
  if (!resend) return json(500, { erro: 'Configure RESEND_API_KEY na Vercel.' });

  const { data: fila, error } = await sb.rpc('avisos_reservar', { p_limite: 30 });
  if (error) return json(500, { erro: error.message });
  const app = process.env.APP_URL || `https://${request.headers.get('host') ?? 'munilalog.vercel.app'}`;
  const copia = (cfg.copia ?? '').split(/[\s,;]+/).filter((e) => e.includes('@'));
  let enviados = 0; const falhas: string[] = [];

  for (const a of (fila ?? []) as Aviso[]) {
    const marcar = (campos: Record<string, unknown>) => sb.from('avisos_clientes').update(campos).eq('id', a.id);
    try {
      const { data: e } = await sb.from('entregas')
        .select('id, nota_fiscal, status, rastreio_token, cidade_destino, uf_destino, data_faturamento, data_coleta, data_previsao, data_entrega_agendamento, clientes (nome, email, cidade, uf, recebe_avisos), transportadoras (nome)')
        .eq('id', a.entrega_id).maybeSingle();
      const cli = (e?.clientes ?? {}) as { nome?: string; email?: string; cidade?: string; uf?: string; recebe_avisos?: boolean };
      const para = (cli.email ?? '').split(/[\s,;]+/).filter((x) => x.includes('@'));
      if (!e || !para.length || cli.recebe_avisos === false) {
        await marcar({ enviado_em: new Date().toISOString(), erro: !e ? 'NF não encontrada' : !para.length ? 'cliente sem e-mail' : 'cliente não recebe avisos' });
        continue;
      }
      let canhotoUrl: string | null = null;
      if (a.tipo === 'entregue') {
        const { data: oc } = await sb.from('ocorrencias').select('canhoto_path').eq('entrega_id', String(e.id)).not('canhoto_path', 'is', null).order('created_at', { ascending: false }).limit(1);
        const p = oc?.find((o) => o.canhoto_path)?.canhoto_path;
        if (p) canhotoUrl = (await sb.storage.from('canhotos').createSignedUrl(String(p), 7 * 24 * 3600)).data?.signedUrl ?? null;
      }
      const d: RastreioDados = {
        nf: String(e.nota_fiscal), cliente: cli.nome ?? '', cidade: e.cidade_destino || cli.cidade || '', uf: e.uf_destino || cli.uf || '',
        transportadora: ((e.transportadoras ?? {}) as { nome?: string }).nome ?? '', status: String(e.status),
        faturamento: e.data_faturamento, coleta: e.data_coleta, previsao: e.data_previsao,
        entrega: a.tipo === 'entregue' ? e.data_entrega_agendamento : null, agendamento: null, ocorrencias: [], canhotoUrl,
      };
      const { assunto, html } = emailAviso(a.tipo, d, `${app}/rastreio/${e.rastreio_token}`);
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST', headers: { authorization: `Bearer ${resend}`, 'content-type': 'application/json' },
        body: JSON.stringify({ from: process.env.ALERTAS_REMETENTE || 'Munila <onboarding@resend.dev>', to: para, ...(copia.length ? { bcc: copia } : {}), subject: assunto, html }),
      });
      if (!r.ok) throw new Error(`Resend: ${(await r.text()).slice(0, 200)}`);
      await marcar({ enviado_em: new Date().toISOString(), destinatario: para.join(', '), erro: null });
      await sb.from('logs_auditoria').insert({ usuario_email: 'sistema@munilalog', acao: 'CRIOU', modulo: 'ENTREGAS',
        detalhes: `Aviso automático ao cliente (${a.tipo === 'entregue' ? 'entregue' : 'coletado'}) da NF ${e.nota_fiscal} enviado para ${para.join(', ')}` });
      enviados++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      falhas.push(msg);
      // libera para nova tentativa (até 3)
      await marcar({ processando_em: null, erro: msg.slice(0, 300) });
    }
  }
  return json(200, { enviados, falhas: falhas.length, pendentes: (fila ?? []).length - enviados });
}

export const GET = processar;
export const POST = processar;
