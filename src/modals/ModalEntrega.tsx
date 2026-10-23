import { useEffect, useState, type FormEvent } from 'react';
import { CircleCheck, Loader2, TriangleAlert } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { registrarLog, SELECT_ENTREGA, mensagemErro } from '../lib/db';
import { MODAIS, STATUS_ENTREGA, UFS } from '../lib/constants';
import { maskDecimal, parseDecimalBR, toInputDecimal } from '../lib/format';
import { Modal, ModalActions } from '../components/ui/Modal';
import { Check, Field } from '../components/ui/basics';
import { ClienteCombobox } from '../components/ui/ClienteCombobox';
import { useAppData } from '../state/context';
import { useFeedback } from '../feedback/context';
import type { Entrega } from '../types';

type Form = {
  nota_fiscal: string; cliente_id: string; transportadora_id: string; cidade_destino: string; uf_destino: string;
  modal_frete: string; data_entrada_pedido: string; data_faturamento: string; data_coleta: string; valor_nf: string;
  valor_frete: string; valor_frete_real: string; volume: string; peso_kg: string; tem_agendamento: boolean;
  data_previsao: string; data_entrega_agendamento: string; observacoes: string; status: string; frete_confirmado: boolean;
};

const VAZIO: Form = {
  nota_fiscal: '', cliente_id: '', transportadora_id: '', cidade_destino: '', uf_destino: '', modal_frete: '',
  data_entrada_pedido: '', data_faturamento: '', data_coleta: '', valor_nf: '', valor_frete: '', valor_frete_real: '',
  volume: '', peso_kg: '', tem_agendamento: false, data_previsao: '', data_entrega_agendamento: '', observacoes: '',
  status: 'Pendente', frete_confirmado: false,
};

function paraForm(e: Partial<Entrega>): Form {
  return {
    nota_fiscal: e.nota_fiscal ?? '', cliente_id: e.cliente_id ?? '', transportadora_id: e.transportadora_id ?? '',
    cidade_destino: e.cidade_destino ?? '', uf_destino: e.uf_destino ?? '', modal_frete: e.modal_frete ?? '',
    data_entrada_pedido: e.data_entrada_pedido ?? '', data_faturamento: e.data_faturamento ?? '', data_coleta: e.data_coleta ?? '',
    valor_nf: toInputDecimal(e.valor_nf), valor_frete: toInputDecimal(e.valor_frete), valor_frete_real: toInputDecimal(e.valor_frete_real),
    volume: e.volume?.toString() ?? '', peso_kg: toInputDecimal(e.peso_kg), tem_agendamento: !!e.tem_agendamento,
    data_previsao: e.data_previsao ?? '', data_entrega_agendamento: e.data_entrega_agendamento ?? '', observacoes: e.observacoes ?? '',
    status: e.status ?? 'Pendente', frete_confirmado: !!e.frete_confirmado,
  };
}

type NfStatus = 'idle' | 'checking' | 'available' | 'duplicate';

/**
 * Cadastro/edição de entrega. `entrega` = edição; `modelo` = nova entrega
 * pré-preenchida (função "Duplicar").
 */
export function ModalEntrega({ entrega, modelo, onClose }: { entrega?: Entrega; modelo?: Partial<Entrega>; onClose: () => void }) {
  const { clientes, transportadoras, setEntregas, isAdmin } = useAppData();
  const { toast } = useFeedback();
  const editando = !!entrega;
  const [form, setForm] = useState<Form>(() => (entrega ? paraForm(entrega) : modelo ? paraForm(modelo) : VAZIO));
  const [checagem, setChecagem] = useState<{ nf: string; status: NfStatus; dono: string } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const nfInicial = entrega?.nota_fiscal ?? '';

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  // Verificação de NF duplicada enquanto digita (mesma regra de antes).
  const nfAtual = form.nota_fiscal.trim();
  const nfIgualOriginal = editando && nfAtual.toLowerCase() === nfInicial.trim().toLowerCase();
  const nfStatus: NfStatus = !nfAtual ? 'idle' : nfIgualOriginal ? 'available' : checagem?.nf === nfAtual ? checagem.status : 'checking';
  const nfDono = checagem?.dono ?? '';

  useEffect(() => {
    if (!nfAtual || nfIgualOriginal) return;
    const t = setTimeout(async () => {
      try {
        const { data, error } = await supabase.from('entregas').select('clientes (nome)').ilike('nota_fiscal', nfAtual).limit(1);
        if (!error && data && data.length > 0) {
          setChecagem({ nf: nfAtual, status: 'duplicate', dono: (data[0].clientes as { nome?: string } | null)?.nome || 'Cliente desconhecido' });
        } else setChecagem({ nf: nfAtual, status: 'available', dono: '' });
      } catch { setChecagem({ nf: nfAtual, status: 'idle', dono: '' }); }
    }, 500);
    return () => clearTimeout(t);
  }, [nfAtual, nfIgualOriginal]);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!isAdmin) { toast({ kind: 'error', title: 'Acesso restrito', text: 'Apenas administradores podem criar ou editar entregas.' }); return; }
    const nf = form.nota_fiscal.trim();
    if (!nf) { toast({ kind: 'warning', title: 'Informe o número da Nota Fiscal.' }); return; }
    if (!form.cliente_id) { toast({ kind: 'warning', title: 'Selecione um cliente da lista.' }); return; }

    setSalvando(true);
    try {
      let q = supabase.from('entregas').select('id, clientes (nome)').ilike('nota_fiscal', nf);
      if (entrega) q = q.neq('id', entrega.id);
      const { data: existentes } = await q;
      if (existentes && existentes.length > 0) {
        const dono = (existentes[0].clientes as { nome?: string } | null)?.nome || 'Desconhecido';
        toast({ kind: 'error', title: 'Duplicidade bloqueada', text: `A NF "${nf}" já está cadastrada para o cliente ${dono}.` });
        return;
      }

      const payload = {
        nota_fiscal: nf, cliente_id: form.cliente_id, transportadora_id: form.transportadora_id || null,
        cidade_destino: form.cidade_destino || null, uf_destino: form.uf_destino || null, modal_frete: form.modal_frete || null,
        data_entrada_pedido: form.data_entrada_pedido || null, data_faturamento: form.data_faturamento || null, data_coleta: form.data_coleta || null,
        valor_nf: parseDecimalBR(form.valor_nf) ?? 0, valor_frete: parseDecimalBR(form.valor_frete) || null,
        valor_frete_real: parseDecimalBR(form.valor_frete_real) || null, volume: parseInt(form.volume) || null,
        peso_kg: parseDecimalBR(form.peso_kg) || null, tem_agendamento: form.tem_agendamento, data_previsao: form.data_previsao || null,
        data_entrega_agendamento: form.data_entrega_agendamento || null, observacoes: form.observacoes, status: form.status,
        frete_confirmado: form.frete_confirmado,
      };

      if (entrega) {
        const { data, error } = await supabase.from('entregas').update(payload).eq('id', entrega.id).select(SELECT_ENTREGA);
        if (error) throw error;
        if (data?.[0]) setEntregas((list) => list.map((x) => (x.id === entrega.id ? (data[0] as Entrega) : x)));
        await registrarLog('EDITOU', 'ENTREGAS', `Editou os dados da Entrega (NF: ${nf})`);
        toast({ kind: 'success', title: `Entrega NF ${nf} atualizada` });
      } else {
        const { data, error } = await supabase.from('entregas').insert([payload]).select(SELECT_ENTREGA);
        if (error) throw error;
        if (data?.[0]) setEntregas((list) => [data[0] as Entrega, ...list]);
        await registrarLog('CRIOU', 'ENTREGAS', `Registrou nova Entrega (NF: ${nf})`);
        toast({ kind: 'success', title: `Entrega NF ${nf} cadastrada` });
      }
      onClose();
    } catch (err) {
      toast({ kind: 'error', title: 'Erro ao salvar a entrega', text: mensagemErro(err) });
    } finally {
      setSalvando(false);
    }
  }

  const nfHint = {
    idle: undefined,
    checking: <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><Loader2 size={12} className="spin" /> Verificando disponibilidade…</span>,
    available: <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><CircleCheck size={12} /> Nota Fiscal livre</span>,
    duplicate: <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><TriangleAlert size={12} /> NF já cadastrada (Cliente: {nfDono})</span>,
  }[nfStatus];

  return (
    <Modal size="lg" onClose={onClose} onSubmit={salvar}
      title={editando ? `Editar entrega · NF ${nfInicial}` : modelo ? 'Nova entrega (duplicada)' : 'Nova entrega'}
      subtitle="Campos com * são obrigatórios"
      footer={<ModalActions onCancel={onClose} submitting={salvando} disabled={nfStatus === 'duplicate' || nfStatus === 'checking'}
        submitLabel={editando ? 'Atualizar entrega' : 'Salvar entrega'} />}>
      <div className="form-grid" style={{ ['--cols' as string]: 4 }}>
        <div className="form-section-title">Cliente e destino</div>
        <Field label="Cliente" required className="span-2">
          <ClienteCombobox clientes={clientes} value={form.cliente_id} required
            onSelect={(c) => setForm((f) => ({
              ...f,
              cliente_id: c?.id ?? '',
              ...(c ? {
                tem_agendamento: !!c.exige_agendamento,
                // sugere o destino a partir do cadastro do cliente, se ainda vazio
                cidade_destino: f.cidade_destino || c.cidade || '',
                uf_destino: f.uf_destino || c.uf || '',
              } : {}),
            }))} />
        </Field>
        <Field label="Nota Fiscal" required className="span-2" hint={nfHint} hintKind={nfStatus === 'available' ? 'ok' : nfStatus === 'duplicate' ? 'error' : undefined}>
          <input className={`input ${nfStatus === 'duplicate' ? 'input--error' : nfStatus === 'available' ? 'input--ok' : ''}`} required
            value={form.nota_fiscal} onChange={(e) => set('nota_fiscal', e.target.value)} inputMode="numeric" />
        </Field>
        <Field label="Cidade de destino" required className="span-2">
          <input className="input" required value={form.cidade_destino} onChange={(e) => set('cidade_destino', e.target.value)} />
        </Field>
        <Field label="UF destino">
          <select className="select" value={form.uf_destino} onChange={(e) => set('uf_destino', e.target.value)}>
            <option value="">Selecione…</option>
            {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
          </select>
        </Field>
        <Field label="Status" required>
          <select className="select" required value={form.status} onChange={(e) => set('status', e.target.value)}>
            {STATUS_ENTREGA.map((s) => <option key={s} value={s}>{s}</option>)}
            {!STATUS_ENTREGA.includes(form.status as never) && <option value={form.status}>{form.status}</option>}
          </select>
        </Field>

        <div className="form-section-title">Transporte</div>
        <Field label="Transportadora" className="span-2">
          <select className="select" value={form.transportadora_id} onChange={(e) => {
            const t = transportadoras.find((x) => x.id === e.target.value);
            setForm((f) => ({ ...f, transportadora_id: e.target.value, modal_frete: t?.modal_padrao || '' }));
          }}>
            <option value="">Selecione…</option>
            {transportadoras.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </select>
        </Field>
        <Field label="Modal de frete" className="span-2">
          <select className="select" value={form.modal_frete} onChange={(e) => set('modal_frete', e.target.value)}>
            <option value="">Padrão da transportadora</option>
            {MODAIS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </Field>

        <div className="form-section-title">Datas</div>
        <Field label="Entrada do pedido" required>
          <input type="date" className="input" required value={form.data_entrada_pedido} onChange={(e) => set('data_entrada_pedido', e.target.value)} />
        </Field>
        <Field label="Faturamento" required>
          <input type="date" className="input" required value={form.data_faturamento} onChange={(e) => set('data_faturamento', e.target.value)} />
        </Field>
        <Field label="Coleta">
          <input type="date" className="input" value={form.data_coleta} onChange={(e) => set('data_coleta', e.target.value)} />
        </Field>
        <Field label="Previsão">
          <input type="date" className="input" value={form.data_previsao} onChange={(e) => set('data_previsao', e.target.value)} />
        </Field>
        <Field label="Data de entrega" className="span-2" hint="Ao informar, o status muda para “Entregue”.">
          <input type="date" className="input" value={form.data_entrega_agendamento} onChange={(e) => {
            const d = e.target.value;
            setForm((f) => ({ ...f, data_entrega_agendamento: d, status: d ? 'Entregue' : f.status }));
          }} />
        </Field>

        <div className="form-section-title">Valores e carga</div>
        <Field label="Valor da NF (R$)" required>
          <input className="input num" required inputMode="decimal" placeholder="0,00" value={form.valor_nf} onChange={(e) => set('valor_nf', maskDecimal(e.target.value))} />
        </Field>
        <Field label="Frete cotado (R$)">
          <input className="input num" inputMode="decimal" placeholder="0,00" value={form.valor_frete} onChange={(e) => set('valor_frete', maskDecimal(e.target.value))} />
        </Field>
        <Field label="Frete real — CTE (R$)" hint="Preenchido automaticamente pelo CTE">
          <input className="input num input--highlight" inputMode="decimal" placeholder="0,00" value={form.valor_frete_real} onChange={(e) => set('valor_frete_real', maskDecimal(e.target.value))} />
        </Field>
        <Field label="Volume (caixas)">
          <input type="number" min="0" className="input num" inputMode="numeric" value={form.volume} onChange={(e) => set('volume', e.target.value)} />
        </Field>
        <Field label="Peso (kg)" required>
          <input className="input num" required inputMode="decimal" placeholder="Ex: 15,50" value={form.peso_kg} onChange={(e) => set('peso_kg', maskDecimal(e.target.value))} />
        </Field>
        <div className="span-all" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
          <Check id="tem_agendamento" checked={form.tem_agendamento} onChange={(v) => set('tem_agendamento', v)}>Possui agendamento</Check>
          <Check id="frete_confirmado" checked={form.frete_confirmado} onChange={(v) => set('frete_confirmado', v)}>Frete confirmado / auditado</Check>
        </div>

        <Field label="Observações" className="span-all">
          <textarea className="textarea" rows={2} value={form.observacoes} onChange={(e) => set('observacoes', e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
