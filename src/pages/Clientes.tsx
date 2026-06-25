import React, { useState, useRef } from 'react';
import { Edit, Trash2, Search, Upload } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ClientesProps {
  clientes: any[];
  metas: any[];
  abrirModalNovoCliente: () => void;
  abrirModalNovaMeta: () => void;
  abrirModalEdicaoCliente: (c: any) => void;
  handleDeleteCliente: (id: string) => void;
  onUpdate?: () => void; // Gatilho para atualizar a lista após o import
}

export function Clientes({ clientes, metas, abrirModalNovoCliente, abrirModalNovaMeta, abrirModalEdicaoCliente, handleDeleteCliente, onUpdate }: ClientesProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filtro de busca inteligente (Nome e CNPJ)
  const clientesFiltrados = clientes.filter(c => 
    (c.nome?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || 
    (c.cnpj_cpf?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  // Lógica de Importação CSV
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportLoading(true);
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const linhas = text.split('\n');
        const payloads = [];

        // Ignora a linha 0 (cabeçalho) e percorre o resto
        for (let i = 1; i < linhas.length; i++) {
          const linha = linhas[i].trim();
          if (!linha) continue;

          // Separa as vírgulas corretamente, ignorando vírgulas dentro de aspas duplas
          const colunas = linha.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.replace(/^"|"$/g, '').trim());
          
          const nomeCSV = colunas[0];
          const cnpjCSV = colunas[1] || '';
          const razaoCSV = colunas[2] || '';
          const fantasiaCSV = colunas[3] || '';
          const cidadeCSV = colunas[4] || '';
          const ufCSV = colunas[5] || '';
          const telefoneCSV = colunas[6] || '';
          const emailCSV = colunas[7] || '';

          if (!nomeCSV) continue; // Pula a linha se o Nome estiver em branco

          payloads.push({
            nome: nomeCSV.toUpperCase(),
            cnpj_cpf: cnpjCSV,
            razao_social: razaoCSV.toUpperCase(),
            nome_fantasia: fantasiaCSV.toUpperCase(),
            cidade: cidadeCSV ? cidadeCSV.toUpperCase() : null,
            uf: ufCSV ? ufCSV.toUpperCase() : null,
            telefone: telefoneCSV || null,
            email: emailCSV ? emailCSV.toLowerCase() : null
          });
        }

        if (payloads.length > 0) {
          const { error } = await supabase.from('clientes').insert(payloads);
          if (error) throw error;
          
          alert(`✅ Sucesso!\n\n${payloads.length} clientes foram importados.`);
          if (onUpdate) onUpdate(); // Atualiza a tela automaticamente
        } else {
          alert("Nenhum cliente válido encontrado na planilha.");
        }
      } catch (error) {
        console.error(error);
        alert("Erro ao importar CSV de clientes. Verifique a formatação do arquivo.");
      } finally {
        setImportLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  const thStyle: React.CSSProperties = { padding: '16px', borderBottom: '2px solid var(--border-color)', backgroundColor: '#f8fafc', position: 'sticky', top: 0, color: '#475569', fontSize: '0.75rem', textTransform: 'uppercase' };
  const tdStyle: React.CSSProperties = { padding: '16px', borderBottom: '1px solid #f1f5f9' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%' }}>
      <header className="header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
          <div><h2>Gestão de Clientes e Metas</h2><p>Controle da carteira e teto de frete autorizado</p></div>
          
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="btn-secondary" onClick={abrirModalNovaMeta}>+ Nova Meta de Frete</button>
            
            {/* BOTÃO MÁGICO DO CSV AQUI */}
            <input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileUpload} style={{ display: 'none' }} />
            <button 
              className="btn-secondary" 
              onClick={() => fileInputRef.current?.click()} 
              disabled={importLoading} 
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Upload size={18} /> {importLoading ? 'A importar...' : 'Importar CSV'}
            </button>

            <button className="btn-primary" onClick={abrirModalNovoCliente}>+ Novo Cliente</button>
          </div>
        </div>

        <div style={{ width: '100%', maxWidth: '400px', position: 'relative' }}>
          <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '11px' }} />
          <input type="text" className="form-input" placeholder="Buscar por Nome, CNPJ..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ paddingLeft: '36px', width: '100%' }} />
        </div>
      </header>

      <div className="table-container" style={{ flex: 1, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, textAlign: 'left' }}>
          <thead>
            <tr>
              <th style={thStyle}>Nome / Razão Social</th>
              <th style={thStyle}>CNPJ / CPF</th>
              <th style={thStyle}>Localização</th>
              <th style={thStyle}>Contato</th>
              <th style={thStyle}>Metas Ativas</th>
              <th style={{ ...thStyle, textAlign: 'center' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {clientesFiltrados.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '32px' }}>Nenhum cliente encontrado.</td></tr>
            ) : (
              clientesFiltrados.map((cliente) => {
                const metasDoCliente = metas.filter(m => m.cliente_id === cliente.id);
                return (
                  <tr key={cliente.id} className="trow-hover">
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 'bold', color: 'var(--text-main)' }}>{cliente.nome}</div>
                      {cliente.razao_social && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{cliente.razao_social}</div>}
                    </td>
                    <td style={{ ...tdStyle, fontWeight: '500' }}>{cliente.cnpj_cpf || '-'}</td>
                    <td style={tdStyle}>{cliente.cidade ? `${cliente.cidade} - ${cliente.uf}` : '-'}</td>
                    <td style={tdStyle}>
                      {cliente.telefone && <div style={{ fontSize: '0.8rem' }}>📞 {cliente.telefone}</div>}
                      {cliente.email && <div style={{ fontSize: '0.8rem' }}>📧 {cliente.email}</div>}
                      {!cliente.telefone && !cliente.email && '-'}
                    </td>
                    <td style={tdStyle}>
                      {metasDoCliente.length === 0 ? <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Nenhuma meta</span> : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {metasDoCliente.map(m => (
                            <span key={m.id} style={{ backgroundColor: '#e0f2fe', color: '#0369a1', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', display: 'inline-block', width: 'fit-content' }}>
                              {m.transportadoras?.nome}: {m.meta_percentual}%
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <button onClick={() => abrirModalEdicaoCliente(cliente)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }} title="Editar Cliente"><Edit size={18} /></button>
                        <button onClick={() => handleDeleteCliente(cliente.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }} title="Excluir Cliente"><Trash2 size={18} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}