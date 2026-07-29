import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { FileText, Save, Trash2, Edit, UploadCloud, Download, Printer, XCircle, Filter, PlusCircle, DollarSign, Calendar } from 'lucide-react';

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
  const [filtroDataInicio, setFiltroDataInicio] = useState('');
  const [filtroDataFim, setFiltroDataFim] = useState('');
  const [filtroNumeroDoc, setFiltroNumeroDoc] = useState('');
  const [filtroChaveAcesso, setFiltroChaveAcesso] = useState('');
  const [filtroEmitente, setFiltroEmitente] = useState('');
  const [filtroCfop, setFiltroCfop] = useState('');
  const [filtroSituacao, setFiltroSituacao] = useState('');

  // Estado do Formulário
  const [formData, setFormData] = useState({
    numero_documento: '', 
    chave_acesso: [''], 
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
    if (filtroDataInicio && cte.data_emissao < filtroDataInicio) passa = false;
    if (filtroDataFim && cte.data_emissao > filtroDataFim) passa = false;
    if (filtroNumeroDoc && !cte.numero_documento?.toLowerCase().includes(filtroNumeroDoc.toLowerCase())) passa = false;
    if (filtroChaveAcesso && !cte.chave_acesso?.toLowerCase().includes(filtroChaveAcesso.toLowerCase())) passa = false;
    if (filtroEmitente && !cte.razao_social_emitente?.toLowerCase().includes(filtroEmitente.toLowerCase())) passa = false;
    if (filtroCfop && !cte.cfop?.toLowerCase().includes(filtroCfop.toLowerCase())) passa = false;
    if (filtroSituacao && cte.situacao !== filtroSituacao) passa = false;
    return passa;
  });

  function limparFiltros() {
    setFiltroDataInicio('');
    setFiltroDataFim('');
    setFiltroNumeroDoc('');
    setFiltroChaveAcesso('');
    setFiltroEmitente('');
    setFiltroCfop(''); 
    setFiltroSituacao('');
  }

  // ==========================================
  // CÁLCULO DOS TOTAIS PARA O PAINEL DE RESUMO
  // ==========================================
  const valorTotalServico = ctesFiltrados.reduce((acc, curr) => acc + (Number(curr.valor_total_servico) || 0), 0);
  const totalCtesFiltrados = ctesFiltrados.length;

  // ==========================================
  // LÓGICA DE SALVAR E VALIDAÇÃO DE DUPLICIDADE
  // ==========================================
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    const chavesParaValidar = formData.chave_acesso.filter(chave => chave.trim() !== '');

    // 🛑 BARREIRA DE SEGURANÇA: Bloqueia Chaves Repetidas
    const cteDuplicado = ctes.find(cte => {
      // Se estamos a editar, ignoramos o próprio documento para não dar falso positivo
      if (editingId && cte.id === editingId) return false;
      
      if (!cte.chave_acesso) return false;
      
      // Transforma a string salva num Array para comparar as chaves uma a uma
      const chavesSalvas = cte.chave_acesso.split(',').map((c: string) => c.trim());
      
      // Verifica se ALGUMA das chaves do formulário atual já existe neste CTE salvo
      return chavesParaValidar.some(chaveNova => chavesSalvas.includes(chaveNova.trim()));
    });

    if (cteDuplicado) {
      alert(`⚠️ ATENÇÃO: DUPLICIDADE DETECTADA!\n\nUma ou mais Chaves de Acesso informadas já estão registradas no sistema.\n\n📌 Pertencem ao CTE Nº ${cteDuplicado.numero_documento} da transportadora ${cteDuplicado.razao_social_emitente || 'Desconhecida'}.\n\nO registro foi bloqueado para evitar erros financeiros.`);
      setSubmitting(false);
      return; // Interrompe o processo e não guarda no banco de dados!
    }
    // 🛑 FIM DA BARREIRA DE SEGURANÇA

    const chavesLimpas = chavesParaValidar.join(',');

    const payload = {
      numero_documento: formData.numero_documento,
      chave_acesso: chavesLimpas,
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
    const chavesArray = cte.chave_acesso ? cte.chave_acesso.split(',') : [''];

    setFormData({
      numero_documento: cte.numero_documento || '',
      chave_acesso: chavesArray.length > 0 ? chavesArray : [''],
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
    setFormData({ numero_documento: '', chave_acesso: [''], razao_social_emitente: '', cnpj_emitente: '', cfop: '', valor_total_servico: '', situacao: 'ABERTO', data_emissao: '', observacao: '' });
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

  const handleChaveChange = (index: number, valor: string) => {
    const novasChaves = [...formData.chave_acesso];
    novasChaves[index] = valor;
    setFormData({ ...formData, chave_acesso: novasChaves });
  };

  const adicionarChave = () => {
    setFormData({ ...formData, chave_acesso: [...formData.chave_acesso, ''] });
  };

  const removerChave = (index: number) => {
    const novasChaves = formData.chave_acesso.filter((_, i) => i !== index);
    setFormData({ ...formData, chave_acesso: novasChaves });
  };

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
        let cnpjRaw = emitenteNode ? emitenteNode.getElementsByTagName("CNPJ")[0]?.textContent || '' : '';
        const razaoSocial = emitenteNode ? emitenteNode.getElementsByTagName("xNome")[0]?.textContent || '' : '';

        let cnpjFormatado = cnpjRaw;
        if (cnpjRaw.length === 14) {
          cnpjFormatado = cnpjRaw.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
        }

        const nDoc = getTagValue("nCT") || getTagValue("nNF");
        const cfop = getTagValue("CFOP");
        const valor = getTagValue("vTPrest") || getTagValue("vNF") || getTagValue("vProd");
        const observacao = getTagValue("xObs") || getTagValue("infCpl");
        
        let dataEmissao = getTagValue("dhEmi");
        if(dataEmissao) dataEmissao = dataEmissao.split('T')[0];

        let chavesExtraidas: string[] = [];
        const nfeNodes = xmlDoc.getElementsByTagName("infNFe");
        
        for (let i = 0; i < nfeNodes.length; i++) {
          const chaveVinculada = nfeNodes[i].getElementsByTagName("chave")[0]?.textContent;
          if (chaveVinculada) chavesExtraidas.push(chaveVinculada);
        }

        if (chavesExtraidas.length === 0) {
          const chNFe = getTagValue("chNFe");
          const chCTe = getTagValue("chCTe");
          if (chNFe) chavesExtraidas.push(chNFe);
          else if (chCTe) chavesExtraidas.push(chCTe);
        }

        if (chavesExtraidas.length === 0) chavesExtraidas = [''];

        setFormData({
          ...formData,
          numero_documento: nDoc,
          chave_acesso: chavesExtraidas,
          razao_social_emitente: razaoSocial,
          cnpj_emitente: cnpjFormatado,
          cfop: cfop,
          valor_total_servico: valor,
          data_emissao: dataEmissao,
          observacao: observacao
        });
        
        alert(`✅ XML lido com sucesso! Encontrada(s) ${chavesExtraidas.length} chave(s) vinculada(s).`);
      } catch (err) {
        alert("Erro ao ler o ficheiro XML. Certifique-se que é um formato válido.");
      }
    };
    reader.readAsText(file);
    if(fileInputRef.current) fileInputRef.current.value = '';
  };

  const exportarParaExcel = () => {
    if (ctesFiltrados.length === 0) { alert("Não há dados para exportar com estes filtros."); return; }
    const cabecalho = ["Data", "Nº Doc", "Emitente", "CNPJ", "CFOP", "Valor Serv. (R$)", "Chaves Vinculadas", "Situação", "Observação"].join(";");
    const linhas = ctesFiltrados.map(c => {
      const chavesFormatadas = c.chave_acesso ? c.chave_acesso.replace(/,/g, ' | ') : '-';
      
      return [
        formatarData(c.data_emissao), c.numero_documento, c.razao_social_emitente || '-', c.cnpj_emitente || '-', c.cfop || '-',
        c.valor_total_servico?.toString().replace('.', ',') || '0,00', chavesFormatadas, c.situacao, c.observacao || '-'
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', minHeight: '100%', paddingBottom: '32px' }}>
      
      {/* 1. SEÇÃO SUPERIOR: FORMULÁRIO DE REGISTRO / EDIÇÃO */}
      <div style={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        
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
          
          <div style={{ display: 'flex', gap: '8px' }}>
            <input type="file" accept=".xml" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileUpload} />
            <button type="button" className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => fileInputRef.current?.click()}>
              <UploadCloud size={16} /> Importar XML
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <div className="form-group"><label>Nº Documento Fiscal</label><input type="text" className="form-input" required placeholder="Ex: 9029" value={formData.numero_documento} onChange={e => setFormData({...formData, numero_documento: e.target.value})} /></div>
          
          <div className="form-group" style={{ gridColumn: 'span 2' }}><label>Razão Social do Emitente</label><input type="text" className="form-input" list="transportadoras-sugestoes" required placeholder="Digite o nome da transportadora..." value={formData.razao_social_emitente} onChange={e => setFormData({...formData, razao_social_emitente: e.target.value})} />
            <datalist id="transportadoras-sugestoes">{transportadoras.map(t => <option key={t.id} value={t.nome} />)}</datalist>
          </div>
          <div className="form-group"><label>CNPJ</label><input type="text" className="form-input" placeholder="00.000.000/0000-00" value={formData.cnpj_emitente} onChange={e => setFormData({...formData, cnpj_emitente: e.target.value})} /></div>
          <div className="form-group"><label>CFOP</label><input type="text" className="form-input" placeholder="Ex: 5351" value={formData.cfop} onChange={e => setFormData({...formData, cfop: e.target.value})} /></div>
          <div className="form-group"><label>Valor Total do Serviço (R$)</label><input type="number" step="0.01" className="form-input" required placeholder="0.00" value={formData.valor_total_servico} onChange={e => setFormData({...formData, valor_total_servico: e.target.value})} /></div>
          <div className="form-group"><label>Data Emissão</label><input type="date" className="form-input" required value={formData.data_emissao} onChange={e => setFormData({...formData, data_emissao: e.target.value})} /></div>
          <div className="form-group"><label>Situação</label>
            <select className="form-select" value={formData.situacao} onChange={e => setFormData({...formData, situacao: e.target.value})}>
              <option value="ABERTO">ABERTO</option><option value="FECHADO">FECHADO</option><option value="OUTROS">OUTROS</option>
            </select>
          </div>

          <div className="form-group" style={{ gridColumn: '1 / -1', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: 'var(--munila-blue)' }}>
              <FileText size={18} /> Chaves de Acesso (NFs Vinculadas)
            </label>
            
            {formData.chave_acesso.map((chave, index) => (
              <div key={index} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000" 
                  value={chave} 
                  onChange={e => handleChaveChange(index, e.target.value)} 
                />
                {formData.chave_acesso.length > 1 && (
                  <button type="button" onClick={() => removerChave(index)} style={{ padding: '0 12px', backgroundColor: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
            
            <button type="button" onClick={adicionarChave} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: '#0284c7', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem', marginTop: '8px' }}>
              <PlusCircle size={16} /> Adicionar Nova Chave
            </button>
          </div>

          <div className="form-group" style={{ gridColumn: '1 / -1' }}><label>Observações do Transporte</label><input type="text" className="form-input" placeholder="Apólice, Seguro, Agendamentos..." value={formData.observacao} onChange={e => setFormData({...formData, observacao: e.target.value})} /></div>
          
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

      {/* 2. SEÇÃO DE FILTROS E RELATÓRIO DO HISTÓRICO */}
      <div style={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Filter size={18} color="var(--munila-blue)" />
            <h3 style={{ fontSize: '1rem', color: 'var(--text-main)', margin: 0 }}>Filtros de Pesquisa & Período</h3>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }} onClick={exportarParaPDF}>
              <Printer size={16} /> PDF
            </button>
            <button type="button" className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#16a34a', borderColor: '#16a34a' }} onClick={exportarParaExcel}>
              <Download size={16} /> Excel
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end', backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          
          <div className="form-group" style={{ flex: '1 1 140px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#0284c7', fontWeight: 'bold' }}>
              <Calendar size={14} /> Data Início
            </label>
            <input type="date" className="form-input" value={filtroDataInicio} onChange={e => setFiltroDataInicio(e.target.value)} />
          </div>

          <div className="form-group" style={{ flex: '1 1 140px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#0284c7', fontWeight: 'bold' }}>
              <Calendar size={14} /> Data Fim
            </label>
            <input type="date" className="form-input" value={filtroDataFim} onChange={e => setFiltroDataFim(e.target.value)} />
          </div>

          <div className="form-group" style={{ flex: '1 1 130px' }}>
            <label>Nº Documento</label>
            <input type="text" className="form-input" placeholder="Buscar..." value={filtroNumeroDoc} onChange={e => setFiltroNumeroDoc(e.target.value)} />
          </div>

          <div className="form-group" style={{ flex: '2 1 180px' }}>
            <label>Chave de Acesso</label>
            <input type="text" className="form-input" placeholder="Buscar por chave..." value={filtroChaveAcesso} onChange={e => setFiltroChaveAcesso(e.target.value)} />
          </div>

          <div className="form-group" style={{ flex: '2 1 180px' }}>
            <label>Emitente</label>
            <input type="text" className="form-input" placeholder="Buscar nome..." value={filtroEmitente} onChange={e => setFiltroEmitente(e.target.value)} />
          </div>

          <div className="form-group" style={{ flex: '1 1 100px' }}>
            <label>CFOP</label>
            <input type="text" className="form-input" placeholder="Ex: 5351" value={filtroCfop} onChange={e => setFiltroCfop(e.target.value)} />
          </div>

          <div className="form-group" style={{ flex: '1 1 110px' }}>
            <label>Situação</label>
            <select className="form-select" value={filtroSituacao} onChange={e => setFiltroSituacao(e.target.value)}>
              <option value="">Todas</option>
              <option value="ABERTO">ABERTO</option>
              <option value="FECHADO">FECHADO</option>
              <option value="OUTROS">OUTROS</option>
            </select>
          </div>

          <div>
            <button type="button" className="btn-secondary" style={{ height: '38px', color: '#ef4444', borderColor: '#ef4444' }} onClick={limparFiltros}>
              Limpar
            </button>
          </div>
        </div>
      </div>

      {/* 3. PAINEL DE RESUMO (CARDS TOTAIS DO PERÍODO SELECIONADO) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
        
        <div style={{ backgroundColor: 'white', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Valor Total do Serviço</p>
            <div style={{ padding: '6px', backgroundColor: '#dcfce7', borderRadius: '6px' }}><DollarSign size={18} color="#16a34a" /></div>
          </div>
          <h3 style={{ fontSize: '1.5rem', color: 'var(--text-main)', fontWeight: 700 }}>
            R$ {valorTotalServico.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Soma total do período selecionado</p>
        </div>

        <div style={{ backgroundColor: 'white', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Quantidade de CTEs</p>
            <div style={{ padding: '6px', backgroundColor: '#e0f2fe', borderRadius: '6px' }}><FileText size={18} color="#0284c7" /></div>
          </div>
          <h3 style={{ fontSize: '1.5rem', color: 'var(--text-main)', fontWeight: 700 }}>
            {totalCtesFiltrados} <span style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>documentos</span>
          </h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Registros encontrados no período</p>
        </div>

      </div>

      {/* 4. TABELA DE HISTÓRICO - Sem amarras! */}
      <div className="table-container" style={{ width: '100%', overflowX: 'auto', backgroundColor: 'white', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '0', position: 'relative' }}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead>
            <tr>
              <th style={{...thStyle, position: 'sticky', top: 0, zIndex: 10}}>Data</th>
              <th style={{...thStyle, position: 'sticky', top: 0, zIndex: 10}}>Nº Doc</th>
              <th style={{...thStyle, position: 'sticky', top: 0, zIndex: 10}}>Emitente</th>
              <th style={{...thStyle, position: 'sticky', top: 0, zIndex: 10}}>CNPJ</th>
              <th style={{...thStyle, position: 'sticky', top: 0, zIndex: 10}}>CFOP</th>
              <th style={{...thStyle, position: 'sticky', top: 0, zIndex: 10}}>Chaves Vinculadas</th>
              <th style={{...thStyle, position: 'sticky', top: 0, zIndex: 10}}>Valor Serv. (R$)</th>
              <th style={{...thStyle, position: 'sticky', top: 0, zIndex: 10}}>Situação</th>
              <th style={{...thStyle, textAlign: 'center', position: 'sticky', top: 0, right: 0, zIndex: 11, borderLeft: '1px solid #e2e8f0'}}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={9} style={{ textAlign: 'center', padding: '24px' }}>A carregar histórico...</td></tr> : 
             ctesFiltrados.length === 0 ? <tr><td colSpan={9} style={{ textAlign: 'center', padding: '24px' }}>Nenhum CTE encontrado com estes filtros.</td></tr> :
             ctesFiltrados.map(cte => (
               <tr key={cte.id} className="trow-hover">
                 <td style={tdStyle}>{formatarData(cte.data_emissao)}</td>
                 <td style={{...tdStyle, fontWeight: 'bold', color: 'var(--munila-blue)'}}>{cte.numero_documento}</td>
                 <td style={{...tdStyle, fontWeight: 'bold'}}>{cte.razao_social_emitente || '-'}</td>
                 <td style={tdStyle}>{cte.cnpj_emitente || '-'}</td>
                 <td style={{...tdStyle, fontWeight: 'bold'}}>{cte.cfop || '-'}</td>
                 
                 <td style={{...tdStyle, whiteSpace: 'normal', minWidth: '250px'}}>
                   {cte.chave_acesso ? cte.chave_acesso.split(',').map((chave: string, idx: number) => (
                     <div key={idx} style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--munila-blue)', marginBottom: '4px' }}>
                       {chave}
                     </div>
                   )) : '-'}
                 </td>

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