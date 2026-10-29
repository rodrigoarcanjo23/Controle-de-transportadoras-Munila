import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Building2, CornerDownLeft, FileText, History, LayoutDashboard, ReceiptText, RefreshCcw, Search, Truck, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { FILTROS_VAZIOS } from '../../lib/filtrosEntrega';
import { formatDate, formatMoney, normalize } from '../../lib/format';
import { useAppData } from '../../state/context';
import { ModalHistorico } from '../../modals/ModalHistorico';
import { NAV } from './nav';
import type { Cte, Entrega } from '../../types';

interface Resultado {
  id: string; grupo: string; icone: ReactNode; titulo: ReactNode; sub?: ReactNode; badge?: string;
  acao: () => void;
  /** ação secundária (ex.: abrir no Painel) */
  extra?: { label: string; fn: () => void };
}

const so = (s: string) => s.replace(/\D/g, '');
const nums = (s: string): string[] => s.match(/\d+/g) ?? [];
const LIMITE = 6;

/** Busca global (Ctrl+K): NFs, clientes, transportadoras, CTEs, faturas, devoluções e telas. */
export function BuscaGlobal({ onClose }: { onClose: () => void }) {
  const { entregas, clientes, transportadoras, devolucoes, isAdmin, setFiltros } = useAppData();
  const navigate = useNavigate();
  const [termo, setTermo] = useState('');
  const [sel, setSel] = useState(0);
  const [historico, setHistorico] = useState<Entrega | null>(null);
  const [remotos, setRemotos] = useState<{ ctes: Cte[]; faturas: { id: string; numero: string; transportadora_id: string; valor: number; vencimento: string; status: string }[] }>({ ctes: [], faturas: [] });
  const input = useRef<HTMLInputElement>(null);
  const lista = useRef<HTMLDivElement>(null);


  // CTEs e faturas são buscados no banco (não ficam carregados na memória)
  const t = termo.trim();
  useEffect(() => {
    if (t.length < 3) return;
    let vivo = true;
    const id = setTimeout(async () => {
      const limpo = t.replace(/[,()*%"\\]/g, ' ').trim();
      const dig = so(limpo);
      const [c, f] = await Promise.all([
        isAdmin ? supabase.from('ctes').select('*')
          .or([`numero_documento.ilike."*${limpo}*"`, `razao_social_emitente.ilike."*${limpo}*"`, ...(dig.length >= 3 ? [`chave_acesso.ilike."*${dig}*"`] : [])].join(','))
          .order('data_emissao', { ascending: false }).limit(LIMITE) : Promise.resolve({ data: [] }),
        supabase.from('faturas_frete').select('id, numero, transportadora_id, valor, vencimento, status').ilike('numero', `%${limpo}%`).limit(LIMITE),
      ]);
      if (vivo) setRemotos({ ctes: (c.data ?? []) as Cte[], faturas: (f.data ?? []) as typeof remotos.faturas });
    }, 250);
    return () => { vivo = false; clearTimeout(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, isAdmin]);

  const fechar = () => { onClose(); };
  const ir = (rota: string, state?: unknown) => { fechar(); navigate(rota, state ? { state } : undefined); };
  const abrirPainel = (ids: string[], rotulo: string) => { setFiltros({ ...FILTROS_VAZIOS, nfsIds: ids, nfsRotulo: rotulo }); ir('/dashboard'); };

  const resultados = useMemo<Resultado[]>(() => {
    const out: Resultado[] = [];
    const n = normalize(t); const dig = so(t);
    // telas
    const paginas = NAV.flatMap((g) => g.items.filter((i) => !i.admin || isAdmin).map((i) => ({ ...i, grupo: g.label })))
      .filter((i) => !t || normalize(i.label).includes(n) || normalize(i.grupo).includes(n));
    if (!t) {
      paginas.slice(0, 8).forEach((p) => out.push({ id: `p${p.to}`, grupo: 'Ir para', icone: <p.icon size={16} />, titulo: p.label, sub: p.grupo, acao: () => ir(p.to) }));
      return out;
    }
    // NFs (número exato primeiro, depois cliente/cidade)
    const nfs = entregas.filter((e) => (dig.length >= 2 && nums(e.nota_fiscal).some((x) => x.includes(dig))) || normalize(e.nota_fiscal).includes(n))
      .sort((a, b) => Number(nums(b.nota_fiscal).includes(dig)) - Number(nums(a.nota_fiscal).includes(dig)) || String(b.data_faturamento).localeCompare(String(a.data_faturamento)));
    nfs.slice(0, LIMITE).forEach((e) => out.push({
      id: `e${e.id}`, grupo: 'Notas fiscais', icone: <History size={16} />,
      titulo: <>NF {e.nota_fiscal} <span className="bg-cli">{e.clientes?.nome ?? ''}</span></>,
      sub: `${e.status} · ${e.transportadoras?.nome ?? 'sem transportadora'} · faturada ${formatDate(e.data_faturamento)}`,
      acao: () => { setHistorico(e); },
      extra: { label: 'Painel', fn: () => abrirPainel([String(e.id)], `NF ${e.nota_fiscal}`) },
    }));
    // clientes
    clientes.filter((c) => n.length >= 2 && (normalize(c.nome).includes(n) || normalize(c.razao_social).includes(n) || normalize(c.nome_fantasia).includes(n) || (dig.length >= 4 && so(c.cnpj_cpf ?? '').includes(dig))))
      .slice(0, LIMITE).forEach((c) => {
        const ids = entregas.filter((e) => String(e.cliente_id) === String(c.id)).map((e) => String(e.id));
        out.push({ id: `c${c.id}`, grupo: 'Clientes', icone: <Building2 size={16} />, titulo: c.nome, sub: `${[c.cidade, c.uf].filter(Boolean).join('/')} · ${ids.length} NF(s)`,
          acao: () => abrirPainel(ids, `Cliente: ${c.nome}`), extra: isAdmin ? { label: 'Cadastro', fn: () => ir('/clientes', { busca: c.nome }) } : undefined });
      });
    // transportadoras
    transportadoras.filter((x) => n.length >= 2 && (normalize(x.nome).includes(n) || normalize(x.razao_social).includes(n) || (dig.length >= 4 && so(x.cnpj_cpf ?? '').includes(dig))))
      .slice(0, LIMITE).forEach((x) => out.push({ id: `t${x.id}`, grupo: 'Transportadoras', icone: <Truck size={16} />, titulo: x.nome,
        sub: `${entregas.filter((e) => e.transportadora_id === x.id).length} NF(s) no Painel`,
        acao: () => { setFiltros({ ...FILTROS_VAZIOS, transportadora: x.id }); ir('/dashboard'); },
        extra: { label: 'Avaliação', fn: () => ir('/avaliacao') } }));
    // CTEs
    const rem = t.length >= 3 ? remotos : { ctes: [], faturas: [] };
    rem.ctes.forEach((c) => out.push({ id: `cte${c.id}`, grupo: 'CTEs', icone: <FileText size={16} />, titulo: `CTE ${c.numero_documento}`,
      sub: `${c.razao_social_emitente ?? ''} · ${formatDate(c.data_emissao)} · ${formatMoney(c.valor_total_servico)} · ${c.situacao}`,
      acao: () => ir('/ctes', { numero: c.numero_documento }) }));
    // faturas
    rem.faturas.forEach((f) => out.push({ id: `f${f.id}`, grupo: 'Faturas de frete', icone: <ReceiptText size={16} />,
      titulo: `Fatura ${f.numero}`, sub: `${transportadoras.find((x) => String(x.id) === String(f.transportadora_id))?.nome ?? ''} · ${formatMoney(f.valor)} · vence ${formatDate(f.vencimento)}`,
      acao: () => ir('/faturas', { abrir: f.id }) }));
    // devoluções
    if (isAdmin) devolucoes.filter((d) => (dig.length >= 3 && so(`${d.notas_fiscais} ${d.nf_venda ?? ''}`).includes(dig)) || (n.length >= 3 && normalize(d.clientes?.nome).includes(n)))
      .slice(0, 4).forEach((d) => out.push({ id: `d${d.id}`, grupo: 'Devoluções', icone: <RefreshCcw size={16} />, titulo: `Devolução NF ${d.notas_fiscais}`,
        sub: `${d.clientes?.nome ?? ''} · ${d.status} · ${formatDate(d.data_emissao)}`, acao: () => ir('/devolucoes') }));
    paginas.slice(0, 4).forEach((p) => out.push({ id: `p${p.to}`, grupo: 'Telas', icone: <p.icon size={16} />, titulo: p.label, sub: p.grupo, acao: () => ir(p.to) }));
    if (dig.length >= 3 && !nfs.length) out.push({ id: 'busca-painel', grupo: 'Telas', icone: <LayoutDashboard size={16} />, titulo: `Procurar "${t}" no Painel de Entregas`, acao: () => { setFiltros({ ...FILTROS_VAZIOS, busca: t }); ir('/dashboard'); } });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, entregas, clientes, transportadoras, devolucoes, remotos, isAdmin]);

  useEffect(() => { lista.current?.querySelector('.bg-item.is-sel')?.scrollIntoView({ block: 'nearest' }); }, [sel]);

  if (historico) return <ModalHistorico entrega={historico} onClose={() => { setHistorico(null); fechar(); }} />;

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(resultados.length - 1, s + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); const r = resultados[sel]; if (!r) return; if (e.altKey && r.extra) r.extra.fn(); else r.acao(); }
    else if (e.key === 'Escape') { e.preventDefault(); fechar(); }
  };

  let grupoAnt = '';
  return (
    <div className="bg-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) fechar(); }}>
      <div className="bg-box" role="dialog" aria-modal="true" aria-label="Busca global">
        <div className="bg-campo">
          <Search size={18} />
          <input ref={input} autoFocus value={termo} onChange={(e) => { setTermo(e.target.value); setSel(0); }} onKeyDown={onKey}
            placeholder="Buscar NF, cliente, transportadora, CTE, fatura ou tela…" aria-label="Buscar" />
          <button className="icon-btn icon-btn--sm" onClick={fechar} aria-label="Fechar"><X size={16} /></button>
        </div>
        <div className="bg-lista" ref={lista}>
          {t && !resultados.length && <div className="bg-vazio">Nada encontrado para "{t}".</div>}
          {resultados.map((r, i) => {
            const cab = r.grupo !== grupoAnt; grupoAnt = r.grupo;
            return (
              <div key={r.id}>
                {cab && <div className="bg-grupo">{r.grupo}</div>}
                <div className={`bg-item ${i === sel ? 'is-sel' : ''}`} onMouseMove={() => setSel(i)} onClick={r.acao} role="option" aria-selected={i === sel}>
                  <span className="bg-item__ic">{r.icone}</span>
                  <span className="bg-item__txt"><b>{r.titulo}</b>{r.sub && <small>{r.sub}</small>}</span>
                  {r.extra && <button className="btn btn-sm btn-ghost bg-item__extra" onClick={(e) => { e.stopPropagation(); r.extra!.fn(); }}>{r.extra.label} <ArrowRight size={13} /></button>}
                  {i === sel && <CornerDownLeft size={14} className="bg-item__enter" />}
                </div>
              </div>
            );
          })}
        </div>
        <div className="bg-rodape">
          <span><kbd>↑</kbd><kbd>↓</kbd> navegar</span><span><kbd>Enter</kbd> abrir</span><span><kbd>Alt</kbd>+<kbd>Enter</kbd> ação ao lado</span><span><kbd>Esc</kbd> fechar</span>
        </div>
      </div>
    </div>
  );
}
