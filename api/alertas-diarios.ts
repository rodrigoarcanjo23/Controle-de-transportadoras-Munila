// Função da Vercel: envia o e-mail diário de alertas (seg a sáb, 8h de Brasília —
// agendado em vercel.json › crons). Também atende o botão "Enviar teste agora"
// da tela Alertas (somente administradores).
//
// Variáveis de ambiente (Vercel › Settings › Environment Variables):
//   SUPABASE_SERVICE_ROLE_KEY  chave "service_role" do Supabase (Settings › API) — NUNCA use no front-end
//   RESEND_API_KEY             chave do Resend (resend.com), serviço que envia os e-mails
//   ALERTAS_REMETENTE          opcional. Ex.: "MunilaLog <alertas@munila.com.br>" (domínio verificado no Resend)
//   CRON_SECRET                opcional, recomendado. Qualquer texto longo; a Vercel envia no agendamento
//   VITE_SUPABASE_URL          já existe (a mesma do site)
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { gerarAlertas, hojeBrasilia, lerConfigAlertas, resumoHtml } from '../src/lib/alertas';
import type { Devolucao, Entrega, MetaFrete, Transportadora } from '../src/types';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });

async function todas<T>(sb: SupabaseClient, tabela: string, select: string): Promise<T[]> {
  const out: T[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await sb.from(tabela).select(select).range(de, de + 999);
    if (error) throw new Error(`${tabela}: ${error.message}`);
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) return out;
  }
}

export async function GET(request: Request): Promise<Response> {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resend = process.env.RESEND_API_KEY;
  if (!url || !service) return json(500, { erro: 'Configure SUPABASE_SERVICE_ROLE_KEY (e VITE_SUPABASE_URL) na Vercel.' });
  const sb = createClient(url, service, { auth: { persistSession: false } });

  // --- quem está chamando? ---
  const params = new URL(request.url).searchParams;
  const teste = params.has('teste');
  const auth = request.headers.get('authorization') ?? '';
  const token = auth.replace(/^Bearer\s+/i, '');
  const secret = process.env.CRON_SECRET;
  const ehCron = secret ? token === secret : /vercel-cron/i.test(request.headers.get('user-agent') ?? '');
  let emailTeste: string | null = null;
  if (!ehCron) {
    if (!token) return json(401, { erro: 'Não autorizado.' });
    const { data: u } = await sb.auth.getUser(token);
    const email = u.user?.email?.toLowerCase();
    if (!email) return json(401, { erro: 'Sessão inválida. Entre novamente no sistema.' });
    const { data: perfis } = await sb.from('perfis').select('email, nivel_acesso');
    const admin = !perfis?.length || perfis.some((p) => p.email?.toLowerCase() === email && p.nivel_acesso === 'Administrador');
    if (!admin) return json(403, { erro: 'Somente administradores podem enviar o teste.' });
    emailTeste = email;
  }

  try {
    const { data: cfgRow } = await sb.from('configuracoes').select('valor').eq('chave', 'alertas').maybeSingle();
    const cfg = lerConfigAlertas(cfgRow?.valor);
    if (!cfg.ativo && !teste) return json(200, { enviado: false, motivo: 'Alertas por e-mail desativados em Alertas › Configurar.' });

    const destinatarios = cfg.emails.length ? cfg.emails : emailTeste ? [emailTeste] : [];
    if (!destinatarios.length) return json(200, { enviado: false, motivo: 'Nenhum e-mail cadastrado em Alertas › Configurar.' });
    if (!resend) return json(500, { erro: 'Configure RESEND_API_KEY na Vercel para enviar e-mails.' });

    const [entregas, devolucoes, metas] = await Promise.all([
      todas<Entrega>(sb, 'entregas', '*, clientes (nome), transportadoras (nome)'),
      todas<Devolucao>(sb, 'devolucoes', '*, clientes (nome)'),
      todas<MetaFrete>(sb, 'metas_frete', '*'),
    ]);
    const hoje = hojeBrasilia();
    const desde = new Date(Date.now() - 10 * 864e5).toISOString().slice(0, 10);
    const { data: ind } = await sb.from('indicadores_diarios').select('area, data').gte('data', desde);
    // faturas de frete em aberto (pula o alerta se a tabela ainda não foi criada)
    const { data: fat, error: ef } = await sb.from('faturas_frete').select('numero, transportadora_id, vencimento, valor, status, updated_at')
      .in('status', ['recebida', 'conferida', 'contestada', 'aprovada']);
    const transps = ef ? [] : await todas<Transportadora>(sb, 'transportadoras', 'id, nome');
    const faturas = ef ? undefined : (fat ?? []).map((f) => ({
      numero: String(f.numero), vencimento: String(f.vencimento), valor: Number(f.valor) || 0, status: String(f.status), atualizada: f.updated_at as string,
      transportadora: transps.find((t) => String(t.id) === String(f.transportadora_id))?.nome ?? '—',
    }));
    const alertas = gerarAlertas({ entregas, devolucoes, metas, indicadores: ind ?? undefined, faturas, cfg, hoje });

    const app = process.env.APP_URL || `https://${request.headers.get('host') ?? 'munilalog.vercel.app'}`;
    const criticos = alertas.filter((a) => a.nivel === 'critico').reduce((s, a) => s + a.itens.length, 0);
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${resend}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: process.env.ALERTAS_REMETENTE || 'MunilaLog <onboarding@resend.dev>',
        to: destinatarios,
        subject: `${teste ? '[TESTE] ' : ''}MunilaLog · ${alertas.length ? `${criticos ? `${criticos} crítico(s) · ` : ''}${alertas.length} alerta(s)` : 'nenhum alerta'} · ${hoje.slice(8, 10)}/${hoje.slice(5, 7)}`,
        html: resumoHtml(alertas, app, hoje),
      }),
    });
    if (!r.ok) return json(502, { erro: `Resend recusou o envio: ${await r.text()}` });

    await sb.from('logs_auditoria').insert({
      usuario_email: emailTeste ?? 'sistema@munilalog', acao: 'CRIOU', modulo: 'ALERTAS',
      detalhes: `${teste ? 'Teste do' : 'Enviou o'} e-mail de alertas para ${destinatarios.join(', ')} (${alertas.length} alertas)`,
    });
    return json(200, { enviado: true, destinatarios, alertas: alertas.length });
  } catch (err) {
    return json(500, { erro: err instanceof Error ? err.message : String(err) });
  }
}
