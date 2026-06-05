import { useState } from 'react';
import { Edit, Trash2, Search } from 'lucide-react';

interface ClientesProps {
  clientes: any[];
  metas: any[];
  abrirModalNovoCliente: () => void;
  abrirModalNovaMeta: () => void;
  abrirModalEdicaoCliente: (cliente: any) => void;
  handleDeleteCliente: (id: string) => void;
}

export function Clientes({ clientes, metas, abrirModalNovoCliente, abrirModalNovaMeta, abrirModalEdicaoCliente, handleDeleteCliente }: ClientesProps) {
  // Novo estado para controlar o que o usuário digita na busca
  const [busca, setBusca] = useState('');

  // Filtro inteligente
  const clientesFiltrados = clientes.filter(c => 
    c.nome.toLowerCase().includes(busca.toLowerCase()) || 
    (c.razao_social && c.razao_social.toLowerCase().includes(busca.toLowerCase())) ||
    (c.cnpj_cpf && c.cnpj_cpf.includes(busca))
  );

  return (
    <>
      <header className="header">
        <div>
          <h2>Gestão de Clientes & Metas de Frete</h2>
          <p>Base de parceiros e margens logísticas autorizadas</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn-secondary" onClick={abrirModalNovoCliente} style={{ backgroundColor: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1' }}>+ Novo Cliente</button>
          <button className="btn-primary" onClick={abrirModalNovaMeta}>+ Nova Meta Logística</button>
        </div>
      </header>

      {/* BARRA DE PESQUISA */}
      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', backgroundColor: 'white', padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
        <Search size={20} color="#94a3b8" style={{ marginRight: '12px' }} />
        <input 
          type="text" 
          placeholder="Buscar cliente por nome, razão social ou CNPJ..." 
          style={{ border: 'none', outline: 'none', width: '100%', fontSize: '0.95rem', color: 'var(--text-main)' }}
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Nome do Cliente</th>
              <th>Contato</th>
              <th>Cidade / UF</th>
              <th>Regras de Frete Ativas (Metas %)</th>
              <th style={{ textAlign: 'center' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {clientesFiltrados.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>Nenhum cliente encontrado na busca.</td></tr>
            ) : (
              clientesFiltrados.map((cliente) => {
                const metasDoCliente = metas.filter(m => m.cliente_id === cliente.id);
                
                return (
                  <tr key={cliente.id}>
                    <td>
                      <strong style={{ color: 'var(--text-main)', display: 'block' }}>{cliente.nome}</strong>
                      {cliente.cnpj_cpf && <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{cliente.cnpj_cpf}</span>}
                    </td>
                    <td>
                      {cliente.telefone && <span style={{ display: 'block', fontSize: '0.85rem' }}>{cliente.telefone}</span>}
                      {cliente.email && <span style={{ display: 'block', fontSize: '0.85rem', color: '#64748b' }}>{cliente.email}</span>}
                      {!cliente.telefone && !cliente.email && '-'}
                    </td>
                    <td style={{ fontWeight: 'bold' }}>{cliente.cidade} - {cliente.uf}</td>
                    <td>
                      {metasDoCliente.length > 0 ? (
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {metasDoCliente.map(m => (
                            <span key={m.id} className="status-badge" style={{ backgroundColor: '#e0f2fe', color: '#0369a1', fontSize: '0.75rem', border: '1px solid #bae6fd' }}>
                              {m.transportadoras?.nome}: <strong style={{ marginLeft: '4px' }}>{m.meta_percentual}%</strong>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Nenhuma meta</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center', display: 'flex', justifyContent: 'center', gap: '8px' }}>
                      <button onClick={() => abrirModalEdicaoCliente(cliente)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }} title="Editar Cliente">
                        <Edit size={18} />
                      </button>
                      <button onClick={() => handleDeleteCliente(cliente.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px' }} title="Excluir Cliente">
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}