import { useEffect, useMemo, useState } from 'react';
import { Calculator, Copy, Plus, Save, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { mensagemErro, registrarLog } from '../../lib/db';
import { UFS } from '../../lib/constants';
import { formatMoney, parseDecimalBR } from '../../lib/format';
import { COMPONENTES_VAZIOS, calcularFrete, normalizar, type Componentes, type TabelaFrete } from '../../lib/tabelaFrete';
import { useAppData } from '../../state/context';
import { useFeedback } from '../../feedback/context';
import { Modal } from '../../components/ui/Modal';
import type { Transportadora } from '../../types';

/** Campo numérico que aceita vírgula. */
function Num({ v, on, step, w }: { v: number | null | undefined; on: (n: number) => void; step?: string; w?: number }) {
  const [txt, setTxt] = useState(v ? String(v).replace('.', ',') : '');
  return <input className="input tf-num" inputMode="decimal" style={w ? { width: w } : undefined} value={txt} placeholder="0" step={step}
    onChange={(e) => { setTxt(e.target.value); on(parseDecimalBR(e.target.value) ?? 0); }} />;
}

/** Cadastro das tabelas de frete de uma transportadora (uma por UF, ou "todas as UFs"). */
export function ModalTabelaFrete({ t, onClose }: { t: Transportadora; onClose: () => void }) {
  const { isAdmin } = useAppData();
  const { toast, confirm } = useFeedback();
  const [tabelas, setTabelas] = useState<TabelaFrete[] | null>(null);
  const [erro, setErro] = useState('');
  const [uf, setUf] = useState('*');
  const [comp, setComp] = useState<Componentes>(COMPONENTES_VAZIOS);
  const [versao, setVersao] = useState(0); // força recriar os campos ao trocar de UF
  const [salvando, setSalvando] = useState(false);
  const [sim, setSim] = useState({ peso: 25, valor: 3000 });

  useEffect(() => {
    let vivo = true;
    supabase.from('tabelas_frete').select('*').eq('transportadora_id', String(t.id)).order('uf').then(({ data, error }) => {
      if (!vivo) return;
      if (error) { setErro(/does not exist|schema cache/i.test(error.message) ? 'Rode o arquivo supabase/fase1_portal_frete_expedicao.sql no Supabase para liberar as tabelas de frete.' : mensagemErro(error)); setTabelas([]); return; }
      const l = (data ?? []) as TabelaFrete[];
      setTabelas(l);
      if (l[0]) { setUf(l[0].uf); setComp(normalizar(l[0].componentes)); setVersao((x) => x + 1); }
    });
    return () => { vivo = false; };
  }, [t.id]);

  const existente = tabelas?.find((x) => x.uf === uf);
  const escolherUf = (u: string) => {
    setUf(u);
    const ex = tabelas?.find((x) => x.uf === u);
    setComp(ex ? normalizar(ex.componentes) : existente ? normalizar(existente.componentes) : COMPONENTES_VAZIOS); // nova UF começa copiando a atual
    setVersao((x) => x + 1);
  };
  const calc = useMemo(() => calcularFrete(comp, sim.peso, sim.valor), [comp, sim]);
  const set = <K extends keyof Componentes>(k: K, v: Componentes[K]) => setComp((c) => ({ ...c, [k]: v }));

  async function salvar() {
    setSalvando(true);
    const componentes = normalizar(comp);
    const { data, error } = await supabase.from('tabelas_frete')
      .upsert({ transportadora_id: String(t.id), uf, componentes, ativo: true, updated_at: new Date().toISOString() }, { onConflict: 'transportadora_id,uf' })
      .select('*').single();
    setSalvando(false);
    if (error) { toast({ kind: 'error', title: 'Não foi possível salvar', text: mensagemErro(error) }); return; }
    setTabelas((l) => [...(l ?? []).filter((x) => x.uf !== uf), data as TabelaFrete].sort((a, b) => a.uf.localeCompare(b.uf)));
    registrarLog('EDITOU', 'TRANSPORTADORAS', `Salvou a tabela de frete de ${t.nome} para ${uf === '*' ? 'todas as UFs' : uf}`);
    toast({ kind: 'success', title: 'Tabela salva', text: `${t.nome} · ${uf === '*' ? 'todas as UFs' : uf}` });
  }
  async function excluir() {
    if (!existente || !(await confirm({ title: `Excluir a tabela ${uf === '*' ? 'geral' : uf}?`, danger: true, confirmLabel: 'Excluir' }))) return;
    const { error } = await supabase.from('tabelas_frete').delete().eq('transportadora_id', String(t.id)).eq('uf', uf);
    if (error) { toast({ kind: 'error', title: 'Erro', text: mensagemErro(error) }); return; }
    setTabelas((l) => (l ?? []).filter((x) => x.uf !== uf));
    registrarLog('APAGOU', 'TRANSPORTADORAS', `Excluiu a tabela de frete de ${t.nome} para ${uf === '*' ? 'todas as UFs' : uf}`);
  }

  const ro = !isAdmin;
  return (
    <Modal size="lg" title={`Tabela de frete · ${t.nome}`} subtitle="Usada para auditar cada CTE (frete esperado × cobrado) e para cotar na Calculadora" onClose={onClose}
      footer={<>
        {isAdmin && existente && <button type="button" className="btn btn-ghost" onClick={excluir} style={{ marginRight: 'auto' }}><Trash2 size={15} /> Excluir esta UF</button>}
        <button type="button" className="btn" onClick={onClose}>Fechar</button>
        {isAdmin && <button type="button" className="btn btn-primary" onClick={salvar} disabled={salvando}><Save size={15} /> {salvando ? 'Salvando…' : 'Salvar tabela'}</button>}
      </>}>
      {erro ? <div className="callout tone-red">{erro}</div> : !tabelas ? <p className="muted">Carregando…</p> : (
        <div className="tf">
          <div className="tf__ufs">
            <span className="muted">Destino:</span>
            <select className="select" value={uf} onChange={(e) => escolherUf(e.target.value)} style={{ width: 'auto' }}>
              <option value="*">Todas as UFs (tabela geral)</option>
              {UFS.map((u) => <option key={u} value={u}>{u}{tabelas.some((x) => x.uf === u) ? ' ✓' : ''}</option>)}
            </select>
            {tabelas.map((x) => <button key={x.uf} className={`chip ${x.uf === uf ? 'chip--on' : ''}`} onClick={() => escolherUf(x.uf)}>{x.uf === '*' ? 'Geral' : x.uf}</button>)}
            {!existente && <span className="badge tone-amber">nova{tabelas.length ? ' (copiando a tabela aberta antes)' : ''}</span>}
          </div>

          <fieldset className="tf__grid" disabled={ro} key={versao}>
            <div className="tf__bloco">
              <h4>Frete peso por faixa</h4>
              <table className="tf__faixas">
                <thead><tr><th>Até (kg)</th><th>Valor (R$)</th><th /></tr></thead>
                <tbody>
                  {comp.faixas.map((f, i) => (
                    <tr key={i}>
                      <td><Num v={f.ate_kg} on={(n) => set('faixas', comp.faixas.map((x, j) => (j === i ? { ...x, ate_kg: n } : x)))} /></td>
                      <td><Num v={f.valor} on={(n) => set('faixas', comp.faixas.map((x, j) => (j === i ? { ...x, valor: n } : x)))} /></td>
                      <td><button type="button" className="icon-btn icon-btn--sm" onClick={() => set('faixas', comp.faixas.filter((_, j) => j !== i))} aria-label="Remover faixa"><Trash2 size={14} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => set('faixas', [...comp.faixas, { ate_kg: (comp.faixas.at(-1)?.ate_kg ?? 0) + 50, valor: 0 }])}><Plus size={14} /> Faixa</button>
              <label className="tf__campo">Excedente (R$ por kg acima da última faixa)<Num v={comp.excedente_kg} on={(n) => set('excedente_kg', n)} /></label>
            </div>

            <div className="tf__bloco">
              <h4>Percentuais e generalidades</h4>
              <label className="tf__campo">Frete-valor / ad valorem (% da NF)<Num v={comp.advalorem_pct} on={(n) => set('advalorem_pct', n)} /></label>
              <label className="tf__campo">GRIS (% da NF)<Num v={comp.gris_pct} on={(n) => set('gris_pct', n)} /></label>
              <label className="tf__campo">Pedágio (R$ por fração de 100 kg)<Num v={comp.pedagio_100kg} on={(n) => set('pedagio_100kg', n)} /></label>
              <label className="tf__campo">Frete mínimo (R$)<Num v={comp.minimo} on={(n) => set('minimo', n)} /></label>
              <label className="tf__campo">ICMS por dentro (%) <small>0 se a tabela já tem imposto</small><Num v={comp.icms_pct} on={(n) => set('icms_pct', n)} /></label>
              <label className="tf__campo">Prazo contratado (dias úteis) <small>opcional — usado no SLA</small><Num v={comp.prazo_dias ?? 0} on={(n) => set('prazo_dias', n || null)} /></label>
            </div>

            <div className="tf__bloco">
              <h4>Taxas fixas <small>(TDE, TAS, despacho, agendamento…)</small></h4>
              {comp.taxas.map((x, i) => (
                <div key={i} className="tf__taxa">
                  <input className="input" value={x.nome} placeholder="Nome" onChange={(e) => set('taxas', comp.taxas.map((y, j) => (j === i ? { ...y, nome: e.target.value } : y)))} />
                  <Num v={x.valor} w={100} on={(n) => set('taxas', comp.taxas.map((y, j) => (j === i ? { ...y, valor: n } : y)))} />
                  <button type="button" className="icon-btn icon-btn--sm" onClick={() => set('taxas', comp.taxas.filter((_, j) => j !== i))} aria-label="Remover taxa"><Trash2 size={14} /></button>
                </div>
              ))}
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => set('taxas', [...comp.taxas, { nome: comp.taxas.length ? '' : 'TDE', valor: 0 }])}><Plus size={14} /> Taxa</button>
            </div>
          </fieldset>

          <div className="tf__sim">
            <h4><Calculator size={16} /> Simular</h4>
            <div className="tf__sim-in">
              <label className="tf__campo">Peso (kg)<Num v={sim.peso} on={(n) => setSim((s) => ({ ...s, peso: n }))} /></label>
              <label className="tf__campo">Valor da NF (R$)<Num v={sim.valor} on={(n) => setSim((s) => ({ ...s, valor: n }))} /></label>
            </div>
            <table className="tf__calc">
              <tbody>
                {calc.itens.map((i) => <tr key={i.nome}><td>{i.nome}<small>{i.detalhe}</small></td><td>{formatMoney(i.valor)}</td></tr>)}
                <tr className="tf__total"><td>Frete esperado</td><td>{formatMoney(calc.total)}</td></tr>
              </tbody>
            </table>
            {sim.valor > 0 && <p className="muted" style={{ fontSize: '0.8rem' }}>{((calc.total / sim.valor) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}% do valor da NF</p>}
            {isAdmin && tabelas.length > 0 && (
              <p className="muted" style={{ fontSize: '0.78rem' }}><Copy size={12} /> Para criar a tabela de outra UF, escolha a UF acima: ela começa como cópia desta.</p>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
