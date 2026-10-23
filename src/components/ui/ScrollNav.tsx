import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

export interface ColumnGroup { label: string; keys: string[] }

const SEM_GRUPOS: ColumnGroup[] = [];

/**
 * Barra de navegação horizontal para tabelas largas: botões ◀ ▶, controle
 * deslizante (funciona como uma barra de rolagem no topo) e atalhos que
 * pulam direto para um grupo de colunas. Some quando a tabela cabe na tela.
 */
export function ScrollNav({ scrollRef, groups = SEM_GRUPOS, deps }: {
  scrollRef: RefObject<HTMLDivElement | null>; groups?: ColumnGroup[]; deps?: unknown;
}) {
  const [pos, setPos] = useState({ left: 0, max: 0, width: 0 });
  const [ativo, setAtivo] = useState<string>('');
  const [disponiveis, setDisponiveis] = useState<string>('');

  // Os grupos ficam numa ref: assim a medição é estável e NÃO dispara um novo
  // ciclo de renderização a cada render (era isso que travava a troca de página).
  const groupsRef = useRef(groups);
  useEffect(() => { groupsRef.current = groups; });

  /** largura da coluna fixa à esquerda (não conta como área visível) */
  const stickyWidth = useCallback(() => {
    const th = scrollRef.current?.querySelector<HTMLElement>('th.col-sticky-left');
    return th?.offsetWidth ?? 0;
  }, [scrollRef]);

  const thDoGrupo = useCallback((g: ColumnGroup) => {
    const el = scrollRef.current;
    if (!el) return null;
    for (const k of g.keys) {
      const th = el.querySelector<HTMLElement>(`th[data-col="${k}"]`);
      if (th) return th;
    }
    return null;
  }, [scrollRef]);

  const medir = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const gs = groupsRef.current;
    const left = Math.round(el.scrollLeft);
    const max = Math.max(0, el.scrollWidth - el.clientWidth);
    const width = el.clientWidth;
    // só atualiza o estado quando algo realmente mudou
    setPos((p) => (p.left === left && p.max === max && p.width === width ? p : { left, max, width }));
    // grupo ativo = último grupo cujo início já passou da borda esquerda visível
    const borda = el.scrollLeft + stickyWidth() + 24;
    let atual = '';
    for (const g of gs) {
      const th = thDoGrupo(g);
      if (th && th.offsetLeft <= borda) atual = g.label;
    }
    if (el.scrollLeft >= max - 4 && gs.length) {
      const ultimo = [...gs].reverse().find((g) => thDoGrupo(g));
      if (ultimo) atual = ultimo.label;
    }
    setAtivo(atual || gs[0]?.label || '');
    setDisponiveis(gs.filter((g) => thDoGrupo(g)).map((g) => g.label).join('|'));
  }, [scrollRef, stickyWidth, thDoGrupo]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let frame = 0;
    const agendar = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(medir); };
    agendar();
    el.addEventListener('scroll', agendar, { passive: true });
    const ro = new ResizeObserver(agendar);
    ro.observe(el);
    const table = el.querySelector('table');
    if (table) ro.observe(table);
    return () => { cancelAnimationFrame(frame); el.removeEventListener('scroll', agendar); ro.disconnect(); };
  }, [scrollRef, medir, deps]);

  const ir = (left: number) => scrollRef.current?.scrollTo({ left, behavior: 'smooth' });
  const passo = () => Math.max(200, (pos.width - stickyWidth()) * 0.7);
  const irParaGrupo = (g: ColumnGroup) => {
    const th = thDoGrupo(g);
    if (th) ir(th.offsetLeft - stickyWidth());
  };

  if (pos.max <= 2) return null;

  const pct = pos.max ? Math.round((pos.left / pos.max) * 100) : 0;

  return (
    <div className="scroll-nav no-print">
      <div className="scroll-nav__buttons">
        <button className="icon-btn icon-btn--sm" onClick={() => ir(0)} disabled={pos.left <= 0} title="Início da tabela"><ChevronsLeft size={16} /></button>
        <button className="icon-btn icon-btn--sm" onClick={() => ir(pos.left - passo())} disabled={pos.left <= 0} title="Colunas anteriores (←)"><ChevronLeft size={18} /></button>
      </div>

      {groups.length > 0 && (
        <div className="scroll-nav__groups" role="tablist" aria-label="Ir para grupo de colunas">
          {groups.filter((g) => disponiveis.split('|').includes(g.label)).map((g) => (
            <button key={g.label} role="tab" aria-selected={ativo === g.label}
              className={`scroll-nav__group ${ativo === g.label ? 'is-active' : ''}`} onClick={() => irParaGrupo(g)}>
              {g.label}
            </button>
          ))}
        </div>
      )}

      <input type="range" className="scroll-nav__range" min={0} max={pos.max} value={pos.left}
        onChange={(e) => { if (scrollRef.current) scrollRef.current.scrollLeft = Number(e.target.value); }}
        aria-label="Rolar tabela horizontalmente" style={{ ['--pct' as string]: `${pct}%` }} />

      <div className="scroll-nav__buttons">
        <button className="icon-btn icon-btn--sm" onClick={() => ir(pos.left + passo())} disabled={pos.left >= pos.max - 1} title="Próximas colunas (→)"><ChevronRight size={18} /></button>
        <button className="icon-btn icon-btn--sm" onClick={() => ir(pos.max)} disabled={pos.left >= pos.max - 1} title="Fim da tabela"><ChevronsRight size={16} /></button>
      </div>
      <span className="scroll-nav__hint hide-tablet">Shift + roda do mouse também rola</span>
    </div>
  );
}
