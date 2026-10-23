import { useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { EmptyState } from './basics';
import { ScrollNav, type ColumnGroup } from './ScrollNav';

export interface Column<T> {
  key: string;
  header: ReactNode;
  /** Nome usado no seletor de colunas e nos cards do celular. */
  label?: string;
  render: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number | null | undefined;
  align?: 'left' | 'right' | 'center';
  className?: string | ((row: T) => string | undefined);
  thClassName?: string;
  title?: string;
  /** Como a coluna aparece no card mobile. */
  mobile?: 'title' | 'subtitle' | 'badge' | 'hide' | 'full';
  /** false = não pode ser ocultada no seletor. */
  hideable?: boolean;
}

interface DataTableProps<T> {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  actions?: (row: T) => ReactNode;
  onRowClick?: (row: T) => void;
  hidden?: string[];
  loading?: boolean;
  empty?: ReactNode;
  fill?: boolean;
  compact?: boolean;
  pageSize?: number;
  minWidth?: number;
  stickyFirst?: boolean;
  /** Atalhos da barra de navegação horizontal (computador). */
  navGroups?: ColumnGroup[];
}

/**
 * Tabela responsiva: no computador vira uma tabela com cabeçalho fixo,
 * ordenação por coluna e ações fixas à direita; no celular vira uma lista de
 * cartões legíveis. Renderiza em blocos (100 linhas) para manter a tela leve.
 */
export function DataTable<T>({
  rows, columns, rowKey, actions, onRowClick, hidden = [], loading, empty, fill, compact,
  pageSize = 100, minWidth, stickyFirst, navGroups,
}: DataTableProps<T>) {
  const isMobile = useIsMobile();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [limit, setLimit] = useState(pageSize);

  const visible = columns.filter((c) => !hidden.includes(c.key));

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    const get = col.sortValue;
    return [...rows].sort((a, b) => {
      const va = get(a); const vb = get(b);
      if (va === vb) return 0;
      if (va === null || va === undefined || va === '') return 1;
      if (vb === null || vb === undefined || vb === '') return -1;
      return (typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'pt-BR', { numeric: true })) * sort.dir;
    });
  }, [rows, sort, columns]);

  const shown = sorted.slice(0, limit);
  const restantes = sorted.length - shown.length;

  const toggleSort = (c: Column<T>) => {
    if (!c.sortValue) return;
    setSort((s) => (s?.key !== c.key ? { key: c.key, dir: 1 } : s.dir === 1 ? { key: c.key, dir: -1 } : null));
  };

  const cls = (c: Column<T>, row: T) => [
    c.align === 'right' && 'align-right', c.align === 'center' && 'align-center',
    typeof c.className === 'function' ? c.className(row) : c.className,
  ].filter(Boolean).join(' ');

  const footer = (
    <div className="table-footer no-print">
      <span>{loading ? 'Carregando…' : `Exibindo ${shown.length.toLocaleString('pt-BR')} de ${sorted.length.toLocaleString('pt-BR')}`}</span>
      {restantes > 0 && (
        <span style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-sm" onClick={() => setLimit((l) => l + pageSize)}>Mostrar mais {Math.min(pageSize, restantes)}</button>
          <button className="btn btn-sm btn-ghost" onClick={() => setLimit(sorted.length)}>Mostrar todos</button>
        </span>
      )}
    </div>
  );

  if (loading && rows.length === 0) {
    return (
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 34 }} />)}
      </div>
    );
  }

  if (sorted.length === 0) return <>{empty ?? <EmptyState title="Nenhum registro encontrado" />}</>;

  if (isMobile) {
    const title = visible.filter((c) => c.mobile === 'title');
    const subtitle = visible.filter((c) => c.mobile === 'subtitle');
    const badge = visible.filter((c) => c.mobile === 'badge');
    const fields = visible.filter((c) => !c.mobile || c.mobile === 'full');
    return (
      <>
        <div className="card-list">
          {shown.map((row) => (
            <article key={rowKey(row)} className="m-card" onClick={onRowClick ? () => onRowClick(row) : undefined}>
              <div className="m-card__head">
                <div style={{ minWidth: 0 }}>
                  <div className="m-card__title">{title.map((c) => <span key={c.key}>{c.render(row)} </span>)}</div>
                  {subtitle.length > 0 && <div className="m-card__subtitle">{subtitle.map((c) => <span key={c.key}>{c.render(row)} </span>)}</div>}
                </div>
                {badge.map((c) => <div key={c.key} onClick={(e) => e.stopPropagation()}>{c.render(row)}</div>)}
              </div>
              {fields.length > 0 && (
                <div className="m-card__fields">
                  {fields.map((c) => (
                    <div key={c.key} className={`m-field ${c.mobile === 'full' ? 'm-field--full' : ''}`}>
                      <div className="m-field__label">{c.label ?? c.header}</div>
                      <div className="m-field__value">{c.render(row)}</div>
                    </div>
                  ))}
                </div>
              )}
              {actions && <div className="m-card__actions" onClick={(e) => e.stopPropagation()}>{actions(row)}</div>}
            </article>
          ))}
        </div>
        {footer}
      </>
    );
  }

  return (
    <>
      <ScrollNav scrollRef={scrollRef} groups={navGroups} deps={visible.length + (compact ? 1 : 0)} />
      <div ref={scrollRef} tabIndex={0} aria-label="Tabela — use ← e → para rolar"
        className={`table-scroll ${fill ? 'table-scroll--fill' : ''}`}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === 'ArrowRight') { e.preventDefault(); e.currentTarget.scrollBy({ left: 240, behavior: 'smooth' }); }
          if (e.key === 'ArrowLeft') { e.preventDefault(); e.currentTarget.scrollBy({ left: -240, behavior: 'smooth' }); }
        }}>
        <table className={`data-table ${compact ? 'is-compact' : ''}`} style={minWidth ? { minWidth } : undefined}>
          <thead>
            <tr>
              {visible.map((c, i) => (
                <th key={c.key} title={c.title} data-col={c.key}
                  className={[c.thClassName, c.sortValue && 'sortable', c.align === 'right' && 'align-right', c.align === 'center' && 'align-center', stickyFirst && i === 0 && 'col-sticky-left'].filter(Boolean).join(' ')}
                  onClick={() => toggleSort(c)}>
                  <span className="th-inner">
                    {c.header}
                    {c.sortValue && (sort?.key === c.key ? (sort.dir === 1 ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} style={{ opacity: 0.35 }} />)}
                  </span>
                </th>
              ))}
              {actions && <th className="align-center col-sticky-right col-actions">Ações</th>}
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => (
              <tr key={rowKey(row)} className={onRowClick ? 'is-clickable' : undefined} onDoubleClick={onRowClick ? () => onRowClick(row) : undefined}>
                {visible.map((c, i) => (
                  <td key={c.key} className={[cls(c, row), stickyFirst && i === 0 && 'col-sticky-left'].filter(Boolean).join(' ')}>{c.render(row)}</td>
                ))}
                {actions && <td className="col-sticky-right col-actions"><div className="row-actions">{actions(row)}</div></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {footer}
    </>
  );
}
