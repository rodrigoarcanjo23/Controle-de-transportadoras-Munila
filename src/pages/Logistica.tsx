import { useState } from 'react';
import { Truck, Search, Clock, AlertTriangle, CheckCircle, Package } from 'lucide-react';

export function Logistica({ entregas }: { entregas: any[] }) {
  const [busca, setBusca] = useState('');

  const calcularDiasSLA = (dataFat: string, dataEntrega: string, status: string) => {
    if (!dataFat) return { dias: '-', tipo: 'sem_data' };
    
    const dFat = new Date(dataFat + 'T12:00:00').getTime();
    
    if (status === 'Entregue' && dataEntrega) {
      const dEnt = new Date(dataEntrega + 'T12:00:00').getTime();
      const diff = Math.ceil((dEnt - dFat) / (1000 * 60 * 60 * 24));
      return { dias: diff, tipo: 'concluido' };
    } 
    
    const hoje = new Date().getTime();
    const diff = Math.ceil((hoje - dFat) / (1000 * 60 * 60 * 24));
    return { dias: diff, tipo: diff > 15 ? 'critico' : diff > 7 ? 'alerta' : 'normal' };
  };

  const entregasLogistica = entregas.filter(e => 
    (e.clientes?.nome || '').toLowerCase().includes(busca.toLowerCase()) ||
    (e.nota_fiscal || '').toLowerCase().includes(busca.toLowerCase()) ||
    (e.status || '').toLowerCase().includes(busca.toLowerCase())
  ).map(e => {
    const sla = calcularDiasSLA(e.data_faturamento, e.data_entrega_agendamento, e.status);
    return { ...e, sla };
  }).sort((a, b) => {
    if (a.sla.dias === '-') return 1;
    if (b.sla.dias === '-') return -1;
    if (a.status !== 'Entregue' && b.status === 'Entregue') return -1;
    if (a.status === 'Entregue' && b.status !== 'Entregue') return 1;
    return (b.sla.dias as number) - (a.sla.dias as number);
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', color: '#0f172a', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Truck size={28} color="#8b5cf6" /> Central de Logística & SLA
          </h2>
          <p style={{ color: '#64748b', margin: 0 }}>Monitoramento de envelhecimento de carga e status do cliente</p>
        </div>
        <div style={{ position: 'relative' }}>
          <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '10px' }} />
          <input type="text" className="form-input" placeholder="Buscar Cliente, NF ou Status..." value={busca} onChange={e => setBusca(e.target.value)} style={{ paddingLeft: '36px', width: '280px' }} />
        </div>
      </div>

      <div className="table-container" style={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569', fontSize: '0.75rem', textTransform: 'uppercase' }}>
              <th style={{ padding: '12px 16px', textAlign: 'left' }}>Cliente / Destino</th>
              <th style={{ padding: '12px 16px', textAlign: 'left' }}>Nº NF</th>
              <th style={{ padding: '12px 16px', textAlign: 'left' }}>Valor NF</th>
              <th style={{ padding: '12px 16px', textAlign: 'left' }}>Data Fat.</th>
              <th style={{ padding: '12px 16px', textAlign: 'center' }}>Status Operacional</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', backgroundColor: '#eff6ff', color: '#1d4ed8' }}>Envelhecimento (SLA)</th>
            </tr>
          </thead>
          <tbody>
            {entregasLogistica.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>Nenhum dado logístico.</td></tr>
            ) : (
              entregasLogistica.map(e => {
                let slaBadge = {};
                if (e.sla.tipo === 'concluido') slaBadge = { bg: '#dcfce7', color: '#166534', icon: <CheckCircle size={14}/>, texto: `${e.sla.dias} dias totais` };
                else if (e.sla.tipo === 'critico') slaBadge = { bg: '#fee2e2', color: '#991b1b', icon: <AlertTriangle size={14}/>, texto: `${e.sla.dias} dias rolando` };
                else if (e.sla.tipo === 'alerta') slaBadge = { bg: '#fef3c7', color: '#92400e', icon: <Clock size={14}/>, texto: `${e.sla.dias} dias rolando` };
                else if (e.sla.tipo === 'normal') slaBadge = { bg: '#f1f5f9', color: '#475569', icon: <Truck size={14}/>, texto: `${e.sla.dias} dias rolando` };
                else slaBadge = { bg: '#f1f5f9', color: '#cbd5e1', icon: <Package size={14}/>, texto: '-' };

                return (
                  <tr key={e.id} style={{ borderBottom: '1px solid #f1f5f9' }} className="trow-hover">
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 'bold', color: '#334155' }}>{e.clientes?.nome}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{e.cidade_destino || e.clientes?.cidade} - {e.uf_destino || e.clientes?.uf}</div>
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 'bold', color: '#475569' }}>{e.nota_fiscal}</td>
                    <td style={{ padding: '12px 16px', color: '#15803d', fontWeight: 'bold' }}>R$ {Number(e.valor_nf).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                    <td style={{ padding: '12px 16px', color: '#64748b' }}>
                      {e.data_faturamento ? new Date(e.data_faturamento + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, backgroundColor: e.status === 'Entregue' ? '#dcfce7' : e.status === 'Atrasado' ? '#fee2e2' : '#f1f5f9', color: e.status === 'Entregue' ? '#166534' : e.status === 'Atrasado' ? '#991b1b' : '#334155' }}>
                        {e.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px', backgroundColor: (slaBadge as any).bg, color: (slaBadge as any).color, fontWeight: 'bold', fontSize: '0.85rem' }}>
                        {(slaBadge as any).icon} {(slaBadge as any).texto}
                      </div>
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