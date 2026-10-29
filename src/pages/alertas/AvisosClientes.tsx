import { useCallback, useEffect, useState } from 'react';
import { MailCheck, Send } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { mensagemErro, registrarLog } from '../../lib/db';
import { useFeedback } from '../../feedback/context';

interface CfgAvisos { ativo: boolean; coletado: boolean; entregue: boolean; copia: string }
const PADRAO: CfgAvisos = { ativo: false, coletado: true, entregue: true, copia: '' };

/** Liga/desliga os e-mails automáticos aos clientes (coletado / entregue com canhoto). Só administrador. */
export function AvisosClientes() {
  const { toast } = useFeedback();
  const [cfg, setCfg] = useState<CfgAvisos | null>(null);
  const [semTabela, setSemTabela] = useState(false);
  const [stats, setStats] = useState<{ pendentes: number; enviados: number; semEmail: number; erros: number } | null>(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    const { data } = await supabase.from('configuracoes').select('valor').eq('chave', 'avisos_clientes').maybeSingle();
    if (!data) { setSemTabela(true); return; }
    setCfg({ ...PADRAO, ...(data.valor as Partial<CfgAvisos>) });
    const desde = new Date(Date.now() - 7 * 864e5).toISOString();
    const { data: fila, error } = await supabase.from('avisos_clientes').select('enviado_em, erro, tentativas').or(`enviado_em.is.null,enviado_em.gte.${desde}`).limit(2000);
    if (error) { setSemTabela(true); return; }
    const f = fila ?? [];
    setStats({
      pendentes: f.filter((x) => !x.enviado_em && x.tentativas < 3).length,
      enviados: f.filter((x) => x.enviado_em && !x.erro).length,
      semEmail: f.filter((x) => x.enviado_em && x.erro).length,
      erros: f.filter((x) => !x.enviado_em && x.tentativas >= 3).length,
    });
  }, []);
  // busca assíncrona: os setState ocorrem após o await
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { carregar(); }, [carregar]);

  async function salvar(n: CfgAvisos) {
    setSalvando(true);
    const { error } = await supabase.from('configuracoes').upsert({ chave: 'avisos_clientes', valor: n }, { onConflict: 'chave' });
    setSalvando(false);
    if (error) { toast({ kind: 'error', title: 'Não foi possível salvar', text: mensagemErro(error) }); return; }
    setCfg(n);
    registrarLog('EDITOU', 'ALERTAS', `${n.ativo ? 'Ligou' : 'Desligou'} os avisos automáticos aos clientes (coletado: ${n.coletado ? 'sim' : 'não'}; entregue: ${n.entregue ? 'sim' : 'não'}${n.copia ? `; cópia para ${n.copia}` : ''})`);
    toast({ kind: 'success', title: n.ativo ? 'Avisos aos clientes ligados' : 'Avisos aos clientes desligados' });
  }

  async function enviarAgora() {
    try {
      const r = await fetch('/api/avisos-clientes', { method: 'POST' });
      if (!(r.headers.get('content-type') ?? '').includes('json')) throw new Error('A função só funciona no site publicado na Vercel.');
      const b = await r.json() as { enviados?: number; falhas?: number; erro?: string; motivo?: string };
      if (b.erro) throw new Error(b.erro);
      toast({ kind: b.falhas ? 'warning' : 'success', title: `${b.enviados ?? 0} aviso(s) enviado(s)`, text: b.motivo ?? (b.falhas ? `${b.falhas} falha(s) — tentaremos de novo.` : undefined) });
      carregar();
    } catch (err) { toast({ kind: 'error', title: 'Falha no envio', text: err instanceof Error ? err.message : String(err) }); }
  }

  if (semTabela) {
    return <div className="card card-pad avc"><MailCheck size={20} /><div><strong>Avisos automáticos aos clientes</strong><p className="muted">Para ligar: rode <code>supabase/rastreio_avisos.sql</code> no Supabase (SQL Editor › Run).</p></div></div>;
  }
  if (!cfg) return null;
  return (
    <div className="card card-pad avc">
      <MailCheck size={20} />
      <div className="avc__corpo">
        <div className="avc__top">
          <div>
            <strong>Avisos automáticos aos clientes</strong>
            <p className="muted">E-mail ao cliente quando a NF é coletada e quando é entregue (com o link de rastreio e o canhoto). Usa o e-mail do cadastro do cliente.</p>
          </div>
          <label className="alerta-cfg__switch avc__switch">
            <input type="checkbox" checked={cfg.ativo} disabled={salvando} onChange={(e) => salvar({ ...cfg, ativo: e.target.checked })} />
            <span><strong>{cfg.ativo ? 'Ligado' : 'Desligado'}</strong></span>
          </label>
        </div>
        <div className="avc__ops">
          <label><input type="checkbox" checked={cfg.coletado} onChange={(e) => salvar({ ...cfg, coletado: e.target.checked })} /> Avisar quando coletar</label>
          <label><input type="checkbox" checked={cfg.entregue} onChange={(e) => salvar({ ...cfg, entregue: e.target.checked })} /> Avisar quando entregar</label>
          <label className="avc__copia">Cópia oculta para
            <input className="input" defaultValue={cfg.copia} placeholder="comercial@munila.com.br" onBlur={(e) => { if (e.target.value !== cfg.copia) salvar({ ...cfg, copia: e.target.value.trim() }); }} />
          </label>
        </div>
        {stats && (
          <div className="avc__stats">
            <span><b>{stats.enviados}</b> enviados (7 dias)</span>
            <span><b>{stats.pendentes}</b> na fila</span>
            {stats.semEmail > 0 && <span className="muted"><b>{stats.semEmail}</b> sem e-mail no cadastro</span>}
            {stats.erros > 0 && <span className="text-red"><b>{stats.erros}</b> com erro</span>}
            {cfg.ativo && stats.pendentes > 0 && <button className="btn btn-sm" onClick={enviarAgora}><Send size={14} /> Enviar agora</button>}
          </div>
        )}
      </div>
    </div>
  );
}
