// Função da Vercel: dados públicos de rastreio de UMA NF, pelo código secreto do link
// (/rastreio/<código>). Não exige login; devolve só o necessário para o cliente.
//
// Variáveis de ambiente (as mesmas do e-mail de alertas): SUPABASE_SERVICE_ROLE_KEY e VITE_SUPABASE_URL.
import { createClient } from '@supabase/supabase-js';
import type { RastreioDados } from '../src/lib/rastreio';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request): Promise<Response> {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) return json(500, { erro: 'Rastreio indisponível no momento.' });
  const token = new URL(request.url).searchParams.get('t') ?? '';
  if (!UUID.test(token)) return json(404, { erro: 'Link de rastreio inválido.' });

  const sb = createClient(url, service, { auth: { persistSession: false } });
  const { data: e, error } = await sb.from('entregas')
    .select('id, nota_fiscal, status, cidade_destino, uf_destino, data_faturamento, data_coleta, data_previsao, data_entrega_agendamento, clientes (nome, cidade, uf), transportadoras (nome)')
    .eq('rastreio_token', token).maybeSingle();
  if (error) return json(500, { erro: 'Rastreio indisponível no momento.' });
  if (!e) return json(404, { erro: 'Link de rastreio inválido ou expirado.' });

  const cli = (e.clientes ?? {}) as { nome?: string; cidade?: string; uf?: string };
  const tr = (e.transportadoras ?? {}) as { nome?: string };
  const entregue = e.status === 'Entregue';
  const { data: oc } = await sb.from('ocorrencias').select('codigo, descricao, data_ocorrencia, canhoto_path, created_at')
    .eq('entrega_id', String(e.id)).order('data_ocorrencia', { ascending: true }).order('created_at', { ascending: true });
  const ocorrencias = (oc ?? []).map((o) => ({ codigo: String(o.codigo), descricao: String(o.descricao ?? o.codigo), data: String(o.data_ocorrencia) }));
  let canhotoUrl: string | null = null;
  const canhoto = [...(oc ?? [])].reverse().find((o) => o.canhoto_path);
  if (entregue && canhoto?.canhoto_path) {
    const { data: s } = await sb.storage.from('canhotos').createSignedUrl(String(canhoto.canhoto_path), 3600);
    canhotoUrl = s?.signedUrl ?? null;
  }
  // previsão só aparece enquanto não entregue; datas agendadas não são expostas além do necessário
  const dados: RastreioDados = {
    nf: String(e.nota_fiscal), cliente: cli.nome ?? '', cidade: e.cidade_destino || cli.cidade || '', uf: e.uf_destino || cli.uf || '',
    transportadora: tr.nome ?? '', status: String(e.status), faturamento: e.data_faturamento, coleta: e.data_coleta,
    previsao: entregue ? null : e.data_previsao, entrega: entregue ? e.data_entrega_agendamento : null,
    agendamento: !entregue && (e.status === 'Agendado' || e.status === 'Reagendado') ? e.data_entrega_agendamento : null,
    ocorrencias, canhotoUrl,
  };
  return json(200, dados);
}
