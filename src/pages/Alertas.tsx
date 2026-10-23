import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, BellOff, ChevronDown, ChevronUp, ClipboardCopy, Mail, MessageCircle, Send, Settings } from 'lucide-react';
import { useAppData } from '../state/context';
import { useFeedback } from '../feedback/context';
import { useAlertas } from '../hooks/useAlertas';
import { mensagemErro } from '../lib/db';
import { FILTROS_VAZIOS } from '../lib/filtrosEntrega';
import { resumoTexto, type Alerta, type ConfigAlertas, type ItemAlerta, type NivelAlerta } from '../lib/alertas';
import { EmptyState, PageHeader } from '../components/ui/basics';
import { Modal } from '../components/ui/Modal';
import './alertas.css';

const NIVEL: Record<NivelAlerta, [string, string]> = { critico: ['Crítico', 'red'], atencao: ['Atenção', 'amber'], info: ['Informativo', 'blue'] };
const TELA: Record<string, string> = { '/dashboard': 'Painel de Entregas', '/financeiro': 'Gestão Financeira', '/devolucoes': 'Devoluções', '/ctes': 'Registro de CTE', '/indicadores': 'Indicadores Diários' };

function CartaoAlerta({ a, abrirNf, abrir }: { a: Alerta; abrirNf: (i: ItemAlerta) => void; abrir: (a: Alerta) => void }) {
  const comIds = a.itens.filter((i) => i.id).length;
  const [todos, setTodos] = useState(false);
  const [rot, tom] = NIVEL[a.nivel];
  const itens = todos ? a.itens : a.itens.slice(0, 6);
  const ehNf = a.id !== 'indicadores';
  return (
    <div className={`card alerta alerta--${a.nivel}`}>
      <div className="alerta__head">
        <span className={`badge tone-${tom}`}>{rot}</span>
        <div className="alerta__tit">
          <h3>{a.titulo}</h3>
          <p>{a.descricao}</p>
        </div>
        <strong className="alerta__n">{a.itens.length}</strong>
      </div>
      <ul className="alerta__itens">
        {itens.map((i, k) => (
          <li key={`${i.nf}-${k}`}>
            {ehNf && a.id !== 'devolucoes'
              ? <button className="alerta__nf" onClick={() => abrirNf(i)} title="Abrir esta NF no Painel de Entregas">NF {i.nf}</button>
              : <span className="alerta__nf alerta__nf--txt">{a.id === 'devolucoes' ? `NF ${i.nf}` : i.nf}</span>}
            {i.cliente && <span className="alerta__cli">{i.cliente}</span>}
            <span className="alerta__det">{i.detalhe}</span>
          </li>
        ))}
      </ul>
      <div className="alerta__foot">
        {a.itens.length > 6 && (
          <button className="btn btn-ghost btn-sm" onClick={() => setTodos((v) => !v)}>
            {todos ? <><ChevronUp size={14} /> Mostrar menos</> : <><ChevronDown size={14} /> Ver todas ({a.itens.length})</>}
          </button>
        )}
        <button className="btn btn-sm" onClick={() => abrir(a)}>{comIds ? `Ver ${comIds === 1 ? 'esta NF' : `estas ${comIds} NFs`} no Painel` : `Abrir ${TELA[a.rota] ?? 'tela'}`}</button>
      </div>
    </div>
  );
}

function ModalConfig({ cfg, onClose, onSalvar }: { cfg: ConfigAlertas; onClose: () => void; onSalvar: (c: ConfigAlertas) => Promise<void> }) {
  const { session } = useAppData();
  const { toast } = useFeedback();
  const [f, setF] = useState(cfg);
  const [emails, setEmails] = useState(cfg.emails.join('\n'));
  const [salvando, setSalvando] = useState(false);
  const [testando, setTestando] = useState(false);
  const num = (k: keyof ConfigAlertas) => (
    <input type="number" min={0} max={365} className="input" value={Number(f[k])} onChange={(e) => setF({ ...f, [k]: Math.max(0, Number(e.target.value) || 0) })} />
  );
  const lista = () => emails.split(/[\s,;]+/).map((e) => e.trim()).filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));

  const salvar = async () => {
    setSalvando(true);
    try { await onSalvar({ ...f, emails: lista() }); toast({ kind: 'success', title: 'Configuração salva' }); onClose(); }
    catch (err) { toast({ kind: 'error', title: 'Não foi possível salvar', text: mensagemErro(err) }); }
    finally { setSalvando(false); }
  };

  const testar = async () => {
    setTestando(true);
    try {
      await onSalvar({ ...f, emails: lista() });
      const r = await fetch('/api/alertas-diarios?teste=1', { headers: { authorization: `Bearer ${session.access_token}` } });
      const tipo = r.headers.get('content-type') ?? '';
      if (!tipo.includes('json')) throw new Error('A função de e-mail ainda não está publicada. Ela só funciona no site da Vercel (não no "npm run dev").');
      const body = await r.json() as { enviado?: boolean; destinatarios?: string[]; erro?: string; motivo?: string };
      if (!r.ok || body.erro) throw new Error(body.erro ?? `Erro ${r.status}`);
      if (!body.enviado) toast({ kind: 'warning', title: 'E-mail não enviado', text: body.motivo });
      else toast({ kind: 'success', title: 'E-mail de teste enviado', text: `Para: ${body.destinatarios?.join(', ')}` });
    } catch (err) {
      toast({ kind: 'error', title: 'Falha no envio de teste', text: err instanceof Error ? err.message : String(err), duration: 9000 });
    } finally { setTestando(false); }
  };

  return (
    <Modal title="Configurar alertas" subtitle="E-mail diário às 8h (segunda a sábado) e prazos de cada alerta" onClose={onClose}
      footer={<>
        <button type="button" className="btn" onClick={testar} disabled={testando || salvando}><Send size={15} /> {testando ? 'Enviando…' : 'Salvar e enviar teste agora'}</button>
        <button type="button" className="btn btn-primary" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</button>
      </>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <label className="alerta-cfg__switch">
          <input type="checkbox" checked={f.ativo} onChange={(e) => setF({ ...f, ativo: e.target.checked })} />
          <span><strong>Enviar o resumo por e-mail todos os dias</strong><br /><small className="muted">Segunda a sábado, por volta das 8h (horário de Brasília).</small></span>
        </label>
        <div className="field">
          <label>Quem recebe (um e-mail por linha)</label>
          <textarea className="input" rows={3} value={emails} onChange={(e) => setEmails(e.target.value)} placeholder={'logistica@munila.com.br\ngerente@munila.com.br'} style={{ height: 'auto', paddingTop: 8 }} />
        </div>
        <div className="form-grid form-grid--auto" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <div className="field"><label>Sem coleta após (dias)</label>{num('dias_aguardando_coleta')}</div>
          <div className="field"><label>Sem CTE após (dias)</label>{num('dias_sem_cte')}</div>
          <div className="field"><label>Devolução parada após (dias)</label>{num('dias_devolucao_aberta')}</div>
          <div className="field"><label>Real acima do cotado em (%)</label>{num('margem_cotado_pct')}</div>
        </div>
        <details className="alerta-cfg__ajuda">
          <summary>Primeira vez? Como ligar o envio de e-mail (uma vez só)</summary>
          <ol>
            <li>Crie uma conta grátis em <strong>resend.com</strong> e copie a <em>API Key</em>.</li>
            <li>Na <strong>Vercel › Settings › Environment Variables</strong>, adicione <code>RESEND_API_KEY</code> (a chave do Resend) e <code>SUPABASE_SERVICE_ROLE_KEY</code> (Supabase › Settings › API › <em>service_role</em>).</li>
            <li>Recomendado: <code>CRON_SECRET</code> com um texto longo qualquer.</li>
            <li>Para enviar a outros e-mails além do seu, verifique o domínio da empresa no Resend e crie <code>ALERTAS_REMETENTE</code> (ex.: <code>MunilaLog &lt;alertas@munila.com.br&gt;</code>).</li>
            <li>Faça um novo deploy e use "Salvar e enviar teste agora".</li>
          </ol>
        </details>
      </div>
    </Modal>
  );
}

export default function Alertas() {
  const { isAdmin, setFiltros } = useAppData();
  const { toast } = useFeedback();
  const navigate = useNavigate();
  const { alertas, cfg, salvarConfig } = useAlertas(true);
  const [config, setConfig] = useState(false);

  const conta = (n: NivelAlerta) => alertas.filter((a) => a.nivel === n).reduce((s, a) => s + a.itens.length, 0);
  const texto = resumoTexto(alertas);
  // abre o Painel de Entregas mostrando SOMENTE as NFs do alerta (chip removível no topo)
  const abrirNf = (i: ItemAlerta) => {
    setFiltros(i.id ? { ...FILTROS_VAZIOS, nfsIds: [i.id], nfsRotulo: `Alerta: NF ${i.nf}` } : { ...FILTROS_VAZIOS, busca: i.nf });
    navigate('/dashboard');
  };
  const abrir = (a: Alerta) => {
    const ids = a.itens.map((i) => i.id).filter((x): x is string => !!x);
    if (ids.length) { setFiltros({ ...FILTROS_VAZIOS, nfsIds: ids, nfsRotulo: `Alerta: ${a.titulo}` }); navigate('/dashboard'); }
    else navigate(a.rota);
  };
  const copiar = async () => {
    try { await navigator.clipboard.writeText(texto); toast({ kind: 'success', title: 'Resumo copiado', text: 'Cole no WhatsApp, Teams ou e-mail.' }); }
    catch { toast({ kind: 'error', title: 'Não foi possível copiar' }); }
  };

  return (
    <div className="page">
      <PageHeader icon={<Bell size={22} />} title="Central de alertas" subtitle="O que precisa de ação hoje — calculado com os dados do sistema"
        actions={<>
          <button className="btn" onClick={copiar}><ClipboardCopy size={16} /> Copiar resumo</button>
          <a className="btn" href={`https://wa.me/?text=${encodeURIComponent(texto)}`} target="_blank" rel="noreferrer"><MessageCircle size={16} /> Enviar no WhatsApp</a>
          {isAdmin && <button className="btn btn-primary" onClick={() => setConfig(true)}><Settings size={16} /> Configurar</button>}
        </>} />

      <div className="alertas-resumo">
        <div className="alertas-resumo__item tone-red"><strong>{conta('critico')}</strong><span>críticos</span></div>
        <div className="alertas-resumo__item tone-amber"><strong>{conta('atencao')}</strong><span>atenção</span></div>
        <div className="alertas-resumo__item tone-blue"><strong>{conta('info')}</strong><span>informativos</span></div>
        <div className={`alertas-resumo__email ${cfg.ativo ? '' : 'is-off'}`}>
          {cfg.ativo ? <Mail size={18} /> : <BellOff size={18} />}
          <span>{cfg.ativo
            ? <>E-mail diário <strong>ligado</strong> para {cfg.emails.length ? cfg.emails.join(', ') : 'ninguém (cadastre os e-mails)'}</>
            : <>E-mail diário <strong>desligado</strong>{isAdmin ? ' — ligue em Configurar' : ''}</>}</span>
        </div>
      </div>

      {alertas.length ? (
        <div className="alertas-lista">
          {alertas.map((a) => <CartaoAlerta key={a.id} a={a} abrirNf={abrirNf} abrir={abrir} />)}
        </div>
      ) : (
        <div className="card"><EmptyState icon={<Bell size={28} />} title="Nenhum alerta hoje" text="Entregas, fretes e devoluções em dia." /></div>
      )}

      {config && <ModalConfig cfg={cfg} onClose={() => setConfig(false)} onSalvar={salvarConfig} />}
    </div>
  );
}
