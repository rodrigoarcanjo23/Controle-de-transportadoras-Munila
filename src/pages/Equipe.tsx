interface EquipeProps {
  perfis: any[];
  abrirModalNovoPerfil: () => void;
}

export function Equipe({ perfis, abrirModalNovoPerfil }: EquipeProps) {
  return (
    <>
      <header className="header">
        <div>
          <h2>Gestão de Equipe</h2>
          <p>Controlo de acessos e perfis operacionais</p>
        </div>
        <button className="btn-primary" onClick={abrirModalNovoPerfil}>
          + Novo Funcionário
        </button>
      </header>
      
      <div className="table-container" style={{ maxWidth: '900px' }}>
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>E-mail (Login)</th>
              <th>Cargo</th>
              <th>Nível de Acesso</th>
            </tr>
          </thead>
          <tbody>
            {perfis.map((perfil) => (
              <tr key={perfil.id}>
                <td style={{ fontWeight: 'bold', color: 'var(--text-main)' }}>{perfil.nome}</td>
                <td>{perfil.email}</td>
                <td>{perfil.cargo || '-'}</td>
                <td>
                  <span 
                    className="status-badge" 
                    style={{ 
                      backgroundColor: perfil.nivel_acesso === 'Administrador' ? '#f3e8ff' : '#f1f5f9', 
                      color: perfil.nivel_acesso === 'Administrador' ? '#6b21a8' : '#334155' 
                    }}
                  >
                    {perfil.nivel_acesso}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}