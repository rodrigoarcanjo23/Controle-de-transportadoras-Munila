import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { Cliente } from '../../types';
import { matchesSearch } from '../../lib/format';

/**
 * Campo de busca de cliente por nome ou CNPJ, com navegação por teclado
 * (↑ ↓ Enter). Chama onSelect com o cliente escolhido (ou null ao digitar).
 */
export function ClienteCombobox({ clientes, value, onSelect, required, id }: {
  clientes: Cliente[]; value: string; onSelect: (c: Cliente | null) => void; required?: boolean; id?: string;
}) {
  const atual = clientes.find((c) => c.id === value);
  const [texto, setTexto] = useState(atual?.nome ?? '');
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(0);

  // sincroniza quando o valor muda por fora (ex.: XML preencheu o cliente)
  const [valorAnterior, setValorAnterior] = useState(value);
  if (value !== valorAnterior) {
    setValorAnterior(value);
    if (atual) setTexto(atual.nome);
  }

  const lista = useMemo(
    () => clientes.filter((c) => matchesSearch(texto, c.nome, c.cnpj_cpf, c.cnpj_cpf?.replace(/\D/g, ''), c.razao_social)).slice(0, 50),
    [clientes, texto],
  );

  const escolher = (c: Cliente) => {
    setTexto(c.nome);
    onSelect(c);
    setAberto(false);
  };

  return (
    <div style={{ position: 'relative' }}>
      <div className="input-icon">
        <Search size={16} />
        <input
          id={id}
          className={`input ${value ? 'input--highlight' : ''}`}
          placeholder="Digite o nome ou CNPJ…"
          value={texto}
          required={required && !value}
          autoComplete="off"
          onChange={(e) => { setTexto(e.target.value); setAberto(true); setAtivo(0); if (value) onSelect(null); }}
          onClick={() => setAberto(true)}
          onBlur={() => setTimeout(() => setAberto(false), 150)}
          onKeyDown={(e) => {
            if (!aberto) { if (e.key === 'ArrowDown') { e.preventDefault(); setAberto(true); } return; }
            if (e.key === 'ArrowDown') { e.preventDefault(); setAtivo((a) => Math.min(a + 1, lista.length - 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setAtivo((a) => Math.max(a - 1, 0)); }
            if (e.key === 'Enter' && lista[ativo]) { e.preventDefault(); escolher(lista[ativo]); }
            if (e.key === 'Escape') { e.stopPropagation(); setAberto(false); }
          }}
        />
      </div>
      {aberto && (
        <ul className="combo__list" role="listbox">
          {lista.map((c, i) => (
            <li key={c.id} className={`combo__item ${i === ativo ? 'is-active' : ''}`} role="option" aria-selected={i === ativo}
              onMouseDown={(e) => { e.preventDefault(); escolher(c); }} onMouseEnter={() => setAtivo(i)}>
              <strong>{c.nome}</strong>
              {(c.cnpj_cpf || c.cidade) && <small>{[c.cnpj_cpf, c.cidade && `${c.cidade}${c.uf ? ' - ' + c.uf : ''}`].filter(Boolean).join(' · ')}</small>}
            </li>
          ))}
          {lista.length === 0 && <li className="combo__item muted">Nenhum cliente encontrado</li>}
        </ul>
      )}
    </div>
  );
}
