import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  Boxes, CheckCircle2, Copy, Download, FileSpreadsheet, Package, Pencil, Plus, Ruler, Trash2, TriangleAlert, Upload,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { registrarLog, mensagemErro } from '../lib/db';
import { formatMoney, matchesSearch, parseDecimalBR, toNumber } from '../lib/format';
import { downloadCsv, splitCsvLine } from '../lib/csv';
import { lerArquivoTexto } from '../lib/xml';
import { loadPrefRaw } from '../lib/storage';
import { infoCaixa, medidasProduto } from '../lib/cotacao';
import {
  CABECALHO_CSV, FORM_VAZIO, completoParaFrete, formDaLinha, formDe, linhaCsv, pendencias, produtoExistente, registroCompleto, registroDe, validar, type FormProduto,
} from '../lib/produtos';
import { useAppData } from '../state/context';
import { useFeedback } from '../feedback/context';
import { Badge, Check, Field, KpiCard, PageHeader, SearchInput } from '../components/ui/basics';
import { DataTable, type Column } from '../components/ui/DataTable';
import { Modal, ModalActions } from '../components/ui/Modal';
import type { Produto } from '../types';
import './produtos/produtos.css';

type Filtro = 'todos' | 'incompletos' | 'sem_preco' | 'inativos';
const kg = (v: number) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} kg`;
const m3 = (v: number) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 4 })} m³`;

/** Cadastro de produtos — a base do Simulador de frete (caixas, peso, cubagem e valor da mercadoria). */
export default function Produtos() {
  const { produtos, recarregarCadastros, loading } = useAppData();
  const { toast, confirm } = useFeedback();
  const fator = loadPrefRaw<number>('fatorCubagem', 300);
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [editando, setEditando] = useState<Produto | null>(null);
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState<FormProduto>(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [importando, setImportando] = useState(false);
  /** null = verificando; false = o banco ainda não tem os campos novos (falta rodar produtos.sql) */
  const [completo, setCompleto] = useState<boolean | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.from('produtos').select('comprimento_cm, preco_unitario, ativo').limit(1).then(({ error }) => setCompleto(!error));
  }, []);

  const stats = useMemo(() => {
    const ativos = produtos.filter((p) => p.ativo !== false);
    return {
      total: produtos.length, ativos: ativos.length,
      completos: ativos.filter(completoParaFrete).length,
      incompletos: ativos.filter((p) => !completoParaFrete(p)).length,
      semPreco: ativos.filter((p) => !(toNumber(p.preco_unitario) > 0)).length,
      inativos: produtos.length - ativos.length,
    };
  }, [produtos]);

  const linhas = useMemo(() => produtos.filter((p) => {
    if (!matchesSearch(busca, p.codigo, p.nome, p.ean)) return false;
    if (filtro === 'inativos') return p.ativo === false;
    if (p.ativo === false) return filtro === 'todos';
    if (filtro === 'incompletos') return !completoParaFrete(p);
    if (filtro === 'sem_preco') return !(toNumber(p.preco_unitario) > 0);
    return true;
  }), [produtos, busca, filtro]);

  const abrir = (p?: Produto, copia = false) => {
    setEditando(p && !copia ? p : null);
    setForm(p ? { ...formDe(p), ...(copia ? { codigo: '', ean: '', nome: `${p.nome} (CÓPIA)` } : {}) } : FORM_VAZIO);
    setAberto(true);
  };

  const { erros, avisos } = validar(form);
  const previa = useMemo(() => infoCaixa(registroCompleto(form), fator), [form, fator]);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (erros.length) { toast({ kind: 'warning', title: 'Confira o cadastro', text: erros[0] }); return; }
    setSalvando(true);
    const payload = registroDe(form, completo !== false);
    try {
      if (editando) {
        const { error } = await supabase.from('produtos').update(payload).eq('id', editando.id);
        if (error) throw error;
        await registrarLog('EDITOU', 'PRODUTOS', `Editou o produto: ${payload.codigo ? `${payload.codigo} - ` : ''}${payload.nome}`);
      } else {
        const { error } = await supabase.from('produtos').insert([payload]);
        if (error) throw error;
        await registrarLog('CRIOU', 'PRODUTOS', `Cadastrou o produto: ${payload.codigo ? `${payload.codigo} - ` : ''}${payload.nome}`);
      }
      toast({ kind: 'success', title: editando ? 'Produto atualizado' : 'Produto cadastrado', text: payload.nome });
      setAberto(false);
      recarregarCadastros();
    } catch (err) {
      const dup = (err as { code?: string })?.code === '23505';
      toast({ kind: 'error', title: 'Erro ao salvar produto', text: dup ? `Já existe um produto com o código ${payload.codigo}.` : mensagemErro(err) });
    } finally { setSalvando(false); }
  }

  async function alternarAtivo(p: Produto) {
    const { error } = await supabase.from('produtos').update({ ativo: p.ativo === false }).eq('id', p.id);
    if (error) { toast({ kind: 'error', title: 'Não foi possível alterar', text: mensagemErro(error) }); return; }
    await registrarLog('EDITOU', 'PRODUTOS', `${p.ativo === false ? 'Reativou' : 'Desativou'} o produto: ${p.nome}`);
    toast({ kind: 'success', title: p.ativo === false ? 'Produto reativado' : 'Produto desativado', text: p.ativo === false ? undefined : 'Ele some da lista do simulador, mas fica no cadastro.' });
    recarregarCadastros();
  }

  async function excluir(p: Produto) {
    const ok = await confirm({ title: `Excluir ${p.nome}?`, text: 'O produto sai do cadastro e do Simulador de frete. Esta ação não pode ser desfeita.', danger: true, confirmLabel: 'Excluir' });
    if (!ok) return;
    const { error } = await supabase.from('produtos').delete().eq('id', p.id);
    if (error) {
      if (error.code === '23503' && completo) {
        const des = await confirm({ title: 'Este produto está vinculado a outros registros', text: 'Não dá para excluir, mas você pode desativá-lo: ele some do simulador e o histórico continua intacto.', confirmLabel: 'Desativar' });
        if (des) await alternarAtivo({ ...p, ativo: true });
        return;
      }
      toast({ kind: 'error', title: 'Não foi possível excluir', text: error.code === '23503' ? 'Este produto está vinculado a outros registros.' : mensagemErro(error) });
      return;
    }
    await registrarLog('APAGOU', 'PRODUTOS', `Excluiu o produto: ${p.codigo ? `${p.codigo} - ` : ''}${p.nome}`);
    toast({ kind: 'success', title: 'Produto excluído' });
    recarregarCadastros();
  }

  async function importarCsv(file: File) {
    setImportando(true);
    try {
      const texto = await lerArquivoTexto(file);
      const ls = texto.split(/\r?\n/);
      const sep: ',' | ';' = (ls[0]?.split(';').length ?? 0) > (ls[0]?.split(',').length ?? 0) ? ';' : ',';
      const forms = ls.slice(1).map((l) => l.trim()).filter(Boolean).map((l) => formDaLinha(splitCsvLine(l, sep))).filter((x): x is FormProduto => x !== null);
      const invalidos = forms.filter((f) => validar(f).erros.length);
      const validos = forms.filter((f) => !validar(f).erros.length);
      if (!validos.length) { toast({ kind: 'warning', title: 'Nenhum produto válido na planilha.', text: invalidos.length ? validar(invalidos[0]).erros[0] : 'Use o modelo (botão "Modelo").' }); return; }
      // a mesma planilha pode repetir um código: fica a última linha
      const unicos = new Map<string, FormProduto>();
      validos.forEach((f) => unicos.set(f.codigo.trim().toLowerCase() || `#${f.nome.trim().toUpperCase()}`, f));
      const novos: FormProduto[] = []; const atualizar: [Produto, FormProduto][] = [];
      unicos.forEach((f) => { const ex = produtoExistente(produtos, f); if (ex) atualizar.push([ex, f]); else novos.push(f); });
      const ok = await confirm({
        title: `Importar ${unicos.size} produto(s)?`,
        text: `${novos.length} novo(s) e ${atualizar.length} já cadastrado(s) (atualizados pelo código)${invalidos.length ? `; ${invalidos.length} linha(s) com erro serão ignoradas` : ''}.`,
        confirmLabel: 'Importar',
      });
      if (!ok) return;
      const cmp = completo !== false;
      for (let i = 0; i < novos.length; i += 100) {
        const { error } = await supabase.from('produtos').insert(novos.slice(i, i + 100).map((f) => registroDe(f, cmp)));
        if (error) throw error;
      }
      let falhas = 0;
      for (let i = 0; i < atualizar.length; i += 20) {
        const res = await Promise.all(atualizar.slice(i, i + 20).map(([p, f]) => supabase.from('produtos').update(registroDe(f, cmp)).eq('id', p.id)));
        falhas += res.filter((r) => r.error).length;
      }
      await registrarLog('CRIOU', 'PRODUTOS', `Importou planilha de produtos: ${novos.length} novo(s), ${atualizar.length - falhas} atualizado(s)`);
      toast({ kind: falhas ? 'warning' : 'success', title: 'Importação concluída', text: `${novos.length} novo(s), ${atualizar.length - falhas} atualizado(s)${falhas ? `, ${falhas} falha(s)` : ''}.` });
      await recarregarCadastros();
    } catch (err) {
      toast({ kind: 'error', title: 'Erro ao importar planilha', text: mensagemErro(err, 'Verifique a formatação do arquivo.') });
    } finally {
      setImportando(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const exportar = () => downloadCsv('produtos', CABECALHO_CSV, (produtos.length ? produtos : []).map(linhaCsv));
  const modelo = () => downloadCsv('modelo_produtos', CABECALHO_CSV, [['P001', 'DIPIRONA 500MG CX 10 COMP', '7891234567895', '50', '6,2', '0,11', '40', '30', '22', '8,90', 'SIM']]);

  const cols: Column<Produto>[] = [
    {
      key: 'nome', header: 'Produto', mobile: 'title', sortValue: (p) => p.nome, hideable: false,
      render: (p) => (
        <div className={p.ativo === false ? 'prod-inativo' : undefined}>
          <div className="strong" style={{ color: 'var(--text)' }}>{p.nome}</div>
          <div className="muted prod-sub">{[p.codigo && `Cód. ${p.codigo}`, p.ean && `EAN ${p.ean}`].filter(Boolean).join(' · ') || 'sem código'}</div>
        </div>
      ),
    },
    { key: 'un', header: 'Un./caixa', align: 'right', className: 'num', sortValue: (p) => toNumber(p.unidades_por_caixa), render: (p) => toNumber(p.unidades_por_caixa) || <span className="text-amber">—</span> },
    { key: 'peso', header: 'Peso caixa', align: 'right', className: 'num', sortValue: (p) => toNumber(p.peso_caixa_kg), render: (p) => (toNumber(p.peso_caixa_kg) > 0 ? kg(toNumber(p.peso_caixa_kg)) : <span className="text-amber">—</span>) },
    {
      key: 'medidas', header: 'Medidas (C×L×A)', mobile: 'subtitle',
      sortValue: (p) => infoCaixa(p).m3 ?? -1,
      render: (p) => {
        const d = medidasProduto(p); const i = infoCaixa(p);
        return d ? <div><div>{d.map((x) => x.toLocaleString('pt-BR', { maximumFractionDigits: 1 })).join(' × ')} cm</div><div className="muted prod-sub">{i.m3 !== null ? m3(i.m3) : ''}</div></div> : <span className="text-amber">sem medidas</span>;
      },
    },
    {
      key: 'cubado', header: 'Peso cubado', title: `Peso cubado de uma caixa (fator ${fator.toLocaleString('pt-BR')} kg/m³, o mesmo escolhido no simulador)`, align: 'right', className: 'num',
      sortValue: (p) => infoCaixa(p, fator).cubado ?? -1,
      render: (p) => { const i = infoCaixa(p, fator); return i.cubado === null ? '—' : <span className={i.cobraCubado ? 'text-amber' : undefined} title={i.cobraCubado ? 'Esta caixa é cobrada pelo peso cubado (ocupa mais espaço do que pesa)' : undefined}>{kg(i.cubado)}</span>; },
    },
    { key: 'preco', header: 'Preço unit.', align: 'right', className: 'num', sortValue: (p) => toNumber(p.preco_unitario), render: (p) => (toNumber(p.preco_unitario) > 0 ? formatMoney(toNumber(p.preco_unitario)) : <span className="muted">—</span>) },
    {
      key: 'sit', header: 'Situação', mobile: 'badge',
      render: (p) => {
        if (p.ativo === false) return <Badge tone="slate" square>Inativo</Badge>;
        const f = pendencias(p);
        if (!f.length) return <Badge tone="green" square>Completo</Badge>;
        return <span title={`Falta: ${f.join(', ')}`}><Badge tone={completoParaFrete(p) ? 'blue' : 'amber'} square>{completoParaFrete(p) ? 'Sem preço' : `Falta ${f.length === 1 ? f[0] : `${f.length} dados`}`}</Badge></span>;
      },
    },
  ];

  const set = (p: Partial<FormProduto>) => setForm((f) => ({ ...f, ...p }));
  const fatorLabel = `fator ${fator.toLocaleString('pt-BR')} kg/m³`;
  const un = Math.max(1, Math.round(parseDecimalBR(form.unidades) ?? 1));
  const preco = parseDecimalBR(form.preco) ?? 0;

  return (
    <div className="page">
      <PageHeader icon={<Package size={22} />} title="Produtos"
        subtitle="Caixa master de cada produto: unidades, peso, medidas e preço — é daqui que o Simulador de frete calcula volumes, cubagem e valor da mercadoria"
        actions={<>
          <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => e.target.files?.[0] && importarCsv(e.target.files[0])} />
          <button className="btn" onClick={modelo} title="Baixar planilha modelo"><FileSpreadsheet size={16} /> Modelo</button>
          <button className="btn" onClick={() => fileRef.current?.click()} disabled={importando}><Upload size={16} /> {importando ? 'Importando…' : 'Importar planilha'}</button>
          <button className="btn" onClick={exportar} disabled={!produtos.length}><Download size={16} /> Exportar</button>
          <button className="btn btn-primary" onClick={() => abrir()}><Plus size={16} /> Novo produto</button>
        </>} />

      {completo === false && (
        <div className="prod-banner"><TriangleAlert size={16} />
          <span>Para guardar EAN, medidas separadas, peso da unidade, preço e ativo/inativo, rode o arquivo <b>supabase/produtos.sql</b> no SQL Editor do Supabase. Até lá, são salvos só unidades por caixa, peso e medidas.</span>
        </div>
      )}

      <div className="kpi-grid">
        <KpiCard label="Produtos ativos" value={stats.ativos.toLocaleString('pt-BR')} icon={<Package size={18} />} tone="brand" active={filtro === 'todos'} onClick={() => setFiltro('todos')} hint={stats.inativos ? `${stats.inativos} inativo(s)` : undefined} />
        <KpiCard label="Prontos para o simulador" value={stats.completos.toLocaleString('pt-BR')} icon={<CheckCircle2 size={18} />} tone="green" hint="un./caixa, peso e medidas" />
        <KpiCard label="Faltando dados" value={stats.incompletos.toLocaleString('pt-BR')} icon={<Ruler size={18} />} tone="amber" active={filtro === 'incompletos'} onClick={() => setFiltro('incompletos')} hint="a cotação sai imprecisa" />
        <KpiCard label="Sem preço" value={stats.semPreco.toLocaleString('pt-BR')} icon={<Boxes size={18} />} tone="blue" active={filtro === 'sem_preco'} onClick={() => setFiltro('sem_preco')} hint="valor da mercadoria manual" />
      </div>

      <div className="toolbar">
        <SearchInput className="toolbar__search" value={busca} onChange={setBusca} placeholder="Buscar código, nome ou EAN…" />
        <div className="chips">
          {([['todos', 'Todos'], ['incompletos', 'Faltando dados'], ['sem_preco', 'Sem preço'], ['inativos', 'Inativos']] as [Filtro, string][]).map(([k, l]) => (
            <button key={k} className={`chip ${filtro === k ? 'chip--on' : ''}`} onClick={() => setFiltro(k)}>{l}</button>
          ))}
        </div>
        <span className="toolbar__spacer" />
        <Link className="btn btn-sm btn-ghost" to="/calculadora"><Ruler size={14} /> Abrir simulador</Link>
      </div>

      <div className="card table-card">
        <DataTable rows={linhas} columns={cols} rowKey={(p) => String(p.id)} loading={loading} onRowClick={(p) => abrir(p)}
          actions={(p) => (
            <>
              <button className="icon-btn icon-btn--sm" onClick={() => abrir(p, true)} title="Duplicar (criar um parecido)"><Copy size={16} /></button>
              <button className="icon-btn icon-btn--sm" onClick={() => abrir(p)} title="Editar"><Pencil size={16} /></button>
              <button className="icon-btn icon-btn--sm icon-btn--danger" onClick={() => excluir(p)} title="Excluir"><Trash2 size={16} /></button>
            </>
          )} />
      </div>

      {aberto && (
        <Modal size="lg" title={editando ? 'Editar produto' : 'Novo produto'} subtitle="Dados da caixa master (a embalagem que vai para a transportadora)"
          onClose={() => setAberto(false)} onSubmit={salvar}
          footer={<ModalActions onCancel={() => setAberto(false)} submitting={salvando} submitLabel={editando ? 'Atualizar produto' : 'Salvar produto'} />}>
          <div className="prod-form">
            <div className="form-grid" style={{ '--cols': 3 } as React.CSSProperties}>
              <div className="form-section-title">Identificação</div>
              <Field label="Código interno"><input className="input" value={form.codigo} onChange={(e) => set({ codigo: e.target.value })} placeholder="Ex.: P001" /></Field>
              <Field label="EAN / GTIN da caixa" hint={completo === false ? 'Disponível após rodar produtos.sql' : undefined}><input className="input num" inputMode="numeric" value={form.ean} disabled={completo === false} onChange={(e) => set({ ean: e.target.value })} placeholder="7891234567895" /></Field>
              <Field label="Situação"><Check checked={form.ativo} onChange={(v) => set({ ativo: v })}>{form.ativo ? 'Ativo no simulador' : 'Inativo'}</Check></Field>
              <Field label="Nome do produto" required className="span-all"><input className="input" required value={form.nome} onChange={(e) => set({ nome: e.target.value })} placeholder="Ex.: DIPIRONA 500MG CX 10 COMP" /></Field>

              <div className="form-section-title">Caixa master</div>
              <Field label="Unidades por caixa" required hint="Quantas unidades vão em cada caixa fechada"><input className="input num" inputMode="numeric" required value={form.unidades} onChange={(e) => set({ unidades: e.target.value })} placeholder="50" /></Field>
              <Field label="Peso da caixa cheia (kg)" required hint="Peso bruto: produto + embalagem"><input className="input num" inputMode="decimal" required value={form.pesoCaixa} onChange={(e) => set({ pesoCaixa: e.target.value })} placeholder="6,2" /></Field>
              <Field label="Peso de uma unidade (kg)" hint="Opcional: deixa a última caixa incompleta mais precisa"><input className="input num" inputMode="decimal" value={form.pesoUnit} disabled={completo === false} onChange={(e) => set({ pesoUnit: e.target.value })} placeholder="0,11" /></Field>
              <Field label="Comprimento (cm)" required><input className="input num" inputMode="decimal" value={form.comp} onChange={(e) => set({ comp: e.target.value })} placeholder="40" /></Field>
              <Field label="Largura (cm)" required><input className="input num" inputMode="decimal" value={form.larg} onChange={(e) => set({ larg: e.target.value })} placeholder="30" /></Field>
              <Field label="Altura (cm)" required><input className="input num" inputMode="decimal" value={form.alt} onChange={(e) => set({ alt: e.target.value })} placeholder="22" /></Field>

              <div className="form-section-title">Valor</div>
              <Field label="Preço unitário (R$)" hint="Valor da unidade na NF — vira o valor da mercadoria no simulador"><input className="input num" inputMode="decimal" value={form.preco} disabled={completo === false} onChange={(e) => set({ preco: e.target.value })} placeholder="8,90" /></Field>
              <Field label="Observação" className="span-2"><input className="input" value={form.observacao} disabled={completo === false} onChange={(e) => set({ observacao: e.target.value })} placeholder="Ex.: produto frágil, empilhamento máximo 5" /></Field>
            </div>

            <aside className="prod-previa" aria-live="polite">
              <h4><Boxes size={15} /> Como o frete enxerga 1 caixa</h4>
              <dl>
                <div><dt>Volume</dt><dd>{previa.m3 !== null ? m3(previa.m3) : '—'}</dd></div>
                <div><dt>Peso real</dt><dd>{(parseDecimalBR(form.pesoCaixa) ?? 0) > 0 ? kg(parseDecimalBR(form.pesoCaixa) ?? 0) : '—'}</dd></div>
                <div><dt>Peso cubado</dt><dd>{previa.cubado !== null ? kg(previa.cubado) : '—'}</dd></div>
                {previa.tara !== null && <div><dt>Embalagem (tara)</dt><dd>{kg(Math.max(0, previa.tara))}</dd></div>}
                {preco > 0 && <div><dt>Valor da caixa</dt><dd>{formatMoney(preco * un)}</dd></div>}
              </dl>
              {previa.cubado !== null && (parseDecimalBR(form.pesoCaixa) ?? 0) > 0 && (
                <p className={`prod-previa__nota ${previa.cobraCubado ? 'is-cubado' : ''}`}>
                  {previa.cobraCubado
                    ? `Cobrado pelo peso cubado: a caixa ocupa mais espaço do que pesa (${fatorLabel}).`
                    : `Cobrado pelo peso real (maior que o cubado em ${fatorLabel}).`}
                </p>
              )}
              {[...erros, ...avisos].map((m) => <p key={m} className={`prod-previa__alerta ${erros.includes(m) ? 'is-erro' : ''}`}><TriangleAlert size={13} /> {m}</p>)}
            </aside>
          </div>
        </Modal>
      )}
    </div>
  );
}
