import { useMemo, useState } from 'react';
import { Calculator, ClipboardCopy, Package } from 'lucide-react';
import { useAppData } from '../state/context';
import { useFeedback } from '../feedback/context';
import { formatDecimal, matchesSearch } from '../lib/format';
import { EmptyState, Field, PageHeader } from '../components/ui/basics';
import { CotacaoFrete } from './calculadora/CotacaoFrete';

export default function Calculadora() {
  const { produtos } = useAppData();
  const { toast } = useFeedback();
  const [produtoId, setProdutoId] = useState('');
  const [qtd, setQtd] = useState('');
  const [filtro, setFiltro] = useState('');

  const lista = useMemo(() => produtos.filter((p) => matchesSearch(filtro, p.codigo, p.nome)), [produtos, filtro]);
  const produto = produtos.find((p) => p.id === produtoId);
  const quantidade = parseInt(qtd) || 0;

  let caixas = 0; let peso = 0;
  if (produto && quantidade > 0) {
    caixas = Math.ceil(quantidade / produto.unidades_por_caixa);
    peso = caixas * produto.peso_caixa_kg;
  }
  const textoNF = `${caixas}CX ${peso.toFixed(2)}KG`;

  const copiar = async () => {
    try { await navigator.clipboard.writeText(textoNF); toast({ kind: 'success', title: 'Copiado', text: textoNF }); }
    catch { toast({ kind: 'warning', title: 'Não foi possível copiar automaticamente.' }); }
  };

  return (
    <div className="page">
      <PageHeader icon={<Calculator size={22} />} title="Calculadora" subtitle="Peso e caixaria do pedido e cotação do frete pelas tabelas das transportadoras" />

      <div className="chart-grid" style={{ alignItems: 'start' }}>
        <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h3 className="card-title">Dados do pedido</h3>
          <Field label="Filtrar catálogo">
            <input className="input" placeholder="Código ou nome do produto…" value={filtro} onChange={(e) => setFiltro(e.target.value)} />
          </Field>
          <Field label="Produto">
            <select className="select" value={produtoId} onChange={(e) => setProdutoId(e.target.value)}>
              <option value="">— Escolha um produto do catálogo —</option>
              {lista.map((p) => <option key={p.id} value={p.id}>{p.codigo} - {p.nome}</option>)}
            </select>
          </Field>
          <Field label="Quantidade solicitada (unidades)">
            <input type="number" min="0" inputMode="numeric" className="input num" placeholder="Ex: 350" value={qtd} onChange={(e) => setQtd(e.target.value)} />
          </Field>
          {produto && (
            <p className="muted" style={{ fontSize: '0.82rem' }}>
              {produto.unidades_por_caixa} un. por caixa · {formatDecimal(produto.peso_caixa_kg)} kg por caixa
            </p>
          )}
        </div>

        <div className="card card-pad">
          <h3 className="card-title" style={{ marginBottom: 16, color: 'var(--brand)' }}><Package size={20} /> Resultado para NF-e</h3>
          {produto ? (
            <div className="calc-result">
              <div className="calc-stat">
                <div className="kpi__label">Volume total (caixaria)</div>
                <div className="calc-stat__value">{caixas} <small style={{ fontSize: '1rem', fontWeight: 500 }}>caixa(s)</small></div>
              </div>
              <div className="calc-stat">
                <div className="kpi__label">Peso bruto total</div>
                <div className="calc-stat__value">{formatDecimal(peso)} <small style={{ fontSize: '1rem', fontWeight: 500 }}>kg</small></div>
              </div>
              <div className="calc-stat calc-stat--brand">
                <div className="kpi__label" style={{ color: 'inherit' }}>Preenchimento da coluna VOL/PESO</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 4 }}>
                  <strong style={{ fontSize: '1.3rem' }} className="num">{textoNF}</strong>
                  <button className="btn btn-sm" onClick={copiar} disabled={!quantidade}><ClipboardCopy size={14} /> Copiar</button>
                </div>
                <div style={{ fontSize: '0.85rem', marginTop: 8 }}>Cubagem padrão: {produto.medidas_cm || '-'}</div>
              </div>
            </div>
          ) : (
            <EmptyState icon={<Calculator size={40} />} title="Aguardando dados" text="Selecione um produto e informe a quantidade para calcular peso e volume automaticamente." />
          )}
        </div>
      </div>

      <CotacaoFrete pesoSugerido={peso} />
    </div>
  );
}
