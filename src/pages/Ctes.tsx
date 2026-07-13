import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { FileText, Save, Trash2, Edit, UploadCloud, Download, Printer, XCircle, Filter } from 'lucide-react';

interface CtesProps {
  transportadoras: any[];
  formatarData: (d: string) => string;
}

export function Ctes({ transportadoras, formatarData }: CtesProps) {
  const [ctes, setCtes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estados dos Filtros Dinâmicos
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [filtroNumeroDoc, setFiltroNumeroDoc] = useState('');
  const [filtroEmitente, setFiltroEmitente] = useState('');
  const [filtroCfop, setFiltroCfop] = useState('');
  const [filtroSituacao, setFiltroSituacao] = useState('');
  const [filtroDataInicio, setFiltroDataInicio] = useState('');
  const [filtroDataFim, setFiltroDataFim] = useState('');

  // Estado do Formulário
  const [formData, setFormData] = useState({
    numero_documento: '', chave_acesso: '', razao_social_emitente: '', cnpj_emitente: '',
    cfop: '', valor_total_servico: '', situacao: 'ABERTO', data_emissao: '', observacao: ''
  });

  useEffect(() => {
    buscarCtes();
  }, []);

  async function buscarCtes() {
    try {
      const { data, error } = await supabase.from('ctes').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      if (data) setCtes(data);
    } catch (error) {
      console.error("Erro ao buscar CTEs:", error);
    } finally {
      setLoading(false);
    }
  }

  // ==========================================
  // LÓGICA DE FILTRAGEM DINÂMICA
  // ==========================================
  const ctesFiltrados = ctes.filter(cte => {
    let passa = true;
    if (filtroNumeroDoc && !cte.numero_documento?.toLowerCase().includes(filtroNumeroDoc.toLowerCase())) passa = false;
    if (filtroEmitente && !cte.razao_social_emitente?.toLowerCase().includes(filtroEmitente.toLowerCase())) passa = false;
    if (filtroCfop && !cte.cfop?.toLowerCase().includes(filtroCfop.toLowerCase())) passa = false;
    if (filtroSituacao && cte.situacao !== filtroSituacao) passa = false;
    if (filtroDataInicio && cte.data_emissao < filtroDataInicio) passa = false;
    if (filtroDataFim && cte.data_emissao > filtroDataFim) passa = false;
    return passa;
  });

  function limparFiltros() {
    setFiltroNumeroDoc(''); setFiltroEmitente(''); setFiltroCfop(''); 
    setFiltroSituacao(''); setFiltroDataInicio(''); setFiltroDataFim('');
  }

  // ==========================================
  // LÓGICA DE SALVAR (CRIAR E ATUALIZAR)
  // ==========================================
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
      if (editingId) {
        const { data, error } = await supabase.from('ctes').update(payload).eq('id', editingId).select('*');
        if (error) throw error;
        if (data) {
          setCtes(ctes.map(c => c.id === editingId ? data[0] : c));
          alert("✅ CTE atualizado com sucesso!");
        }
      } else {
        const { data, error } = await supabase.from('ctes').insert([payload]).select('*');
        if (error) throw error;
        if (data) {
          setCtes([data[0], ...ctes]);
          alert("✅ CTE registrado com sucesso!");
        }
      }
      cancelarEdicao();
    } catch (error) {
      console.error(error);
      alert("Erro ao processar o CTE.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleEdit(cte: any) {
    setEditingId(cte.id);
    setFormData({
      numero_documento: cte.numero_documento || '',
      chave_acesso: cte.chave_acesso || '',
      razao_social_emitente: cte.razao_social_emitente || '',
      cnpj_emitente: cte.cnpj_emitente || '',
      cfop: cte.cfop || '',
      valor_total_servico: cte.valor_total_servico?.toString() || '',
      situacao: cte.situacao || 'ABERTO',
      data_emissao: cte.data_emissao || '',
      observacao: cte.observacao || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelarEdicao() {
    setEditingId(null);
    setFormData({ numero_documento: '', chave_acesso: '', razao_social_emitente: '', cnpj_emitente: '', cfop: '', valor_total_servico: '', situacao: 'ABERTO', data_emissao: '', observacao: '' });
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

  // ==========================================
  // LÓGICA DO LEITOR AUTOMÁTICO DE XML
  // ==========================================
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const xmlString = event.target?.result as string;
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, "text/xml");

        const getTagValue = (tag: string) => {
          const el = xmlDoc.getElementsByTagName(tag)[0];
          return el ? el.textContent || '' : '';
        };

        const emitenteNode = xmlDoc.getElementsByTagName("emit")[0];
        const cnpj = emitenteNode ? emitenteNode.getElementsByTagName("CNPJ")[0]?.textContent || '' : '';
        const razaoSocial = emitenteNode ? emitenteNode.getElementsByTagName("xNome")[0]?.textContent || '' : '';

        const nDoc = getTagValue("nNF") || getTagValue("nCT");
        const chAcesso = getTagValue("chNFe") || getTagValue("chCTe");
        const cfop = getTagValue("CFOP");
        const valor = getTagValue("vNF") || getTagValue("vTPrest") || getTagValue("vProd");
        
        let dataEmissao = getTagValue("dhEmi");
        if(dataEmissao) dataEmissao = dataEmissao.split('T')[0];

        setFormData({
          ...formData,
          numero_documento: nDoc,
          chave_acesso: chAcesso,
          razao_social_emitente: razaoSocial,
          cnpj_emitente: cnpj,
          cfop: cfop,
          valor_total_servico: valor,
          data_emissao: dataEmissao
        });
        
        alert("✅ XML lido e formulário preenchido com sucesso!");
      } catch (err) {
        alert("Erro ao ler o ficheiro XML. Certifique-se que é um formato válido.");
      }
    };
    reader.readAsText(file);
    if(fileInputRef.current) fileInputRef.current.value = '';
  };

  // ==========================================
  // LÓGICA DE EXPORTAÇÃO EXCEL E IMPRESSÃO PDF
  // ==========================================
  const exportarParaExcel = () => {
    if (ctesFiltrados.length === 0) { alert("Não há dados para exportar com estes filtros."); return; }
    const cabecalho = ["Data", "Nº Doc", "Emitente", "CNPJ", "CFOP", "Valor Serv. (R$)", "Situação", "Observação"].join(";");
    const linhas = ctesFiltrados.map(c => {
      return [
        formatarData(c.data_emissao), c.numero_documento, c.razao_social_emitente || '-', c.cnpj_emitente || '-', c.cfop || '-',
        c.valor_total_servico?.toString().replace('.', ',') || '0,00', c.situacao, c.observacao || '-'
      ].join(";");
    });
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + cabecalho + "\n" + linhas.join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `MunilaLog_CTEs_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const exportarParaPDF = () => {
    window.print();
  };

  const thStyle: React.CSSProperties = { padding: '12px 16px', backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', textAlign: 'left', whiteSpace: 'nowrap' };
  const tdStyle: React.CSSProperties = { padding: '12px 16px', borderBottom: '1px solid #f1f5f9', fontSize: '0.85rem', color: '#334155', whiteSpace: 'nowrap' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%', gap: '24px' }}>
      
      {/* SEÇÃO SUPERIOR: FORMULÁRIO */}
      <div style={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', flexShrink: 0 }}>
        
        {/* CABEÇALHO DA PÁGINA E BOTÕES DE AÇÃO */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ padding: '8px', backgroundColor: '#e0f2fe', borderRadius: '8px' }}><FileText size={24} color="#0284c7" /></div>
            <div>
              <h2 style={{ fontSize: '1.25rem', color: 'var(--text-main)' }}>
                {editingId ? 'Editando CTE Selecionado' : 'Registro de CTE'}
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Lançamento de Conhecimentos de Transporte Eletrônico</p>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button type="button" className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: mostrarFiltros ? '#f1f5f9' : 'white' }} onClick={() => setMostrarFiltros(!mostrarFiltros)}>
              <Filter size={16} /> Filtros
            </button>
            <input type="file" accept=".xml" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileUpload} />
            <button type="button" className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => fileInputRef.current?.click()}>
              <UploadCloud size={16} /> Importar XML
            </button>
            <button type="button" className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }} onClick={exportarParaPDF}>
              <Printer size={16} /> PDF
            </button>
            <button type="button" className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#16a34a', borderColor: '#16a34a' }} onClick={exportarParaExcel}>
              <Download size={16} /> Excel
            </button>
          </div>
        </div>

        {/* BARRA DE FILTROS DINÂMICOS (Toggle) */}
        {mostrarFiltros && (
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '24px', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div className="form-group" style={{ flex: 1, minWidth: '150px' }}><label>Nº Documento</label><input type="text" className="form-input" placeholder="Buscar..." value={filtroNumeroDoc} onChange={e => setFiltroNumeroDoc(e.target.value)} /></div>
            <div className="form-group" style={{ flex: 2, minWidth: '200px' }}><label>Emitente</label><input type="text" className="form-input" placeholder="Buscar nome..." value={filtroEmitente} onChange={e => setFiltroEmitente(e.target.value)} /></div>
            <div className="form-group" style={{ flex: 1, minWidth: '120px' }}><label>CFOP</label><input type="text" className="form-input" placeholder="Ex: 5351" value={filtroCfop} onChange={e => setFiltroCfop(e.target.value)} /></div>
            <div className="form-group" style={{ flex: 1, minWidth: '120px' }}><label>Situação</label>
              <select className="form-select" value={filtroSituacao} onChange={e => setFiltroSituacao(e.target.value)}>
                <option value="">Todas</option><option value="ABERTO">ABERTO</option><option value="FECHADO">FECHADO</option><option value="OUTROS">OUTROS</option>
              </select>
            </div>
            <div className="form-group" style={{ flex: 1, minWidth: '130px' }}><label>Data Início</label><input type="date" className="form-input" value={filtroDataInicio} onChange={e => setFiltroDataInicio(e.target.value)} /></div>
            <div className="form-group" style={{ flex: 1, minWidth: '130px' }}><label>Data Fim</label><input type="date" className="form-input" value={filtroDataFim} onChange={e => setFiltroDataFim(e.target.value)} /></div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}><button type="button" className="btn-secondary" onClick={limparFiltros}>Limpar</button></div>
          </div>
        )}

        {/* FORMULÁRIO DE CADASTRO/EDIÇÃO */}
        <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <div className="form-group"><label>Nº Documento Fiscal</label><input type="text" className="form-input" required placeholder="Ex: 15488" value={formData.numero_documento} onChange={e => setFormData({...formData, numero_documento: e.target.value})} /></div>
          <div className="form-group" style={{ gridColumn: 'span 2' }}><label>Nº Chave de Acesso</label><input type="text" className="form-input" placeholder="0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000" value={formData.chave_acesso} onChange={e => setFormData({...formData, chave_acesso: e.target.value})} /></div>
          <div className="form-group" style={{ gridColumn: 'span 2' }}><label>Razão Social do Emitente</label><input type="text" className="form-input" list="transportadoras-sugestoes" required placeholder="Digite o nome da transportadora..." value={formData.razao_social_emitente} onChange={e => setFormData({...formData, razao_social_emitente: e.target.value})} />
            <datalist id="transportadoras-sugestoes">{transportadoras.map(t => <option key={t.id} value={t.nome} />)}</datalist>
          </div>
          <div className="form-group"><label>CNPJ</label><input type="text" className="form-input" placeholder="00.000.000/0000-00" value={formData.cnpj_emitente} onChange={e => setFormData({...formData, cnpj_emitente: e.target.value})} /></div>
          <div className="form-group"><label>CFOP</label><input type="text" className="form-input" placeholder="Ex: 5351" value={formData.cfop} onChange={e => setFormData({...formData, cfop: e.target.value})} /></div>
          <div className="form-group"><label>Valor Total do Serviço (R$)</label><input type="number" step="0.01" className="form-input" required placeholder="0.00" value={formData.valor_total_servico} onChange={e => setFormData({...formData, valor_total_servico: e.target.value})} /></div>
          <div className="form-group"><label>Data</label><input type="date" className="form-input" required value={formData.data_emissao} onChange={e => setFormData({...formData, data_emissao: e.target.value})} /></div>
          <div className="form-group"><label>Situação</label>
            <select className="form-select" value={formData.situacao} onChange={e => setFormData({...formData, situacao: e.target.value})}>
              <option value="ABERTO">ABERTO</option><option value="FECHADO">FECHADO</option><option value="OUTROS">OUTROS</option>
            </select>
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}><label>Observação</label><input type="text" className="form-input" placeholder="Detalhes adicionais..." value={formData.observacao} onChange={e => setFormData({...formData, observacao: e.target.value})} /></div>
          
          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', marginTop: '8px', gap: '12px' }}>
            {editingId && (
              <button type="button" className="btn-secondary" onClick={cancelarEdicao} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <XCircle size={18} /> Cancelar Edição
              </button>
            )}
            <button type="submit" className="btn-primary" disabled={submitting} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Save size={18} /> {submitting ? 'A Salvar...' : editingId ? 'Atualizar CTE' : 'Registrar CTE'}
            </button>
          </div>
        </form>
      </div>

      {/* SEÇÃO INFERIOR: HISTÓRICO DE DADOS (USANDO ctesFiltrados) */}
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
             ctesFiltrados.length === 0 ? <tr><td colSpan={8} style={{ textAlign: 'center', padding: '24px' }}>Nenhum CTE encontrado com estes filtros.</td></tr> :
             ctesFiltrados.map(cte => (
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
                   <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                     <button onClick={() => handleEdit(cte)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }} title="Editar"><Edit size={18} /></button>
                     <button onClick={() => handleDelete(cte.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }} title="Excluir"><Trash2 size={18} /></button>
                   </div>
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