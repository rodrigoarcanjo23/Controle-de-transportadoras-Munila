import { useMemo, useRef, useState, type DragEvent } from 'react';
import { CircleCheck, FileUp, Loader2, TriangleAlert, UploadCloud } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { mensagemErro, registrarLog, SELECT_ENTREGA } from '../lib/db';
import { formatDate, formatMoney } from '../lib/format';
import { lerArquivoTexto } from '../lib/xml';
import { MOD_FRETE, acharCliente, acharTransportadora, lerNfeSaida, nfExistente, type NfeSaida } from '../lib/nfeXml';
import { useAppData } from '../state/context';
import { useFeedback } from '../feedback/context';
import { Modal } from '../components/ui/Modal';
import type { Cliente, Entrega } from '../types';
import '../pages/bi/bi.css';

type Situacao = 'ok' | 'existe' | 'entrada' | 'cancelada' | 'erro' | 'sem_cliente' | 'repetida';
const SIT: Record<Situacao, { label: string; tone: string }> = {
  ok: { label: 'Pronta', tone: 'green' },
  sem_cliente: { label: 'Cliente novo', tone: 'blue' },
  existe: { label: 'Já no Painel', tone: 'slate' },
  repetida: { label: 'Arquivo repetido', tone: 'slate' },
  entrada: { label: 'NF de entrada', tone: 'amber' },
  cancelada: { label: 'Cancelada', tone: 'red' },
  erro: { label: 'Não lida', tone: 'red' },
};

interface Linha { id: string; nf?: NfeSaida; erro?: string; arquivo: string; situacao: Situacao; cliente?: Cliente; transportadoraId: string; marcada: boolean; existente?: Entrega }

/** Importa várias NF-e de saída (XML) de uma vez para o Painel de Entregas. */
export function ModalImportarNfe({ onClose }: { onClose: () => void }) {
  const { entregas, clientes, transportadoras, setEntregas, setClientes } = useAppData();
  const { toast } = useFeedback();
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [lendo, setLendo] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  const [criarClientes, setCriarClientes] = useState(true);
  const [importando, setImportando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function ler(files: FileList | File[]) {
    const lista = [...files].filter((f) => /\.xml$/i.test(f.name) || f.type.includes('xml'));
    if (!lista.length) { toast({ kind: 'warning', title: 'Escolha arquivos .xml de NF-e' }); return; }
    setLendo(true);
    const novas: Linha[] = [];
    const chaves = new Set(linhas.map((l) => l.nf?.chave).filter(Boolean));
    const canceladas = new Set<string>();
    const lidas: { f: File; nf?: NfeSaida; erro?: string }[] = [];
    for (const f of lista) {
      try { const nf = lerNfeSaida(await lerArquivoTexto(f), f.name); if (nf.cancelamento) canceladas.add(nf.chave); lidas.push({ f, nf }); }
      catch (err) { lidas.push({ f, erro: err instanceof Error ? err.message : 'erro de leitura' }); }
    }
    for (const { f, nf, erro } of lidas) {
      const id = `${f.name}-${f.size}-${f.lastModified}-${Math.random().toString(36).slice(2, 6)}`;
      if (!nf) { novas.push({ id, arquivo: f.name, erro, situacao: 'erro', transportadoraId: '', marcada: false }); continue; }
      if (nf.cancelamento) continue; // o evento só marca a NF correspondente como cancelada
      const cliente = acharCliente(nf, clientes);
      const transp = acharTransportadora(nf, transportadoras);
      const existente = nfExistente(nf.numero, entregas);
      const situacao: Situacao = canceladas.has(nf.chave) ? 'cancelada'
        : chaves.has(nf.chave) ? 'repetida'
        : existente ? 'existe'
        : nf.tipo === '0' ? 'entrada'
        : cliente ? 'ok' : 'sem_cliente';
      chaves.add(nf.chave);
      novas.push({ id, arquivo: f.name, nf, situacao, cliente, transportadoraId: transp ? String(transp.id) : '', marcada: situacao === 'ok' || situacao === 'sem_cliente', existente });
    }
    setLinhas((xs) => [...xs, ...novas].sort((a, b) => Number(a.nf?.numero ?? 0) - Number(b.nf?.numero ?? 0)));
    setLendo(false);
  }

  const onDrop = (e: DragEvent) => { e.preventDefault(); setArrastando(false); if (e.dataTransfer.files?.length) ler(e.dataTransfer.files); };
  const set = (id: string, p: Partial<Linha>) => setLinhas((xs) => xs.map((l) => (l.id === id ? { ...l, ...p } : l)));

  const marcadas = linhas.filter((l) => l.marcada && l.nf && (l.situacao === 'ok' || (l.situacao === 'sem_cliente' && criarClientes)));
  const cont = useMemo(() => {
    const c: Partial<Record<Situacao, number>> = {};
    linhas.forEach((l) => { c[l.situacao] = (c[l.situacao] ?? 0) + 1; });
    return c;
  }, [linhas]);
  const semTransp = marcadas.filter((l) => !l.transportadoraId).length;

  async function importar() {
    if (!marcadas.length) return;
    setImportando(true);
    try {
      // confere de novo no banco (outra pessoa pode ter cadastrado nesse meio tempo)
      const numeros = marcadas.map((l) => l.nf!.numero);
      const { data: ja } = await supabase.from('entregas').select('nota_fiscal').in('nota_fiscal', numeros);
      const jaSet = new Set((ja ?? []).map((x) => String(Number(x.nota_fiscal))));
      const aImportar = marcadas.filter((l) => !jaSet.has(l.nf!.numero));

      // clientes novos (um por CNPJ/CPF)
      const mapaCli = new Map<string, Cliente>();
      const novosCli = new Map<string, NfeSaida>();
      for (const l of aImportar) if (!l.cliente) novosCli.set(l.nf!.dest.doc || l.nf!.dest.nome, l.nf!);
      if (novosCli.size) {
        const { data, error } = await supabase.from('clientes').insert([...novosCli.values()].map((n) => ({
          nome: n.dest.nome, razao_social: n.dest.nome, cnpj_cpf: n.dest.doc || null, cidade: n.dest.cidade || null, uf: n.dest.uf || null,
          telefone: n.dest.fone || null, email: n.dest.email || null, exige_agendamento: false,
        }))).select('*');
        if (error) throw error;
        const criados = (data ?? []) as Cliente[];
        criados.forEach((c) => mapaCli.set((c.cnpj_cpf ?? '').replace(/\D/g, '') || c.nome, c));
        setClientes((xs) => [...xs, ...criados].sort((a, b) => a.nome.localeCompare(b.nome)));
        registrarLog('CRIOU', 'CLIENTES', `Cadastrou ${criados.length} cliente(s) pela importação de NF-e: ${criados.map((c) => c.nome).join(', ')}`);
      }

      const payload = aImportar.map((l) => {
        const n = l.nf!;
        const cli = l.cliente ?? mapaCli.get(n.dest.doc || n.dest.nome)!;
        const t = transportadoras.find((x) => String(x.id) === l.transportadoraId);
        return {
          nota_fiscal: n.numero, cliente_id: cli.id, transportadora_id: t?.id ?? null,
          cidade_destino: n.dest.cidade || cli.cidade || null, uf_destino: n.dest.uf || cli.uf || null,
          modal_frete: t?.modal_padrao || null, data_faturamento: n.emissao || null,
          valor_nf: n.valor, volume: n.volumes ? Math.round(n.volumes) : null, peso_kg: n.pesoBruto || n.pesoLiquido || null,
          tem_agendamento: !!cli.exige_agendamento, status: 'Pendente', observacoes: '', frete_confirmado: false,
        };
      });
      const inseridas: Entrega[] = [];
      for (let i = 0; i < payload.length; i += 100) {
        const { data, error } = await supabase.from('entregas').insert(payload.slice(i, i + 100)).select(SELECT_ENTREGA);
        if (error) throw error;
        inseridas.push(...((data ?? []) as Entrega[]));
      }
      setEntregas((xs) => [...inseridas, ...xs]);
      for (let i = 0; i < inseridas.length; i += 40) {
        await registrarLog('CRIOU', 'ENTREGAS', `Importou ${inseridas.length > 40 ? `${inseridas.slice(i, i + 40).length} de ${inseridas.length} ` : ''}entrega(s) por XML de NF-e: NF ${inseridas.slice(i, i + 40).map((e) => e.nota_fiscal).join(', ')}`);
      }
      const puladas = marcadas.length - aImportar.length;
      toast({ kind: 'success', title: `${inseridas.length} NF(s) importada(s) para o Painel`, text: [novosCli.size && `${novosCli.size} cliente(s) cadastrado(s)`, puladas && `${puladas} já estavam cadastradas`].filter(Boolean).join(' · ') || undefined });
      onClose();
    } catch (err) {
      toast({ kind: 'error', title: 'Não foi possível importar', text: mensagemErro(err) });
    } finally { setImportando(false); }
  }

  const valorTotal = marcadas.reduce((s, l) => s + (l.nf?.valor ?? 0), 0);
  return (
    <Modal size="lg" autoFocus={false} title="Importar NF-e por XML" subtitle="Arraste os XMLs das notas de saída: o Painel de Entregas se preenche sozinho" onClose={onClose}
      footer={<>
        {linhas.length > 0 && <span className="muted imp-resumo">{marcadas.length} NF(s) · {formatMoney(valorTotal)}{semTransp ? ` · ${semTransp} sem transportadora` : ''}</span>}
        <button className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={importar} disabled={!marcadas.length || importando}>{importando ? <><Loader2 size={15} className="spin" /> Importando…</> : `Importar ${marcadas.length || ''} NF(s)`}</button>
      </>}>
      <div className="imp">
        <div className={`imp-drop ${arrastando ? 'is-on' : ''}`} onDragOver={(e) => { e.preventDefault(); setArrastando(true); }} onDragLeave={() => setArrastando(false)} onDrop={onDrop}
          onClick={() => inputRef.current?.click()} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') inputRef.current?.click(); }}>
          {lendo ? <Loader2 size={26} className="spin" /> : <UploadCloud size={28} />}
          <div><strong>{lendo ? 'Lendo os arquivos…' : 'Arraste os XMLs aqui ou clique para escolher'}</strong>
            <span>Pode selecionar vários de uma vez (Ctrl+A na pasta). Também aceita eventos de cancelamento, que marcam a NF como cancelada.</span></div>
          <input ref={inputRef} type="file" accept=".xml,text/xml,application/xml" multiple hidden onChange={(e) => { if (e.target.files) ler(e.target.files); e.target.value = ''; }} />
        </div>

        {linhas.length > 0 && (<>
          <div className="imp-barra">
            {(Object.keys(SIT) as Situacao[]).filter((s) => cont[s]).map((s) => <span key={s} className={`badge tone-${SIT[s].tone}`}>{SIT[s].label}: {cont[s]}</span>)}
            {(cont.sem_cliente ?? 0) > 0 && (
              <label className="imp-check"><input type="checkbox" checked={criarClientes} onChange={(e) => setCriarClientes(e.target.checked)} /> Cadastrar os clientes novos com os dados da NF</label>
            )}
            <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setLinhas([])}>Limpar lista</button>
          </div>
          <div className="table-scroll imp-tabela">
            <table className="bi-tabela">
              <thead><tr><th /><th>NF</th><th>Emissão</th><th>Cliente</th><th>Destino</th><th className="r">Valor</th><th className="r">Vol.</th><th className="r">Peso</th><th>Transportadora</th><th>Situação</th></tr></thead>
              <tbody>
                {linhas.map((l) => {
                  const n = l.nf; const s = SIT[l.situacao];
                  const pode = l.situacao === 'ok' || l.situacao === 'sem_cliente';
                  if (!n) return (
                    <tr key={l.id} className="is-off"><td /><td colSpan={8}><TriangleAlert size={13} /> {l.arquivo}: {l.erro}</td><td><span className={`badge tone-${s.tone}`}>{s.label}</span></td></tr>
                  );
                  return (
                    <tr key={l.id} className={pode ? '' : 'is-off'}>
                      <td><input type="checkbox" checked={l.marcada && pode} disabled={!pode} onChange={(e) => set(l.id, { marcada: e.target.checked })} aria-label={`Importar NF ${n.numero}`} /></td>
                      <td className="strong" title={`Chave ${n.chave}\n${n.natureza}`}>{n.numero}<small className="muted imp-sub">série {n.serie}</small></td>
                      <td>{formatDate(n.emissao)}</td>
                      <td title={n.dest.doc}>{l.cliente?.nome ?? n.dest.nome}{!l.cliente && <small className="imp-sub text-blue">novo cliente</small>}</td>
                      <td>{n.dest.cidade}/{n.dest.uf}</td>
                      <td className="r">{formatMoney(n.valor)}</td>
                      <td className="r">{n.volumes || '—'}</td>
                      <td className="r">{n.pesoBruto || n.pesoLiquido ? `${(n.pesoBruto || n.pesoLiquido).toLocaleString('pt-BR')} kg` : '—'}</td>
                      <td>
                        {pode ? (
                          <select className="select imp-select" value={l.transportadoraId} onChange={(e) => set(l.id, { transportadoraId: e.target.value })} title={n.transp.nome ? `Na NF: ${n.transp.nome} · ${MOD_FRETE[n.modFrete] ?? ''}` : MOD_FRETE[n.modFrete]}>
                            <option value="">{n.transp.nome ? `${n.transp.nome.slice(0, 22)} (sem cadastro)` : '— definir depois —'}</option>
                            {transportadoras.map((t) => <option key={t.id} value={String(t.id)}>{t.nome}</option>)}
                          </select>
                        ) : <span className="muted">{n.transp.nome || '—'}</span>}
                      </td>
                      <td>
                        <span className={`badge tone-${s.tone}`} title={l.existente ? `Já cadastrada: NF ${l.existente.nota_fiscal} (${l.existente.status})` : undefined}>
                          {l.situacao === 'ok' && <CircleCheck size={11} />} {s.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="muted imp-nota"><FileUp size={13} /> A data de faturamento é a de emissão da NF; valor, volumes e peso bruto vêm do XML; o modal vem do cadastro da transportadora e o agendamento, do cliente. Status inicial: Pendente. NFs já cadastradas, de entrada ou canceladas não são importadas.</p>
        </>)}
      </div>
    </Modal>
  );
}
