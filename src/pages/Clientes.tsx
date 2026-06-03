import { Edit, Trash2, Phone, Mail } from 'lucide-react';

interface ClientesProps {
  clientes: any[];
  metas: any[];
  abrirModalNovoCliente: () => void;
  abrirModalNovaMeta: () => void;
  abrirModalEdicaoCliente: (cliente: any) => void;
  handleDeleteCliente: (id: string) => void;
}

export function Clientes({
  clientes,
  metas,
  abrirModalNovoCliente,
  abrirModalNovaMeta,
  abrirModalEdicaoCliente,
  handleDeleteCliente
}: ClientesProps) {
  return (
    <>
      <header className="header">
        <div>
          <h2>Gestão de Clientes & Metas de Frete</h2>
          <p>Base de parceiros e margens logísticas autorizadas</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn-secondary" onClick={abrirModalNovoCliente}>+ Novo Cliente</button>
          <button className="btn-primary" onClick={abrirModalNovaMeta}>+ Nova Meta Logística</button>
        </div>
      </header>
      
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
            {clientes.map((cliente) => {
              // Filtra as metas que pertencem exclusivamente a este cliente
              const metasDoCliente = metas.filter(m => m.cliente_id === cliente.id);
              
              return (
                <tr key={cliente.id}>
                  <td style={{ fontWeight: 'bold', color: 'var(--text-main)' }}>{cliente.nome}</td>
                  
                  {/* COLUNA: CONTATO CLIENTE */}
                  <td>
                    {cliente.telefone && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                        <Phone size={14} /> {cliente.telefone}
                      </div>
                    )}
                    {cliente.email && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        <Mail size={14} /> {cliente.email}
                      </div>
                    )}
                    {(!cliente.telefone && !cliente.email) && <span style={{ color: '#cbd5e1' }}>-</span>}
                  </td>

                  <td>{cliente.cidade} - {cliente.uf}</td>
                  
                  {/* COLUNA: METAS ATIVAS */}
                  <td>
                    {metasDoCliente.length === 0 ? (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Nenhuma meta</span>
                    ) : (
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {metasDoCliente.map(meta => (
                          <span key={meta.id} className="status-badge" style={{ backgroundColor: 'var(--munila-light)', color: 'var(--munila-blue)', border: '1px solid var(--munila-blue)' }}>
                            {meta.transportadoras?.nome}: <strong>{meta.meta_percentual}%</strong>
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  
                  {/* COLUNA: AÇÕES */}
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
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}