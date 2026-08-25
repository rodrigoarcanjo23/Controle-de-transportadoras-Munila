import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ShieldAlert, Search, RefreshCw } from 'lucide-react';

export function Auditoria() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMais, setLoadingMais] = useState(false);
  const [pagina, setPagina] = useState(1);
  const LIMIT_POR_PAGINA = 15; // Baixa apenas 15 itens para poupar Egress!
  const [temMaisDados, setTemMaisDados] = useState(true);

  // Filtros
  const [buscaTexto, setBuscaTexto] = useState('');
  const [filtroModulo, setFiltroModulo] = useState('');
  const [filtroAcao, setFiltroAcao] = useState('');

  useEffect(() => {
    // Quando qualquer filtro mudar, reseta a página para 1 e busca tudo de novo
    setPagina(1);
    setTemMaisDados(true);
    buscarLogs(1, true);
  }, [filtroAcao, filtroModulo]);

  // Função central de busca
  async function buscarLogs(pageAtual: number, resetarLista = false) {
    if (resetarLista) setLoading(true);
    else setLoadingMais(true);

    try {
      let query = supabase.from('logs_auditoria').select('*');

      // Aplica os filtros primeiro
      if (filtroAcao) query = query.eq('acao', filtroAcao);
      if (filtroModulo) query = query.eq('modulo', filtroModulo);

      // Calculando a faixa de dados (Paginação Inteligente do Supabase)
      const from = (pageAtual - 1) * LIMIT_POR_PAGINA;
      const to = (pageAtual * LIMIT_POR_PAGINA) - 1;

      const { data, error } = await query
        .order('criado_em', { ascending: false })
        .range(from, to);

      if (error) throw error;

      if (data) {
        if (resetarLista) {
          setLogs(data);
        } else {
          setLogs(prev => [...prev, ...data]); // Junta os dados antigos com os novos
        }

        // Se veio menos de 15, significa que acabou a lista lá no banco
        if (data.length < LIMIT_POR_PAGINA) {
          setTemMaisDados(false);
        }
      }
    } catch (error) {
      console.error('Erro ao buscar logs:', error);
    } finally {
      setLoading(false);
      setLoadingMais(false);
    }
  }

  function carregarMais() {
    const novaPagina = pagina + 1;
    setPagina(novaPagina);
    buscarLogs(novaPagina, false);
  }

  const logsFiltrados = logs.filter(log => {
    let passa = true;
    const termo = buscaTexto.toLowerCase();
    
    if (buscaTexto && !log.usuario_email?.toLowerCase().includes(termo) && !log.detalhes?.toLowerCase().includes(termo)) passa = false;
    
    return passa;
  });

  // ==========================================
  // O FORMATADOR FINAL E BLINDADO (-3 HORAS)
  // ==========================================
  const formatarDataHora = (dataStr: string) => {
    if (!dataStr) return '-';
    
    // O JS vai ler a data crua do banco (ex: "2026-08-25T19:55:02")
    const data = new Date(dataStr);
    
    // Subtrai exatamente 3 horas do relógio local
    data.setHours(data.getHours() - 3);
    
    // Extrai os valores já corrigidos sem se importar com fusos
    const dia = String(data.getDate()).padStart(2, '0');
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const ano = data.getFullYear();
    const hora = String(data.getHours()).padStart(2, '0');
    const minuto = String(data.getMinutes()).padStart(2, '0');
    const segundo = String(data.getSeconds()).padStart(2, '0');
    
    return `${dia}/${mes}/${ano}, ${hora}:${minuto}:${segundo}`;
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
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Monitoramento de ações e alterações realizadas pelos usuários (Modo Económico)</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <div className="form-group" style={{ flex: '2 1 200px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Search size={14}/> Buscar (E-mail ou Detalhes)</label>
            <input type="text" className="form-input" placeholder="Pesquisar resultados já carregados..." value={buscaTexto} onChange={e => setBuscaTexto(e.target.value)} />
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
            <button type="button" className="btn-secondary" style={{ height: '38px', color: '#ef4444', borderColor: '#ef4444' }} onClick={() => {setBuscaTexto(''); setFiltroModulo(''); setFiltroAcao('');}}>Limpar</button>
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
        
        {/* BOTÃO DE PAGINAÇÃO */}
        {!loading && logs.length > 0 && temMaisDados && !buscaTexto && (
           <div style={{ display: 'flex', justifyContent: 'center', padding: '16px', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
               <button 
                  type="button" 
                  className="btn-secondary" 
                  onClick={carregarMais} 
                  disabled={loadingMais}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 24px', backgroundColor: 'white' }}
               >
                 <RefreshCw size={16} className={loadingMais ? "spin-animation" : ""} />
                 {loadingMais ? 'A carregar mais...' : 'Ver próximos registos antigos'}
               </button>
           </div>
        )}

      </div>
    </div>
  );
}