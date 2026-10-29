import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Camera, FileImage, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { registrarLog, mensagemErro, SELECT_ENTREGA } from '../lib/db';
import { formatDate, formatDateTimeBR, hojeISO } from '../lib/format';
import {
  OCORRENCIAS, caminhoCanhoto, comprimirImagem, efeitoNaEntrega, ocorrenciaDe, type CodigoOcorrencia, type Ocorrencia,
} from '../lib/ocorrencias';
import { useAppData } from '../state/context';
import { useFeedback } from '../feedback/context';
import type { Entrega } from '../types';

/** Ocorrências da NF (do portal da transportadora ou lançadas aqui) com o canhoto. */
export function OcorrenciasNF({ entrega }: { entrega: Entrega }) {
  const { isAdmin, email, setEntregas } = useAppData();
  const { toast } = useFeedback();
  const [lista, setLista] = useState<Ocorrencia[] | null>(null);
  const [semTabela, setSemTabela] = useState(false);
  const [form, setForm] = useState(false);

  const carregar = useCallback(async () => {
    const { data, error } = await supabase.from('ocorrencias').select('*').eq('entrega_id', String(entrega.id)).order('data_ocorrencia', { ascending: false }).order('created_at', { ascending: false });
    if (error) { setSemTabela(true); setLista([]); return; }
    setLista((data ?? []) as Ocorrencia[]);
  }, [entrega.id]);
  // busca assíncrona: os setState ocorrem após o await
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { carregar(); }, [carregar]);

  async function verCanhoto(path: string) {
    const { data, error } = await supabase.storage.from('canhotos').createSignedUrl(path, 300);
    if (error || !data) { toast({ kind: 'error', title: 'Não foi possível abrir o canhoto', text: error?.message }); return; }
    window.open(data.signedUrl, '_blank', 'noopener');
  }

  if (semTabela) return null; // SQL da Fase 1 ainda não rodado
  return (
    <div className="ocor">
      <div className="ocor__tit">
        <h4 className="hist__tit">Ocorrências de entrega</h4>
        {isAdmin && !form && <button className="btn btn-ghost btn-sm" onClick={() => setForm(true)}><Plus size={14} /> Registrar ocorrência</button>}
      </div>
      {form && <NovaOcorrencia entrega={entrega} email={email}
        onCancel={() => setForm(false)}
        onOk={async (atual) => {
          setForm(false); await carregar();
          if (atual) setEntregas((l) => l.map((x) => (x.id === atual.id ? atual : x)));
          toast({ kind: 'success', title: 'Ocorrência registrada' });
        }} />}
      {lista === null ? <p className="muted">Carregando…</p>
        : !lista.length ? <p className="muted">Nenhuma ocorrência. A transportadora pode informar pelo portal (Cadastros › Transportadoras › Portal).</p>
        : (
          <ul className="ocor__lista">
            {lista.map((o) => {
              const def = ocorrenciaDe(o.codigo);
              return (
                <li key={o.id}>
                  <span className={`badge tone-${def?.tone ?? 'slate'}`}>{def?.label ?? o.descricao ?? o.codigo}</span>
                  <div className="ocor__txt">
                    <span><b>{formatDate(o.data_ocorrencia)}</b>{o.nova_previsao && <> · nova previsão {formatDate(o.nova_previsao)}</>}{o.observacao && <> · {o.observacao}</>}</span>
                    <small className="muted">{o.origem === 'portal' ? `Portal · ${o.autor ?? 'transportadora'}` : o.autor ?? 'interno'} · {formatDateTimeBR(o.created_at)}</small>
                  </div>
                  {o.canhoto_path && <button className="btn btn-sm" onClick={() => verCanhoto(o.canhoto_path!)}><FileImage size={14} /> Canhoto</button>}
                </li>
              );
            })}
          </ul>
        )}
    </div>
  );
}

function NovaOcorrencia({ entrega, email, onCancel, onOk }: { entrega: Entrega; email: string; onCancel: () => void; onOk: (e: Entrega | null) => void }) {
  const { toast } = useFeedback();
  const [codigo, setCodigo] = useState<CodigoOcorrencia>('entregue');
  const [data, setData] = useState(hojeISO());
  const [prev, setPrev] = useState('');
  const [obs, setObs] = useState('');
  const [foto, setFoto] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);
  const def = ocorrenciaDe(codigo)!;

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setSalvando(true);
    try {
      let caminho: string | null = null;
      if (foto) {
        const arq = await comprimirImagem(foto);
        caminho = caminhoCanhoto('interno', String(entrega.id), arq);
        const { error } = await supabase.storage.from('canhotos').upload(caminho, arq, { contentType: arq.type });
        if (error) throw error;
      }
      const { error } = await supabase.from('ocorrencias').insert({
        entrega_id: String(entrega.id), codigo, descricao: def.label, data_ocorrencia: data, nova_previsao: def.pedePrevisao && prev ? prev : null,
        observacao: obs || null, canhoto_path: caminho, origem: 'interno', autor: email,
      });
      if (error) throw error;
      const patch = efeitoNaEntrega(entrega, codigo, data, prev || null);
      const { data: upd, error: e2 } = await supabase.from('entregas').update(patch).eq('id', entrega.id).select(SELECT_ENTREGA);
      if (e2) throw e2;
      await registrarLog('EDITOU', 'ENTREGAS', `Registrou ocorrência na NF ${entrega.nota_fiscal}: ${def.label} (${formatDate(data)})${obs ? ` — ${obs}` : ''}`);
      onOk((upd?.[0] as Entrega) ?? null);
    } catch (err) {
      toast({ kind: 'error', title: 'Não foi possível registrar', text: mensagemErro(err) });
    } finally { setSalvando(false); }
  }

  return (
    <form className="ocor__form" onSubmit={salvar}>
      <div className="field"><label>Ocorrência</label>
        <select className="select" value={codigo} onChange={(e) => setCodigo(e.target.value as CodigoOcorrencia)}>
          {OCORRENCIAS.map((o) => <option key={o.codigo} value={o.codigo}>{o.label}</option>)}
        </select>
      </div>
      <div className="field"><label>{def.dataLabel}</label><input type="date" className="input" value={data} onChange={(e) => setData(e.target.value)} required /></div>
      {def.pedePrevisao && <div className="field"><label>Nova previsão</label><input type="date" className="input" value={prev} onChange={(e) => setPrev(e.target.value)} /></div>}
      <div className="field ocor__obs"><label>Observação</label><input className="input" value={obs} maxLength={500} onChange={(e) => setObs(e.target.value)} /></div>
      <label className="btn btn-sm ocor__foto"><Camera size={14} /> {foto ? foto.name.slice(0, 18) : 'Canhoto'}<input type="file" accept="image/*,application/pdf" hidden onChange={(e) => setFoto(e.target.files?.[0] ?? null)} /></label>
      <div className="ocor__acoes">
        <button type="button" className="btn btn-sm btn-ghost" onClick={onCancel}>Cancelar</button>
        <button className="btn btn-sm btn-primary" disabled={salvando}>{salvando ? 'Salvando…' : 'Registrar'}</button>
      </div>
    </form>
  );
}
