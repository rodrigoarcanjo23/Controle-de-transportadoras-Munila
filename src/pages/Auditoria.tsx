import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ShieldAlert, Search } from 'lucide-react';

export function Auditoria() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [buscaTexto, setBuscaTexto] = useState('');
  const [filtroModulo, setFiltroModulo] = useState('');
  const [filtroAcao, setFiltroAcao] = useState('');

  useEffect(() => {
    buscarLogs();
  }, []);

  async function buscarLogs() {
    try {
      const { data, error } = await supabase
        .from('logs_auditoria')
        .select('*')
        .order('criado_em', { ascending: false })
        .limit(500);

      if (error) throw error;
      if (data) setLogs(data);
    } catch (error) {
      console.error('Erro ao buscar logs:', error);
    } finally {
      setLoading(false);
    }
  }

  const logsFiltrados = logs.filter(log => {
    let passa = true;
    const termo = buscaTexto.toLowerCase();
    
    if (buscaTexto && !log.usuario_email?.toLowerCase().includes(termo) && !log.detalhes?.toLowerCase().includes(termo)) passa = false;
    if (filtroModulo && log.modulo !== filtroModulo) passa = false;
    if (filtroAcao && log.acao !== filtroAcao) passa = false;

    return passa;
  });

  // ==========================================
  // NOVO FORMATADOR DE HORA - MATEMÁTICA BRUTA (INFALÍVEL)
  // ==========================================
  const formatarDataHora = (dataStr: string) => {
    if (!dataStr) return '-';
    
    // 1. Garante que o JavaScript não adivinhe o fuso e trate como UTC puro
    const dataSegura = dataStr.endsWith('Z') || dataStr.includes('+') ? dataStr : dataStr + 'Z';
    const data = new Date(dataSegura);
    
    // 2. Subtrai 3 horas forçosamente na matemática (UTC-3 Fortaleza/Brasília)
    data.setUTCHours(data.getUTCHours() - 3);
    
    // 3. Monta o texto lendo o resultado já subtraído (Impede bugs do navegador)
    const dia = String(data.getUTCDate()).padStart(2, '0');
    const mes = String(data.getUTCMonth() + 1).padStart(2, '0');
    const ano = data.getUTCFullYear();
    const hora = String(data.getUTCHours()).padStart(2, '0');
    const minuto = String(data.getUTCMinutes()).padStart(2, '0');
    
    return `${dia}/${mes}/${ano} às ${hora}:${minuto}`;
  };

  const getAcaoColor = (acao: string) => {
    switch (acao) {
      case 'CRIOU': return { backgroundColor: '#dcfce7', color: '#166534' };
      case 'EDITOU': return { backgroundColor: '#fef08a', color: '#713f12' };
      case 'APAGOU': return { backgroundColor: '#fee2e2', color: '#991b1b' };
      default: return { backgroundColor: '#f1f5f9', color: '#475569' };
    }
  };

  const thStyle: React.CSSProperties = { padding: '12px 16px', backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', textAlign: 'left', whiteSpace: 'nowrap' };
  const tdStyle: React.CSSProperties = { padding: '12px 16px', borderBottom: '1px solid #f1f5f9', fontSize: '0.85rem', color: '#334155' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%', gap: '24px' }}>
      
      {/* CABEÇALHO E FILTROS */}
      <div style={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <div style={{ padding: '8px', backgroundColor: '#fee2e2', borderRadius: '8px' }}><ShieldAlert size={24} color="#ef4444" /></div>
          <div>
            <h2 style={{ fontSize: '1.25rem', color: 'var(--text-main)' }}>Auditoria do Sistema</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Monitoramento de ações e alterações realizadas pelos usuários</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <div className="form-group" style={{ flex: '2 1 200px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Search size={14}/> Buscar (E-mail ou Detalhes)</label>
            <input type="text" className="form-input" placeholder="Pesquisar..." value={buscaTexto} onChange={e => setBuscaTexto(e.target.value)} />
          </div>
          
          <div className="form-group" style={{ flex: '1 1 180px' }}>
            <label>Módulo</label>
            <select className="form-select" value={filtroModulo} onChange={e => setFiltroModulo(e.target.value)}>
              <option value="">Todos os Módulos</option>
              <option value="ENTREGAS">Entregas</option>
              <option value="CLIENTES">Clientes</option>
              <option value="EQUIPE">Equipe</option>
              <option value="TRANSPORTADORAS">Transportadoras</option>
              <option value="DEVOLUCOES">Devoluções</option>
              <option value="CTES">Registro de CTE</option>
            </select>
          </div>

          <div className="form-group" style={{ flex: '1 1 150px' }}>
            <label>Ação</label>
            <select className="form-select" value={filtroAcao} onChange={e => setFiltroAcao(e.target.value)}>
              <option value="">Todas as Ações</option>
              <option value="CRIOU">CRIOU</option>
              <option value="EDITOU">EDITOU</option>
              <option value="APAGOU">APAGOU</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button type="button" className="btn-secondary" style={{ height: '38px' }} onClick={() => {setBuscaTexto(''); setFiltroModulo(''); setFiltroAcao('');}}>Limpar</button>
          </div>
        </div>
      </div>

      {/* TABELA DE REGISTROS */}
      <div className="table-container" style={{ width: '100%', overflowX: 'auto', backgroundColor: 'white', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '0' }}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead>
            <tr>
              <th style={{...thStyle, position: 'sticky', top: 0, zIndex: 10}}>Data e Hora</th>
              <th style={{...thStyle, position: 'sticky', top: 0, zIndex: 10}}>Usuário (E-mail)</th>
              <th style={{...thStyle, position: 'sticky', top: 0, zIndex: 10}}>Ação</th>
              <th style={{...thStyle, position: 'sticky', top: 0, zIndex: 10}}>Módulo</th>
              <th style={{...thStyle, position: 'sticky', top: 0, zIndex: 10, width: '100%'}}>Detalhes da Alteração</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={5} style={{ textAlign: 'center', padding: '24px' }}>Carregando registros...</td></tr> : 
             logsFiltrados.length === 0 ? <tr><td colSpan={5} style={{ textAlign: 'center', padding: '24px' }}>Nenhum registro encontrado.</td></tr> :
             logsFiltrados.map(log => (
               <tr key={log.id} className="trow-hover">
                 <td style={{...tdStyle, whiteSpace: 'nowrap'}}>{formatarDataHora(log.criado_em)}</td>
                 <td style={{...tdStyle, fontWeight: 'bold'}}>{log.usuario_email}</td>
                 <td style={tdStyle}>
                   <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', ...getAcaoColor(log.acao) }}>{log.acao}</span>
                 </td>
                 <td style={{...tdStyle, fontWeight: 'bold', color: 'var(--munila-blue)'}}>{log.modulo}</td>
                 <td style={{...tdStyle, whiteSpace: 'normal'}}>{log.detalhes}</td>
               </tr>
             ))
            }
          </tbody>
        </table>
      </div>
    </div>
  );
}