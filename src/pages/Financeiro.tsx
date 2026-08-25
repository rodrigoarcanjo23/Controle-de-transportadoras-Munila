import { useState } from 'react';
import { DollarSign, Search } from 'lucide-react';

export function Financeiro({ entregas }: { entregas: any[] }) {
  const [busca, setBusca] = useState('');

  const entregasFiltradas = entregas.filter(e => 
    (e.clientes?.nome || '').toLowerCase().includes(busca.toLowerCase()) ||
    (e.nota_fiscal || '').toLowerCase().includes(busca.toLowerCase())
  );

  const faturamentoTotal = entregasFiltradas.reduce((acc, curr) => acc + (Number(curr.valor_nf) || 0), 0);
  const freteRealTotal = entregasFiltradas.reduce((acc, curr) => acc + (Number(curr.valor_frete_real) || 0), 0);
  const freteCotadoTotal = entregasFiltradas.reduce((acc, curr) => acc + (Number(curr.valor_frete) || 0), 0);
  const impactoGeral = faturamentoTotal > 0 ? ((freteRealTotal / faturamentoTotal) * 100).toFixed(2) : '0.00';
  const desvioFrete = freteCotadoTotal - freteRealTotal; // Positivo = Economia, Negativo = Prejuízo na cotação

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', color: '#0f172a', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <DollarSign size={28} color="#10b981" /> Gestão Financeira
          </h2>
          <p style={{ color: '#64748b', margin: 0 }}>Análise de custos de frete, desvios de cotação e impacto</p>
        </div>
        <div style={{ position: 'relative' }}>
          <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '10px' }} />
          <input type="text" className="form-input" placeholder="Buscar Cliente ou NF..." value={busca} onChange={e => setBusca(e.target.value)} style={{ paddingLeft: '36px', width: '250px' }} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <p style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px' }}>Faturamento Auditado</p>
          <h3 style={{ fontSize: '1.75rem', color: '#0f172a', margin: 0, fontWeight: 800 }}>R$ {faturamentoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
        </div>
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <p style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px' }}>Custo Frete (Real)</p>
          <h3 style={{ fontSize: '1.75rem', color: '#ea580c', margin: 0, fontWeight: 800 }}>R$ {freteRealTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
        </div>
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <p style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px' }}>Impacto Frete / Receita</p>
          <h3 style={{ fontSize: '1.75rem', color: '#0284c7', margin: 0, fontWeight: 800 }}>{impactoGeral}%</h3>
        </div>
        <div style={{ padding: '20px', borderRadius: '12px', border: `1px solid ${desvioFrete >= 0 ? '#bbf7d0' : '#fecaca'}`, backgroundColor: desvioFrete >= 0 ? '#f0fdf4' : '#fef2f2' }}>
          <p style={{ color: desvioFrete >= 0 ? '#166534' : '#991b1b', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px' }}>Desvio (Cotado vs Real)</p>
          <h3 style={{ fontSize: '1.75rem', color: desvioFrete >= 0 ? '#15803d' : '#b91c1c', margin: 0, fontWeight: 800 }}>
            {desvioFrete >= 0 ? '+' : '-'} R$ {Math.abs(desvioFrete).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </h3>
        </div>
      </div>

      <div className="table-container" style={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569', fontSize: '0.75rem', textTransform: 'uppercase' }}>
              <th style={{ padding: '12px 16px', textAlign: 'left' }}>Cliente</th>
              <th style={{ padding: '12px 16px', textAlign: 'left' }}>Nº NF</th>
              <th style={{ padding: '12px 16px', textAlign: 'right' }}>Valor NF (R$)</th>
              <th style={{ padding: '12px 16px', textAlign: 'right' }}>Frete Cotado</th>
              <th style={{ padding: '12px 16px', textAlign: 'right' }}>Frete Real</th>
              <th style={{ padding: '12px 16px', textAlign: 'center' }}>Impacto %</th>
              <th style={{ padding: '12px 16px', textAlign: 'center' }}>Lucro/Preju Frete</th>
            </tr>
          </thead>
          <tbody>
            {entregasFiltradas.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>Nenhum dado financeiro.</td></tr>
            ) : (
              entregasFiltradas.map(e => {
                const valNf = Number(e.valor_nf) || 0;
                const fCotado = Number(e.valor_frete) || 0;
                const fReal = Number(e.valor_frete_real) || 0;
                const impacto = valNf > 0 ? ((fReal > 0 ? fReal : fCotado) / valNf * 100).toFixed(2) : '0.00';
                const desvio = fCotado - fReal;
                const temReal = e.valor_frete_real !== null && e.valor_frete_real !== undefined && e.valor_frete_real !== '';

                return (
                  <tr key={e.id} style={{ borderBottom: '1px solid #f1f5f9' }} className="trow-hover">
                    <td style={{ padding: '12px 16px', fontWeight: 'bold', color: '#334155' }}>{e.clientes?.nome}</td>
                    <td style={{ padding: '12px 16px', color: '#475569' }}>{e.nota_fiscal}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 'bold' }}>{valNf.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', color: '#64748b' }}>{fCotado.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', color: '#ea580c', fontWeight: 'bold' }}>{temReal ? fReal.toLocaleString('pt-BR', {minimumFractionDigits: 2}) : '-'}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center', color: '#0284c7', fontWeight: 'bold' }}>{impacto}%</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      {temReal ? (
                         <span style={{ color: desvio >= 0 ? '#16a34a' : '#ef4444', fontWeight: 'bold', backgroundColor: desvio >= 0 ? '#dcfce7' : '#fee2e2', padding: '4px 8px', borderRadius: '4px' }}>
                           {desvio >= 0 ? '+' : ''}{desvio.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                         </span>
                      ) : <span style={{ color: '#cbd5e1' }}>Aguardando Real</span>}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}