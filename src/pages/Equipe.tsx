import React from 'react';
import { Plus, Edit, Trash2 } from 'lucide-react';

interface EquipeProps {
  perfis: any[];
  abrirModalNovoPerfil: () => void;
  abrirModalEdicaoPerfil: (perfil: any) => void;
  handleDeletePerfil: (id: string) => void;
}

export function Equipe({ perfis, abrirModalNovoPerfil, abrirModalEdicaoPerfil, handleDeletePerfil }: EquipeProps) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', color: '#0f172a', margin: 0 }}>Gestão de Equipe</h2>
          <p style={{ color: '#64748b', fontSize: '0.85rem', margin: 0 }}>Controle de acessos e perfis operacionais</p>
        </div>
        <button className="btn-primary" onClick={abrirModalNovoPerfil} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Plus size={18} /> Novo Funcionário
        </button>
      </div>

      <div className="table-container" style={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569', fontSize: '0.75rem', textTransform: 'uppercase' }}>
              <th style={{ padding: '12px 16px', textAlign: 'left' }}>Nome</th>
              <th style={{ padding: '12px 16px', textAlign: 'left' }}>E-mail (Login)</th>
              <th style={{ padding: '12px 16px', textAlign: 'left' }}>Cargo</th>
              <th style={{ padding: '12px 16px', textAlign: 'center' }}>Nível de Acesso</th>
              <th style={{ padding: '12px 16px', textAlign: 'center' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {perfis.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>Nenhum perfil cadastrado.</td></tr>
            ) : (
              perfis.map(perfil => (
                <tr key={perfil.id} style={{ borderBottom: '1px solid #f1f5f9' }} className="trow-hover">
                  <td style={{ padding: '12px 16px', fontWeight: 'bold', color: '#334155' }}>{perfil.nome}</td>
                  <td style={{ padding: '12px 16px', color: '#475569' }}>{perfil.email}</td>
                  <td style={{ padding: '12px 16px', color: '#475569' }}>{perfil.cargo}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <span style={{
                      padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold',
                      backgroundColor: perfil.nivel_acesso === 'Administrador' ? '#f3e8ff' : '#e0f2fe',
                      color: perfil.nivel_acesso === 'Administrador' ? '#6b21a8' : '#0369a1'
                    }}>
                      {perfil.nivel_acesso}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                      <button onClick={() => abrirModalEdicaoPerfil(perfil)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }} title="Editar"><Edit size={18} /></button>
                      <button onClick={() => handleDeletePerfil(perfil.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px' }} title="Excluir"><Trash2 size={18} /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}