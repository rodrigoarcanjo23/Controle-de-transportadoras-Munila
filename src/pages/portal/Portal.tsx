import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Camera, CircleCheck, Loader2, Search, Truck, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatDate, hojeISO, matchesSearch } from '../../lib/format';
import { OCORRENCIAS, caminhoCanhoto, comprimirImagem, ocorrenciaDe, type CodigoOcorrencia } from '../../lib/ocorrencias';
import { useFeedback } from '../../feedback/context';
import { pedirEnvioAvisos } from '../../lib/avisos';
import './portal.css';

interface NfPortal {
  id: string; nf: string; cliente: string | null; cidade: string | null; uf: string | null;
  faturamento: string | null; coleta: string | null; previsao: string | null; agendamento: string | null;
  status: string; volumes: number | null; peso: number | null;
}

/** Portal do transportador: página pública (sem login) aberta pelo link enviado à transportadora. */
export default function Portal() {
  const token = window.location.pathname.split('/')[2] ?? '';
  const { toast } = useFeedback();
  const [dados, setDados] = useState<{ transportadora: string; entregas: NfPortal[] } | null>(null);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  const [aberta, setAberta] = useState<NfPortal | null>(null);

  const carregar = useCallback(async () => {
    const { data, error } = await supabase.rpc('portal_listar', { p_token: token });
    if (error) { setErro(error.message.includes('inválido') ? 'Este link é inválido ou foi desativado. Peça um novo link à Munila.' : 'Não foi possível carregar. Tente novamente em instantes.'); return; }
    setDados(data as { transportadora: string; entregas: NfPortal[] });
  }, [token]);
  // busca assíncrona: os setState ocorrem após o await
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => { document.title = 'Portal do transportador · Munila'; }, []);

  const lista = useMemo(() => (dados?.entregas ?? []).filter((e) => matchesSearch(busca, e.nf, e.cliente, e.cidade, e.uf)), [dados, busca]);

  return (
    <div className="portal">
      <header className="portal__top">
        <img src="/favicon.png" alt="" />
        <div>
          <strong>Portal do transportador</strong>
          <span>{dados ? dados.transportadora : 'Munila'}</span>
        </div>
      </header>

      {erro ? <div className="portal__erro">{erro}</div>
        : !dados ? <div className="portal__carregando"><Loader2 className="spin" size={22} /> Carregando…</div>
        : (
          <main className="portal__main">
            <p className="portal__intro">
              Estas são as notas fiscais da Munila com a <b>{dados.transportadora}</b> que ainda não constam como entregues.
              Informe coleta, agendamento, entrega (com foto do canhoto) ou qualquer ocorrência — a Munila recebe na hora.
            </p>
            <label className="portal__busca">
              <Search size={18} />
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar NF, cliente ou cidade" inputMode="search" />
            </label>
            <div className="portal__cont">{lista.length} NF{lista.length === 1 ? '' : 's'} em aberto</div>
            <ul className="portal__lista">
              {lista.map((e) => (
                <li key={e.id} className="portal__nf">
                  <div className="portal__nf-top">
                    <strong>NF {e.nf}</strong>
                    <span className="portal__status">{e.status}</span>
                  </div>
                  <div className="portal__cli">{e.cliente ?? '—'}</div>
                  <div className="portal__meta">
                    <span>{e.cidade ?? '—'}/{e.uf ?? '—'}</span>
                    <span>Faturada {formatDate(e.faturamento)}</span>
                    {e.coleta && <span>Coletada {formatDate(e.coleta)}</span>}
                    {e.previsao && <span>Previsão {formatDate(e.previsao)}</span>}
                    {e.volumes ? <span>{e.volumes} vol.</span> : null}
                  </div>
                  <button className="portal__btn" onClick={() => setAberta(e)}>Informar ocorrência</button>
                </li>
              ))}
              {!lista.length && <li className="portal__vazio"><CircleCheck size={22} /> Nenhuma NF em aberto{busca ? ' para esta busca' : ''}.</li>}
            </ul>
          </main>
        )}

      {aberta && (
        <FormOcorrencia nf={aberta} token={token} onClose={() => setAberta(null)}
          onOk={(msg) => { setAberta(null); toast({ kind: 'success', title: msg }); carregar(); }} />
      )}
      <footer className="portal__rodape">MunilaLog · dúvidas: fale com a logística da Munila</footer>
    </div>
  );
}

function FormOcorrencia({ nf, token, onClose, onOk }: { nf: NfPortal; token: string; onClose: () => void; onOk: (m: string) => void }) {
  const [codigo, setCodigo] = useState<CodigoOcorrencia>('entregue');
  const [data, setData] = useState(hojeISO());
  const [previsao, setPrevisao] = useState('');
  const [obs, setObs] = useState('');
  const [foto, setFoto] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const def = ocorrenciaDe(codigo)!;

  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    setErro('');
    if (codigo === 'entregue' && !foto && !confirm('Enviar a entrega sem a foto do canhoto?')) return;
    setEnviando(true);
    try {
      let caminho: string | null = null;
      if (foto) {
        const arq = await comprimirImagem(foto);
        caminho = caminhoCanhoto(token, nf.id, arq);
        const { error: eUp } = await supabase.storage.from('canhotos').upload(caminho, arq, { contentType: arq.type, upsert: false });
        if (eUp) throw new Error('Não foi possível enviar a foto: ' + eUp.message);
      }
      const { error } = await supabase.rpc('portal_registrar', {
        p_token: token, p_entrega_id: nf.id, p_codigo: codigo, p_data: data,
        p_nova_previsao: def.pedePrevisao && previsao ? previsao : null, p_observacao: obs || null, p_canhoto: caminho,
      });
      if (error) throw new Error(error.message);
      if (codigo === 'entregue' || codigo === 'coletado') pedirEnvioAvisos(1500);
      onOk(`NF ${nf.nf}: ${def.label}`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally { setEnviando(false); }
  }

  return (
    <div className="portal__modal" role="dialog" aria-modal="true">
      <form className="portal__form" onSubmit={enviar}>
        <div className="portal__form-top">
          <div><strong>NF {nf.nf}</strong><span>{nf.cliente} · {nf.cidade}/{nf.uf}</span></div>
          <button type="button" className="portal__x" onClick={onClose} aria-label="Fechar"><X size={22} /></button>
        </div>
        <label>O que aconteceu?
          <div className="portal__opcoes">
            {OCORRENCIAS.map((o) => (
              <button type="button" key={o.codigo} className={`portal__op ${codigo === o.codigo ? 'is-on' : ''}`} onClick={() => setCodigo(o.codigo)}>{o.label}</button>
            ))}
          </div>
        </label>
        <label>{def.dataLabel}
          <input type="date" value={data} max={codigo === 'entregue' ? hojeISO() : undefined} onChange={(e) => setData(e.target.value)} required />
        </label>
        {def.pedePrevisao && (
          <label>Nova previsão de entrega <small>(opcional)</small>
            <input type="date" value={previsao} min={hojeISO()} onChange={(e) => setPrevisao(e.target.value)} />
          </label>
        )}
        <label>Observação <small>(opcional)</small>
          <textarea rows={2} value={obs} maxLength={500} onChange={(e) => setObs(e.target.value)} placeholder={codigo === 'entregue' ? 'Recebido por…' : 'Detalhes da ocorrência'} />
        </label>
        <label className="portal__foto">
          <Camera size={20} />
          <span>{foto ? foto.name : def.pedeCanhoto ? 'Foto do canhoto assinado (recomendado)' : 'Anexar foto ou PDF (opcional)'}</span>
          <input type="file" accept="image/*,application/pdf" capture="environment" onChange={(e) => setFoto(e.target.files?.[0] ?? null)} />
        </label>
        {erro && <div className="portal__erro portal__erro--form">{erro}</div>}
        <button className="portal__btn portal__btn--primario" disabled={enviando}>
          {enviando ? <><Loader2 className="spin" size={18} /> Enviando…</> : <><Truck size={18} /> Enviar</>}
        </button>
      </form>
    </div>
  );
}
