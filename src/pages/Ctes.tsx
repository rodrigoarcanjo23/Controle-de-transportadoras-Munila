import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { FileText, Save, Trash2 } from 'lucide-react';

interface CtesProps {
  transportadoras: any[];
  formatarData: (d: string) => string;
}

export function Ctes({ transportadoras, formatarData }: CtesProps) {
  const [ctes, setCtes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Estado do Formulário
  const [formData, setFormData] = useState({
    numero_cte: '', chave_acesso: '', transportadora_id: '',
    data_emissao: '', valor_cte: '', notas_fiscais: '', status: 'Pendente', observacoes: ''
  });

  useEffect(() => {
    buscarCtes();
  }, []);

  async function buscarCtes() {
    try {
      const { data, error } = await supabase
        .from('ctes')
        .select('*, transportadoras(nome)')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      if (data) setCtes(data);
    } catch (error) {
      console.error("Erro ao buscar CTEs:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    const payload = {
      numero_cte: formData.numero_cte,
      chave_acesso: formData.chave_acesso,
      transportadora_id: formData.transportadora_id || null,
      data_emissao: formData.data_emissao || null,
      valor_cte: parseFloat(formData.valor_cte) || 0,
      notas_fiscais: formData.notas_fiscais,
      status: formData.status,
      observacoes: formData.observacoes
    };

    try {
      const { data, error } = await supabase.from('ctes').insert([payload]).select('*, transportadoras(nome)');
      if (error) throw error;
      
      if (data) {
        setCtes([data[0], ...ctes]);
        // Limpa o formulário após salvar com sucesso
        setFormData({ numero_cte: '', chave_acesso: '', transportadora_id: '', data_emissao: '', valor_cte: '', notas_fiscais: '', status: 'Pendente', observacoes: '' });
        alert("✅ CTE registrado com sucesso!");
      }
    } catch (error) {
      console.error(error);
      alert("Erro ao registrar o CTE.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Tem certeza que deseja excluir este CTE?")) return;
    try {
      await supabase.from('ctes').delete().eq('id', id);
      setCtes(ctes.filter(c => c.id !== id));
    } catch (error) {
      console.error(error);
    }
  }

  const thStyle: React.CSSProperties = { padding: '12px 16px', backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', textAlign: 'left' };
  const tdStyle: React.CSSProperties = { padding: '12px 16px', borderBottom: '1px solid #f1f5f9', fontSize: '0.85rem', color: '#334155' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%', gap: '24px' }}>
      
      {/* SEÇÃO SUPERIOR: FORMULÁRIO DE REGISTRO */}
      <div style={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <div style={{ padding: '8px', backgroundColor: '#e0f2fe', borderRadius: '8px' }}><FileText size={24} color="#0284c7" /></div>
          <div><h2 style={{ fontSize: '1.25rem', color: 'var(--text-main)' }}>Registro de CTE</h2><p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Lançamento rápido de Conhecimentos de Transporte</p></div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <div className="form-group"><label>Número do CTE</label><input type="text" className="form-input" required placeholder="Ex: 15488" value={formData.numero_cte} onChange={e => setFormData({...formData, numero_cte: e.target.value})} /></div>
          <div className="form-group" style={{ gridColumn: 'span 2' }}><label>Chave de Acesso (44 dígitos)</label><input type="text" className="form-input" placeholder="0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000" value={formData.chave_acesso} onChange={e => setFormData({...formData, chave_acesso: e.target.value})} /></div>
          <div className="form-group"><label>Transportadora</label>
            <select className="form-select" required value={formData.transportadora_id} onChange={e => setFormData({...formData, transportadora_id: e.target.value})}>
              <option value="">Selecione...</option>
              {transportadoras.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </div>
          <div className="form-group"><label>Data de Emissão</label><input type="date" className="form-input" required value={formData.data_emissao} onChange={e => setFormData({...formData, data_emissao: e.target.value})} /></div>
          <div className="form-group"><label>Valor do CTE (R$)</label><input type="number" step="0.01" className="form-input" required placeholder="0.00" value={formData.valor_cte} onChange={e => setFormData({...formData, valor_cte: e.target.value})} /></div>
          <div className="form-group" style={{ gridColumn: 'span 2' }}><label>NFs Vinculadas</label><input type="text" className="form-input" placeholder="Ex: 12500, 12501" value={formData.notas_fiscais} onChange={e => setFormData({...formData, notas_fiscais: e.target.value})} /></div>
          <div className="form-group"><label>Status</label>
            <select className="form-select" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
              <option value="Pendente">Pendente</option>
              <option value="Em Análise">Em Análise</option>
              <option value="Pago">Pago</option>
              <option value="Cancelado">Cancelado</option>
            </select>
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}><label>Observações</label><input type="text" className="form-input" placeholder="Detalhes adicionais..." value={formData.observacoes} onChange={e => setFormData({...formData, observacoes: e.target.value})} /></div>
          
          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
            <button type="submit" className="btn-primary" disabled={submitting} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Save size={18} /> {submitting ? 'A Salvar...' : 'Registrar CTE'}
            </button>
          </div>
        </form>
      </div>

      {/* SEÇÃO INFERIOR: HISTÓRICO */}
      <div className="table-container" style={{ flex: 1, overflow: 'auto', backgroundColor: 'white', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '0' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>Dt Emissão</th><th style={thStyle}>Nº CTE</th><th style={thStyle}>Transportadora</th><th style={thStyle}>NFs Vinculadas</th><th style={thStyle}>Valor (R$)</th><th style={thStyle}>Status</th><th style={{...thStyle, textAlign: 'center'}}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={7} style={{ textAlign: 'center', padding: '24px' }}>A carregar histórico...</td></tr> : 
             ctes.length === 0 ? <tr><td colSpan={7} style={{ textAlign: 'center', padding: '24px' }}>Nenhum CTE registrado ainda.</td></tr> :
             ctes.map(cte => (
               <tr key={cte.id} className="trow-hover">
                 <td style={tdStyle}>{formatarData(cte.data_emissao)}</td>
                 <td style={{...tdStyle, fontWeight: 'bold', color: 'var(--munila-blue)'}}>{cte.numero_cte}</td>
                 <td style={{...tdStyle, fontWeight: 'bold'}}>{cte.transportadoras?.nome || '-'}</td>
                 <td style={tdStyle}>{cte.notas_fiscais || '-'}</td>
                 <td style={{...tdStyle, fontWeight: 'bold'}}>R$ {Number(cte.valor_cte).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                 <td style={tdStyle}>
                   <span style={{ 
                     padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold',
                     backgroundColor: cte.status === 'Pago' ? '#dcfce7' : cte.status === 'Pendente' ? '#ffedd5' : '#f1f5f9',
                     color: cte.status === 'Pago' ? '#166534' : cte.status === 'Pendente' ? '#9a3412' : '#475569'
                   }}>{cte.status}</span>
                 </td>
                 <td style={{...tdStyle, textAlign: 'center'}}>
                   <button onClick={() => handleDelete(cte.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }} title="Excluir"><Trash2 size={18} /></button>
                 </td>
               </tr>
             ))
            }
          </tbody>
        </table>
      </div>
    </div>
  );
}