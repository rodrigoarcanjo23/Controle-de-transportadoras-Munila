import { useEffect, useState } from 'react';
import { CircleCheck, FileImage, Loader2, MapPin, Package, Truck } from 'lucide-react';
import { formatDate } from '../../lib/format';
import { etapaAtual, statusParaCliente, type EtapaRastreio, type RastreioDados } from '../../lib/rastreio';
import './rastreio.css';

const ETAPAS: [EtapaRastreio, string, typeof Package][] = [
  ['faturado', 'Pedido faturado', Package], ['coletado', 'Coletado', Truck], ['transito', 'Em trânsito', MapPin], ['entregue', 'Entregue', CircleCheck],
];

/** Página pública de rastreio de uma NF (link enviado ao cliente). */
export default function Rastreio() {
  const token = window.location.pathname.split('/')[2] ?? '';
  const [d, setD] = useState<RastreioDados | null>(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    document.title = 'Rastreio do pedido · Munila';
    fetch(`/api/rastreio?t=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const tipo = r.headers.get('content-type') ?? '';
        if (!tipo.includes('json')) throw new Error('O rastreio só funciona no endereço publicado do sistema.');
        const b = await r.json();
        if (!r.ok) throw new Error(b.erro ?? 'Não foi possível carregar.');
        setD(b as RastreioDados);
      })
      .catch((e) => setErro(e instanceof Error ? e.message : 'Não foi possível carregar.'));
  }, [token]);

  const atual = d ? etapaAtual(d) : 'faturado';
  const idx = ETAPAS.findIndex(([k]) => k === atual);
  return (
    <div className="rast">
      <header className="rast__top">
        <img src="/favicon.png" alt="" />
        <div><strong>Rastreio do pedido</strong><span>Munila</span></div>
      </header>
      {erro ? <div className="rast__erro">{erro}</div>
        : !d ? <div className="rast__carregando"><Loader2 className="spin" size={22} /> Carregando…</div>
        : (
          <main className="rast__main">
            <section className="rast__card">
              <span className="rast__nf">Nota fiscal {d.nf}</span>
              <h1>{statusParaCliente(d)}</h1>
              <p className="rast__sub">{d.cliente}{d.cidade ? ` · ${d.cidade}/${d.uf}` : ''}</p>
              {d.status === 'Entregue'
                ? <div className="rast__destaque rast__destaque--ok"><CircleCheck size={18} /> Entregue em <b>{formatDate(d.entrega)}</b></div>
                : d.agendamento ? <div className="rast__destaque">Entrega agendada para <b>{formatDate(d.agendamento)}</b></div>
                : d.previsao ? <div className="rast__destaque">Previsão de entrega: <b>{formatDate(d.previsao)}</b></div> : null}
              <ol className="rast__etapas">
                {ETAPAS.map(([k, l, Ic], i) => (
                  <li key={k} className={i < idx ? 'is-ok' : i === idx ? 'is-on' : ''}>
                    <span><Ic size={16} /></span>
                    <b>{l}</b>
                    <small>{k === 'faturado' ? formatDate(d.faturamento) : k === 'coletado' ? (d.coleta ? formatDate(d.coleta) : '') : k === 'entregue' ? (d.entrega ? formatDate(d.entrega) : '') : ''}</small>
                  </li>
                ))}
              </ol>
              {d.canhotoUrl && <a className="rast__btn" href={d.canhotoUrl} target="_blank" rel="noreferrer"><FileImage size={16} /> Ver comprovante de entrega (canhoto)</a>}
            </section>

            <section className="rast__card">
              <h2>Detalhes</h2>
              <dl className="rast__dl">
                <dt>Transportadora</dt><dd>{d.transportadora || '—'}</dd>
                <dt>Faturado em</dt><dd>{formatDate(d.faturamento)}</dd>
                <dt>Coletado em</dt><dd>{d.coleta ? formatDate(d.coleta) : 'aguardando coleta'}</dd>
                {d.status !== 'Entregue' && <><dt>Previsão</dt><dd>{d.previsao ? formatDate(d.previsao) : 'a definir'}</dd></>}
              </dl>
              {d.ocorrencias.length > 0 && (<>
                <h2>Atualizações da transportadora</h2>
                <ul className="rast__oc">
                  {[...d.ocorrencias].reverse().map((o, i) => <li key={i}><b>{o.descricao}</b><small>{formatDate(o.data)}</small></li>)}
                </ul>
              </>)}
            </section>
            <p className="rast__rodape">Dúvidas sobre o pedido? Fale com seu vendedor da Munila.</p>
          </main>
        )}
    </div>
  );
}
