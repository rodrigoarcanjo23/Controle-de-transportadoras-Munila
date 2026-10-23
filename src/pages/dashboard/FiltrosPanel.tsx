import { Eraser } from 'lucide-react';
import { MODAIS, REGIOES, STATUS_ENTREGA, UFS } from '../../lib/constants';
import { FILTROS_VAZIOS, FLAGS, type FiltrosEntrega } from '../../lib/filtrosEntrega';
import type { Transportadora } from '../../types';
import { Field } from '../../components/ui/basics';

export function FiltrosPanel({ filtros, setFiltros, transportadoras }: {
  filtros: FiltrosEntrega;
  setFiltros: (f: FiltrosEntrega | ((p: FiltrosEntrega) => FiltrosEntrega)) => void;
  transportadoras: Transportadora[];
}) {
  const set = <K extends keyof FiltrosEntrega>(k: K, v: FiltrosEntrega[K]) => setFiltros((p) => ({ ...p, [k]: v }));
  const toggleStatus = (s: string) =>
    setFiltros((p) => ({ ...p, status: p.status.includes(s) ? p.status.filter((x) => x !== s) : [...p.status, s] }));

  return (
    <div className="card filters-panel no-print">
      <div className="form-grid form-grid--auto" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))' }}>
        <Field label="Faturamento — de">
          <input type="date" className="input" value={filtros.dataInicio} onChange={(e) => set('dataInicio', e.target.value)} />
        </Field>
        <Field label="Faturamento — até">
          <input type="date" className="input" value={filtros.dataFim} onChange={(e) => set('dataFim', e.target.value)} />
        </Field>
        <Field label="Transportadora">
          <select className="select" value={filtros.transportadora} onChange={(e) => set('transportadora', e.target.value)}>
            <option value="">Todas</option>
            {transportadoras.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </select>
        </Field>
        <Field label="Modal">
          <select className="select" value={filtros.modal} onChange={(e) => set('modal', e.target.value)}>
            <option value="">Todos</option>
            {MODAIS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </Field>
        <Field label="Região">
          <select className="select" value={filtros.regiao} onChange={(e) => setFiltros((p) => ({ ...p, regiao: e.target.value, uf: '' }))}>
            <option value="">Todas</option>
            {Object.keys(REGIOES).map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </Field>
        <Field label="Estado (UF)">
          <select className="select" value={filtros.uf} onChange={(e) => setFiltros((p) => ({ ...p, uf: e.target.value, regiao: '' }))}>
            <option value="">Todos</option>
            {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
          </select>
        </Field>
        <Field label="Valor NF mín. (R$)">
          <input type="number" step="0.01" inputMode="decimal" className="input" value={filtros.valorNfMin} onChange={(e) => set('valorNfMin', e.target.value)} />
        </Field>
        <Field label="Valor NF máx. (R$)">
          <input type="number" step="0.01" inputMode="decimal" className="input" value={filtros.valorNfMax} onChange={(e) => set('valorNfMax', e.target.value)} />
        </Field>
        <Field label="% Frete mín.">
          <input type="number" step="0.01" inputMode="decimal" className="input" placeholder="Ex: 2,5" value={filtros.percFreteMin} onChange={(e) => set('percFreteMin', e.target.value)} />
        </Field>
        <Field label="% Frete máx.">
          <input type="number" step="0.01" inputMode="decimal" className="input" placeholder="Ex: 15" value={filtros.percFreteMax} onChange={(e) => set('percFreteMax', e.target.value)} />
        </Field>
      </div>

      <div>
        <div className="field__label" style={{ marginBottom: 8 }}>Condições</div>
        <div className="chips">
          {FLAGS.map(({ key, label }) => (
            <button key={key} type="button" className={`chip ${filtros[key] ? 'chip--on' : ''}`} aria-pressed={!!filtros[key]}
              onClick={() => set(key, !filtros[key] as never)}>{label}</button>
          ))}
        </div>
      </div>

      <div>
        <div className="field__label" style={{ marginBottom: 8 }}>Status da entrega <span className="muted" style={{ fontWeight: 500 }}>(escolha um ou vários)</span></div>
        <div className="chips">
          {STATUS_ENTREGA.map((s) => (
            <button key={s} type="button" className={`chip ${filtros.status.includes(s) ? 'chip--on' : ''}`} aria-pressed={filtros.status.includes(s)} onClick={() => toggleStatus(s)}>{s}</button>
          ))}
        </div>
      </div>

      <div className="filters-panel__footer">
        <span className="muted" style={{ fontSize: '0.8rem' }}>Os filtros ficam salvos neste dispositivo.</span>
        <button type="button" className="btn btn-danger-outline" onClick={() => setFiltros({ ...FILTROS_VAZIOS, busca: filtros.busca })}>
          <Eraser size={16} /> Limpar filtros
        </button>
      </div>
    </div>
  );
}
