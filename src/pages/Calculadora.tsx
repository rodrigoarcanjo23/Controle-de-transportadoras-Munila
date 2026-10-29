import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Award, Boxes, Calculator, Package, ChevronDown, ChevronRight, ClipboardCopy, Clock, MessageCircle, PackagePlus, Plus, Ruler, Target, Trash2, Truck, TriangleAlert,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { UFS } from '../lib/constants';
import { formatDate, formatMoney, hojeISO, matchesSearch, parseDecimalBR } from '../lib/format';
import { aprenderPrazos } from '../lib/sla';
import { loadPrefRaw, savePref } from '../lib/storage';
import { FATORES_CUBAGEM, calcularCarga, cotar, textoCotacao, textoVolPeso, type ItemCarga, type OpcaoCotacao } from '../lib/cotacao';
import type { TabelaFrete } from '../lib/tabelaFrete';
import { useAppData } from '../state/context';
import { useFeedback } from '../feedback/context';
import { EmptyState, Field, PageHeader } from '../components/ui/basics';
import { ClienteCombobox } from '../components/ui/ClienteCombobox';
import { ModalEntrega } from '../modals/ModalEntrega';
import type { Entrega } from '../types';
import './bi/bi.css';
import './financeiro/financeiro.css';
import './calculadora/calculadora.css';

let seq = 0;
const novoItem = (p?: Partial<ItemCarga>): ItemCarga => ({ id: `i${++seq}`, ...p });
const kg = (v: number) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kg`;

/** Simulador de frete: monta a carga do pedido e compara custo × prazo das transportadoras. */
export default function Calculadora() {
  const { produtos, clientes, transportadoras, entregas, metas, isAdmin } = useAppData();
  const { toast } = useFeedback();
  const hoje = hojeISO();

  const [itens, setItens] = useState<ItemCarga[]>(() => [novoItem()]);
  const [fator, setFatorState] = useState<number>(() => loadPrefRaw<number>('fatorCubagem', 300));
  const setFator = (f: number) => { setFatorState(f); savePref('fatorCubagem', f); };
  const [clienteId, setClienteId] = useState('');
  const [uf, setUf] = useState('');
  const [cidade, setCidade] = useState('');
  const [valor, setValor] = useState('');
  const [tabelas, setTabelas] = useState<TabelaFrete[]>([]);
  const [coletaDias, setColetaDias] = useState(1);
  const [aberta, setAberta] = useState<string | null>(null);
  const [criar, setCriar] = useState<Partial<Entrega> | null>(null);

  useEffect(() => {
    supabase.from('tabelas_frete').select('*').then(({ data }) => setTabelas((data ?? []) as TabelaFrete[]));
    supabase.from('configuracoes').select('valor').eq('chave', 'prazo_coleta_dias').maybeSingle()
      .then(({ data }) => { const n = Number(data?.valor); if (Number.isFinite(n) && n >= 0) setColetaDias(n); });
  }, []);

  const cliente = clientes.find((c) => String(c.id) === clienteId);
  const escolherCliente = (c: typeof cliente | null) => {
    setClienteId(c ? String(c.id) : '');
    if (c?.uf) setUf(c.uf.toUpperCase());
    if (c?.cidade) setCidade(c.cidade);
  };

  const carga = useMemo(() => calcularCarga(itens, produtos, fator), [itens, produtos, fator]);
  // sem valor digitado, usa o valor da mercadoria pelo preço unitário dos produtos
  const valorAuto = !valor.trim() && carga.valorMercadoria > 0;
  const valorNf = valor.trim() ? parseDecimalBR(valor) ?? 0 : carga.valorMercadoria;
  const produtosAtivos = useMemo(() => produtos.filter((p) => p.ativo !== false), [produtos]);
  const apr = useMemo(() => aprenderPrazos(entregas, hoje), [entregas, hoje]);
  const opcoes = useMemo(() => cotar({
    carga, valorNf, uf, clienteId: clienteId || undefined, transportadoras, tabelas, entregas, metas, apr, coletaDias, hoje,
  }), [carga, valorNf, uf, clienteId, transportadoras, tabelas, entregas, metas, apr, coletaDias, hoje]);
  const maisBarata = opcoes[0]?.t.id;
  const comPrazo = opcoes.filter((o) => o.prazo !== null);
  const maisRapida = comPrazo.length ? comPrazo.reduce((a, b) => ((b.prazo ?? 99) < (a.prazo ?? 99) || ((b.prazo ?? 99) === (a.prazo ?? 99) && b.custo < a.custo) ? b : a)).t.id : null;
  const melhor = opcoes.length > 1 ? opcoes.reduce((a, b) => (b.score > a.score ? b : a)).t.id : null;

  const setItem = (id: string, p: Partial<ItemCarga>) => setItens((xs) => xs.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const destino = [cidade, uf].filter(Boolean).join('/') || uf;

  const copiar = async (txt: string, titulo: string) => {
    try { await navigator.clipboard.writeText(txt); toast({ kind: 'success', title: titulo, text: txt.length < 60 ? txt : undefined }); }
    catch { toast({ kind: 'warning', title: 'Não foi possível copiar automaticamente.' }); }
  };

  function usar(o: OpcaoCotacao) {
    setCriar({
      cliente_id: cliente?.id ?? '', transportadora_id: o.t.id, uf_destino: uf || null, cidade_destino: cidade || null,
      modal_frete: o.t.modal_padrao || null, data_entrada_pedido: hoje, valor_nf: valorNf || null, valor_frete: o.custo,
      volume: carga.caixas || null, peso_kg: carga.pesoReal || null, data_previsao: o.previsao, tem_agendamento: !!cliente?.exige_agendamento,
      status: 'Pendente',
      observacoes: `Cotação ${formatDate(hoje)}: ${o.t.nome} ${formatMoney(o.custo)}${o.fonte === 'historico' ? ' (estimativa pelo histórico)' : ' (tabela)'}${o.prazo !== null ? `, ${o.prazo} d.u.` : ''}${carga.usaCubado ? ` · peso taxado ${kg(carga.pesoTaxado)} (cubado)` : ''}`,
    });
  }

  return (
    <div className="page calc">
      <PageHeader icon={<Calculator size={22} />} title="Simulador de frete"
        subtitle="Monte a carga do pedido, veja o peso cubado e compare custo, prazo e pontualidade das transportadoras para o destino" />

      <div className="calc-grid">
        {/* 1. Carga */}
        <section className="card card-pad calc-sec">
          <div className="calc-sec__tit"><span className="calc-num">1</span><h3>Carga do pedido</h3></div>
          <div className="calc-itens">
            {itens.map((it) => {
              const l = carga.linhas.find((x) => x.item.id === it.id);
              const avulso = !it.produtoId && (it.caixas !== undefined || it.descricao !== undefined);
              return (
                <div key={it.id} className="calc-item">
                  {avulso ? (
                    <div className="calc-item__campos calc-item__campos--avulso">
                      <Field label="Descrição"><input className="input" value={it.descricao ?? ''} onChange={(e) => setItem(it.id, { descricao: e.target.value })} placeholder="Ex.: caixa mista" /></Field>
                      <Field label="Volumes"><input className="input num" inputMode="numeric" value={it.caixas ?? ''} onChange={(e) => setItem(it.id, { caixas: parseInt(e.target.value) || 0 })} /></Field>
                      <Field label="Peso por volume (kg)"><input className="input num" inputMode="decimal" defaultValue={it.pesoCaixa ?? ''} onChange={(e) => setItem(it.id, { pesoCaixa: parseDecimalBR(e.target.value) ?? 0 })} /></Field>
                      <Field label="Medidas (cm)"><input className="input" value={it.medidas ?? ''} onChange={(e) => setItem(it.id, { medidas: e.target.value })} placeholder="40x30x25" /></Field>
                    </div>
                  ) : (
                    <div className="calc-item__campos">
                      <Field label="Produto do catálogo">
                        <ProdutoSelect value={it.produtoId ?? ''} onChange={(v) => setItem(it.id, { produtoId: v || undefined })} produtos={produtosAtivos} />
                      </Field>
                      <Field label="Quantidade (unidades)"><input className="input num" inputMode="numeric" value={it.unidades ?? ''} placeholder="Ex.: 350" onChange={(e) => setItem(it.id, { unidades: parseInt(e.target.value) || 0 })} /></Field>
                    </div>
                  )}
                  <div className="calc-item__res">
                    {l && l.caixas > 0 ? (<>
                      <b>{l.caixas} cx · {kg(l.peso)}</b>
                      <small>{l.m3 !== null ? `${l.m3.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} m³` : <span className="text-amber">sem medidas</span>}{l.sobra ? ` · última caixa com ${l.sobra} un. livres` : ''}</small>
                    </>) : <small className="muted">—</small>}
                  </div>
                  {itens.length > 1 && <button className="icon-btn icon-btn--sm" onClick={() => setItens((xs) => xs.filter((x) => x.id !== it.id))} aria-label="Remover item"><Trash2 size={15} /></button>}
                </div>
              );
            })}
          </div>
          <div className="calc-acoes">
            <button className="btn btn-sm" onClick={() => setItens((xs) => [...xs, novoItem()])}><Plus size={14} /> Produto</button>
            <button className="btn btn-sm" onClick={() => setItens((xs) => [...xs, novoItem({ descricao: '', caixas: 1 })])}><PackagePlus size={14} /> Volume avulso</button>
            {isAdmin && <Link className="btn btn-sm btn-ghost" to="/produtos" title="Criar, editar ou excluir produtos e completar medidas, pesos e preços"><Package size={14} /> Gerenciar produtos</Link>}
            <label className="calc-fator"><Ruler size={14} /> Fator de cubagem
              <select className="select" value={fator} onChange={(e) => setFator(Number(e.target.value))}>
                {FATORES_CUBAGEM.map((f) => <option key={f.valor} value={f.valor}>{f.label}</option>)}
              </select>
            </label>
          </div>
        </section>

        {/* Resumo da carga */}
        <section className="card card-pad calc-sec calc-resumo">
          <div className="calc-sec__tit"><Boxes size={18} /><h3>Resumo da carga</h3></div>
          <div className="calc-resumo__nums">
            <div><span>Volumes</span><strong>{carga.caixas}</strong></div>
            <div><span>Peso real</span><strong>{kg(carga.pesoReal)}</strong></div>
            <div><span>Cubagem</span><strong>{carga.m3 ? `${carga.m3.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} m³` : '—'}</strong></div>
            <div><span>Peso cubado</span><strong>{carga.m3 ? kg(carga.pesoCubado) : '—'}</strong></div>
          </div>
          <div className={`calc-taxado ${carga.usaCubado ? 'is-cubado' : ''}`}>
            <span>Peso taxado (o que a transportadora cobra)</span>
            <strong>{kg(carga.pesoTaxado)}</strong>
            <small>{carga.caixas ? (carga.usaCubado ? `Cobra-se o cubado: a carga ocupa mais espaço do que pesa (${carga.m3.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} m³ × ${fator.toLocaleString('pt-BR')} kg/m³).` : 'Cobra-se o peso real (maior que o cubado).') : 'Informe a carga ao lado.'}</small>
          </div>
          {carga.semMedidas > 0 && <p className="calc-aviso"><TriangleAlert size={14} /> {carga.semMedidas} item(ns) sem medidas no cadastro: a cubagem pode estar subestimada.{isAdmin && <> <Link to="/produtos">Completar cadastro</Link></>}</p>}
          <div className="calc-volpeso">
            <span>Coluna VOL/PESO da NF-e</span>
            <div><strong className="num">{textoVolPeso(carga)}</strong><button className="btn btn-sm" disabled={!carga.caixas} onClick={() => copiar(textoVolPeso(carga), 'Copiado')}><ClipboardCopy size={14} /> Copiar</button></div>
          </div>
        </section>

        {/* 2. Destino */}
        <section className="card card-pad calc-sec calc-destino">
          <div className="calc-sec__tit"><span className="calc-num">2</span><h3>Destino e mercadoria</h3></div>
          <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
            <Field label="Cliente (opcional)" className="span-2">
              <ClienteCombobox clientes={clientes} value={clienteId} onSelect={escolherCliente} />
            </Field>
            <Field label="UF de destino" required>
              <select className="select" value={uf} onChange={(e) => setUf(e.target.value)}>
                <option value="">Escolha…</option>
                {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </Field>
            <Field label="Cidade"><input className="input" value={cidade} onChange={(e) => setCidade(e.target.value)} /></Field>
            <Field label="Valor da mercadoria (R$)"
              hint={valorAuto ? `Calculado pelo preço dos produtos${carga.semPreco ? ` (${carga.semPreco} item(ns) sem preço)` : ''} — digite para trocar` : 'Entra no ad valorem, GRIS e % de frete'}>
              <input className="input num" inputMode="decimal" placeholder={carga.valorMercadoria > 0 ? carga.valorMercadoria.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'} value={valor} onChange={(e) => setValor(e.target.value)} />
            </Field>
          </div>
          {cliente?.exige_agendamento && <p className="calc-aviso"><Clock size={14} /> Este cliente exige agendamento: some o prazo de agendamento à previsão.</p>}
        </section>
      </div>

      {/* 3. Cotação */}
      <section className="card calc-cot">
        <div className="calc-cot__top">
          <div className="calc-sec__tit"><span className="calc-num">3</span><h3>Cotação{destino ? ` para ${destino}` : ''}</h3></div>
          {opcoes.length > 0 && (
            <div className="calc-acoes">
              <button className="btn btn-sm" onClick={() => copiar(textoCotacao(opcoes, carga, valorNf, destino), 'Cotação copiada')}><ClipboardCopy size={14} /> Copiar cotação</button>
              <a className="btn btn-sm" href={`https://wa.me/?text=${encodeURIComponent(textoCotacao(opcoes, carga, valorNf, destino))}`} target="_blank" rel="noreferrer"><MessageCircle size={14} /> WhatsApp</a>
            </div>
          )}
        </div>
        {!uf || carga.pesoTaxado <= 0 ? (
          <EmptyState icon={<Truck size={34} />} title="Informe a carga e a UF de destino" text="A cotação compara todas as transportadoras com tabela de frete para o destino e, sem tabela, estima o custo pelo frete real (CTEs) das últimas NFs da rota." />
        ) : !opcoes.length ? (
          <EmptyState icon={<Truck size={34} />} title={`Nenhuma transportadora com tabela ou histórico para ${uf}`}
            text={isAdmin ? 'Cadastre a tabela de frete em Cadastros › Transportadoras (ícone de recibo) ou registre os CTEs das entregas para esse estado.' : 'Peça a um administrador para cadastrar a tabela de frete das transportadoras.'} />
        ) : (
          <div className="table-scroll">
            <table className="bi-tabela calc-tabela">
              <thead><tr><th /><th>Transportadora</th><th className="r">Frete</th><th className="r">% da NF</th><th className="r">Prazo</th><th>Entrega prevista</th><th className="r">Pontualidade</th><th>Meta do cliente</th><th /></tr></thead>
              <tbody>
                {opcoes.map((o) => {
                  const ab = aberta === String(o.t.id);
                  return (
                    <FragmentLinha key={o.t.id} o={o} ab={ab} onToggle={() => setAberta(ab ? null : String(o.t.id))}
                      selos={<>
                        {o.t.id === melhor && <span className="badge tone-purple"><Award size={11} /> melhor custo-benefício</span>}
                        {o.t.id === maisBarata && <span className="badge tone-green">menor custo</span>}
                        {o.t.id === maisRapida && <span className="badge tone-blue"><Clock size={11} /> mais rápida</span>}
                      </>}
                      onUsar={isAdmin ? () => usar(o) : undefined} />
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted calc-nota">
          Peso taxado = maior entre o peso real e o cubado (m³ × fator). Custo pela <b>tabela de frete</b> da transportadora (frete peso, excedente, ad valorem, GRIS, pedágio, taxas, mínimo e ICMS) ou, sem tabela, <b>estimativa</b> pelo R$/kg real dos CTEs da rota nos últimos 12 meses (faixa típica ao abrir a linha).
          Prazo: contratado na tabela ou o tempo em que 80% das entregas chegaram; a entrega prevista conta a coleta em D+{coletaDias}. Pontualidade: % das entregas da rota que chegaram na previsão.
        </p>
      </section>

      {criar && <ModalEntrega modelo={criar} titulo="Nova entrega a partir da cotação" onClose={() => setCriar(null)} />}
    </div>
  );
}

function ProdutoSelect({ value, onChange, produtos }: { value: string; onChange: (v: string) => void; produtos: { id: string | number; codigo?: string; nome: string }[] }) {
  const [filtro, setFiltro] = useState('');
  const lista = useMemo(() => produtos.filter((p) => matchesSearch(filtro, p.codigo, p.nome)).slice(0, 300), [produtos, filtro]);
  return (
    <div className="calc-prod">
      <input className="input" placeholder="Filtrar por código ou nome…" value={filtro} onChange={(e) => setFiltro(e.target.value)} />
      <select className="select" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">— Escolha o produto ({lista.length}) —</option>
        {lista.map((p) => <option key={p.id} value={String(p.id)}>{p.codigo ? `${p.codigo} - ` : ''}{p.nome}</option>)}
      </select>
    </div>
  );
}

function FragmentLinha({ o, ab, onToggle, selos, onUsar }: { o: OpcaoCotacao; ab: boolean; onToggle: () => void; selos: React.ReactNode; onUsar?: () => void }) {
  return (<>
    <tr className={ab ? 'is-aberta' : ''} onClick={onToggle}>
      <td>{ab ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
      <td className="bi-tabela__nome"><span>{o.t.nome}<span className="calc-selos">{selos}</span></span><small className="muted calc-sub">{o.detalheCusto}</small></td>
      <td className="r"><b className="calc-custo">{formatMoney(o.custo)}</b>{o.fonte === 'historico' && <small className="muted calc-sub">estimativa</small>}</td>
      <td className="r">{o.pct !== null ? `${o.pct.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%` : '—'}</td>
      <td className="r" title={o.fontePrazo}>{o.prazo !== null ? `${o.prazo} d.u.` : <span className="muted">—</span>}</td>
      <td>{o.previsao ? formatDate(o.previsao) : <span className="muted">a confirmar</span>}</td>
      <td className="r">{o.pontualidade !== null ? <span className={o.pontualidade >= 90 ? 'text-green' : o.pontualidade >= 75 ? 'text-amber' : 'text-red'}>{o.pontualidade}%</span> : <span className="muted">—</span>}</td>
      <td>{o.meta === null ? <span className="muted">—</span> : o.dentroMeta ? <span className="badge tone-green"><Target size={11} /> dentro ({o.meta}%)</span> : <span className="badge tone-red"><Target size={11} /> acima ({o.meta}%)</span>}</td>
      <td>{onUsar && <button className="btn btn-sm btn-primary" onClick={(e) => { e.stopPropagation(); onUsar(); }} title="Criar a entrega no Painel com esta transportadora e o frete cotado">Usar</button>}</td>
    </tr>
    {ab && (
      <tr className="aud__det calc-det">
        <td />
        <td colSpan={8}>
          {o.calc ? (
            <div className="aud__comp">
              {o.calc.itens.map((i) => <div key={i.nome}><span>{i.nome}<small>{i.detalhe}</small></span><b>{formatMoney(i.valor)}</b></div>)}
              <div className="aud__comp-total"><span>Total pela tabela</span><b>{formatMoney(o.calc.total)}</b></div>
            </div>
          ) : o.faixa ? (
            <p className="calc-faixa">Faixa típica das últimas NFs da rota: <b>{formatMoney(o.faixa[0])}</b> a <b>{formatMoney(o.faixa[1])}</b>. Cadastre a tabela de frete desta transportadora para um valor exato e para auditar os CTEs.</p>
          ) : null}
          <p className="muted calc-faixa">Prazo: {o.fontePrazo || 'sem histórico suficiente'}{o.amostraPrazo ? ` · ${o.amostraPrazo} entregas na rota` : ''}.</p>
        </td>
      </tr>
    )}
  </>);
}
