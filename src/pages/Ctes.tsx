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

  // NOVO Estado do Formulário com os campos solicitados
  const [formData, setFormData] = useState({
    numero_documento: '', 
    chave_acesso: '', 
    razao_social_emitente: '', 
    cnpj_emitente: '',
    cfop: '',
    valor_total_servico: '', 
    situacao: 'ABERTO', 
    data_emissao: '',
    observacao: ''
  });

  useEffect(() => {
    buscarCtes();
  }, []);

  async function buscarCtes() {
    try {
      const { data, error } = await supabase
        .from('ctes')
        .select('*')
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
      numero_documento: formData.numero_documento,
      chave_acesso: formData.chave_acesso,
      razao_social_emitente: formData.razao_social_emitente.toUpperCase(),
      cnpj_emitente: formData.cnpj_emitente,
      cfop: formData.cfop,
      valor_total_servico: parseFloat(formData.valor_total_servico) || 0,
      situacao: formData.situacao,
      data_emissao: formData.data_emissao || null,
      observacao: formData.observacao
    };

    try {
      const { data, error } = await supabase.from('ctes').insert([payload]).select('*');
      if (error) throw error;
      
      if (data) {
        setCtes([data[0], ...ctes]);
        // Limpa o formulário
        setFormData({ numero_documento: '', chave_acesso: '', razao_social_emitente: '', cnpj_emitente: '', cfop: '', valor_total_servico: '', situacao: 'ABERTO', data_emissao: '', observacao: '' });
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
    if (!window.confirm("⚠️ Tem certeza que deseja excluir o registro deste CTE?")) return;
    try {
      await supabase.from('ctes').delete().eq('id', id);
      setCtes(ctes.filter(c => c.id !== id));
    } catch (error) {
      console.error(error);
    }
  }

  const thStyle: React.CSSProperties = { padding: '12px 16px', backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', textAlign: 'left', whiteSpace: 'nowrap' };
  const tdStyle: React.CSSProperties = { padding: '12px 16px', borderBottom: '1px solid #f1f5f9', fontSize: '0.85rem', color: '#334155', whiteSpace: 'nowrap' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%', gap: '24px' }}>
      
      <div style={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <div style={{ padding: '8px', backgroundColor: '#e0f2fe', borderRadius: '8px' }}><FileText size={24} color="#0284c7" /></div>
          <div><h2 style={{ fontSize: '1.25rem', color: 'var(--text-main)' }}>Registro de CTE</h2><p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Lançamento de Conhecimentos de Transporte Eletrônico</p></div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          
          <div className="form-group">
            <label>Nº Documento Fiscal</label>
            <input type="text" className="form-input" required placeholder="Ex: 15488" value={formData.numero_documento} onChange={e => setFormData({...formData, numero_documento: e.target.value})} />
          </div>
          
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label>Nº Chave de Acesso</label>
            <input type="text" className="form-input" placeholder="0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000" value={formData.chave_acesso} onChange={e => setFormData({...formData, chave_acesso: e.target.value})} />
          </div>
          
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label>Razão Social do Emitente</label>
            <input type="text" className="form-input" list="transportadoras-sugestoes" required placeholder="Digite o nome da transportadora..." value={formData.razao_social_emitente} onChange={e => setFormData({...formData, razao_social_emitente: e.target.value})} />
            <datalist id="transportadoras-sugestoes">
              {transportadoras.map(t => <option key={t.id} value={t.nome} />)}
            </datalist>
          </div>

          <div className="form-group">
            <label>CNPJ</label>
            <input type="text" className="form-input" placeholder="00.000.000/0000-00" value={formData.cnpj_emitente} onChange={e => setFormData({...formData, cnpj_emitente: e.target.value})} />
          </div>

          <div className="form-group">
            <label>CFOP</label>
            <input type="text" className="form-input" placeholder="Ex: 5351" value={formData.cfop} onChange={e => setFormData({...formData, cfop: e.target.value})} />
          </div>

          <div className="form-group">
            <label>Valor Total do Serviço (R$)</label>
            <input type="number" step="0.01" className="form-input" required placeholder="0.00" value={formData.valor_total_servico} onChange={e => setFormData({...formData, valor_total_servico: e.target.value})} />
          </div>

          <div className="form-group">
            <label>Data</label>
            <input type="date" className="form-input" required value={formData.data_emissao} onChange={e => setFormData({...formData, data_emissao: e.target.value})} />
          </div>

          <div className="form-group">
            <label>Situação</label>
            <select className="form-select" value={formData.situacao} onChange={e => setFormData({...formData, situacao: e.target.value})}>
              <option value="ABERTO">ABERTO</option>
              <option value="FECHADO">FECHADO</option>
              <option value="OUTROS">OUTROS</option>
            </select>
          </div>

          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label>Observação</label>
            <input type="text" className="form-input" placeholder="Detalhes adicionais..." value={formData.observacao} onChange={e => setFormData({...formData, observacao: e.target.value})} />
          </div>
          
          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
            <button type="submit" className="btn-primary" disabled={submitting} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Save size={18} /> {submitting ? 'A Salvar...' : 'Registrar CTE'}
            </button>
          </div>
        </form>
      </div>

      <div className="table-container" style={{ flex: 1, minHeight: 0, overflow: 'auto', backgroundColor: 'white', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '0', position: 'relative' }}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead>
            <tr>
              <th style={{...thStyle, position: 'sticky', top: 0, zIndex: 10}}>Data</th>
              <th style={{...thStyle, position: 'sticky', top: 0, zIndex: 10}}>Nº Doc</th>
              <th style={{...thStyle, position: 'sticky', top: 0, zIndex: 10}}>Emitente</th>
              <th style={{...thStyle, position: 'sticky', top: 0, zIndex: 10}}>CNPJ</th>
              <th style={{...thStyle, position: 'sticky', top: 0, zIndex: 10}}>CFOP</th>
              <th style={{...thStyle, position: 'sticky', top: 0, zIndex: 10}}>Valor Serv. (R$)</th>
              <th style={{...thStyle, position: 'sticky', top: 0, zIndex: 10}}>Situação</th>
              <th style={{...thStyle, textAlign: 'center', position: 'sticky', top: 0, right: 0, zIndex: 11, borderLeft: '1px solid #e2e8f0'}}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={8} style={{ textAlign: 'center', padding: '24px' }}>A carregar histórico...</td></tr> : 
             ctes.length === 0 ? <tr><td colSpan={8} style={{ textAlign: 'center', padding: '24px' }}>Nenhum CTE registrado ainda.</td></tr> :
             ctes.map(cte => (
               <tr key={cte.id} className="trow-hover">
                 <td style={tdStyle}>{formatarData(cte.data_emissao)}</td>
                 <td style={{...tdStyle, fontWeight: 'bold', color: 'var(--munila-blue)'}}>{cte.numero_documento}</td>
                 <td style={{...tdStyle, fontWeight: 'bold'}}>{cte.razao_social_emitente || '-'}</td>
                 <td style={tdStyle}>{cte.cnpj_emitente || '-'}</td>
                 <td style={{...tdStyle, fontWeight: 'bold'}}>{cte.cfop || '-'}</td>
                 <td style={{...tdStyle, fontWeight: 'bold'}}>R$ {Number(cte.valor_total_servico).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                 <td style={tdStyle}>
                   <span style={{ 
                     padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold',
                     backgroundColor: cte.situacao === 'FECHADO' ? '#dcfce7' : cte.situacao === 'ABERTO' ? '#ffedd5' : '#f1f5f9',
                     color: cte.situacao === 'FECHADO' ? '#166534' : cte.situacao === 'ABERTO' ? '#9a3412' : '#475569'
                   }}>{cte.situacao}</span>
                 </td>
                 <td style={{...tdStyle, textAlign: 'center', position: 'sticky', right: 0, backgroundColor: 'white', zIndex: 1, borderLeft: '1px solid #e2e8f0'}}>
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