import { useEffect, useMemo, useState } from 'react';
import '../bi/bi.css';
import { Award, Clock, Receipt } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { UFS } from '../../lib/constants';
import { formatMoney, formatPercent, parseDecimalBR } from '../../lib/format';
import { aprenderPrazos } from '../../lib/sla';
import { calcularFrete, tabelaPara, type TabelaFrete } from '../../lib/tabelaFrete';
import { useAppData } from '../../state/context';
import { Field } from '../../components/ui/basics';

/** Cotação pelas tabelas de frete cadastradas: custo × prazo de cada transportadora para o destino. */
export function CotacaoFrete({ pesoSugerido }: { pesoSugerido: number }) {
  const { transportadoras, entregas } = useAppData();
  const [tabelas, setTabelas] = useState<TabelaFrete[] | null>(null);
  const [uf, setUf] = useState('SP');
  const [peso, setPeso] = useState('');
  const [valor, setValor] = useState('');

  useEffect(() => {
    supabase.from('tabelas_frete').select('*').then(({ data, error }) => setTabelas(error ? [] : (data ?? []) as TabelaFrete[]));
  }, []);
  const apr = useMemo(() => aprenderPrazos(entregas), [entregas]);

  const p = parseDecimalBR(peso) ?? pesoSugerido;
  const v = parseDecimalBR(valor) ?? 0;
  const opcoes = useMemo(() => {
    if (!tabelas) return [];
    return transportadoras.flatMap((t) => {
      const tab = tabelaPara(tabelas, String(t.id), uf);
      if (!tab) return [];
      const calc = calcularFrete(tab.componentes, p, v);
      const hist = apr.porTranspUf.get(`${t.nome.toUpperCase()}|${uf}`);
      const prazo = tab.componentes.prazo_dias ?? (hist && hist.n >= 3 ? hist.p80 : null);
      return [{ t, tab, calc, prazo, fontePrazo: tab.componentes.prazo_dias ? 'contratado' : hist && hist.n >= 3 ? `histórico (${hist.n})` : '' }];
    }).sort((a, b) => a.calc.total - b.calc.total);
  }, [tabelas, transportadoras, uf, p, v, apr]);
  const maisBarato = opcoes[0]?.t.id;
  const comPrazo = opcoes.filter((o) => o.prazo !== null);
  const maisRapido = comPrazo.length ? comPrazo.reduce((a, b) => ((b.prazo ?? 99) < (a.prazo ?? 99) ? b : a)).t.id : null;

  return (
    <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <h3 className="card-title"><Receipt size={18} /> Cotação pelas tabelas de frete</h3>
      <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        <Field label="UF de destino">
          <select className="select" value={uf} onChange={(e) => setUf(e.target.value)}>{UFS.map((u) => <option key={u} value={u}>{u}</option>)}</select>
        </Field>
        <Field label="Peso (kg)"><input className="input" inputMode="decimal" placeholder={pesoSugerido ? pesoSugerido.toFixed(2).replace('.', ',') : '0'} value={peso} onChange={(e) => setPeso(e.target.value)} /></Field>
        <Field label="Valor da NF (R$)"><input className="input" inputMode="decimal" placeholder="0,00" value={valor} onChange={(e) => setValor(e.target.value)} /></Field>
      </div>
      {tabelas === null ? <p className="muted">Carregando tabelas…</p>
        : !tabelas.length ? <p className="muted">Nenhuma tabela de frete cadastrada. Cadastre em <b>Cadastros › Transportadoras</b> (botão de tabela em cada transportadora).</p>
        : !opcoes.length ? <p className="muted">Nenhuma transportadora com tabela para {uf}.</p>
        : (
          <div className="table-scroll">
            <table className="bi-tabela">
              <thead><tr><th>Transportadora</th><th className="r">Frete</th><th className="r">% da NF</th><th className="r">Prazo</th><th /></tr></thead>
              <tbody>
                {opcoes.map((o) => (
                  <tr key={o.t.id}>
                    <td className="bi-tabela__nome"><span>{o.t.nome} <small className="muted">{o.tab.uf === '*' ? 'tabela geral' : `tabela ${o.tab.uf}`}{o.calc.minimoAplicado ? ' · frete mínimo' : ''}</small></span></td>
                    <td className="r strong">{formatMoney(o.calc.total)}</td>
                    <td className="r">{v > 0 ? formatPercent((o.calc.total / v) * 100) : '—'}</td>
                    <td className="r">{o.prazo !== null ? <span title={o.fontePrazo}>{o.prazo} d.u.</span> : <span className="muted">—</span>}</td>
                    <td>
                      {o.t.id === maisBarato && <span className="badge tone-green"><Award size={12} /> menor custo</span>}{' '}
                      {o.t.id === maisRapido && <span className="badge tone-blue"><Clock size={12} /> mais rápido</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      <p className="muted" style={{ fontSize: '0.78rem' }}>Prazo: o contratado na tabela ou, se não houver, o tempo real de 80% das entregas da transportadora para a UF (dias úteis, coleta → entrega).</p>
    </div>
  );
}
