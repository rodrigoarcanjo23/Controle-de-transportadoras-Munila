import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, ChartPie, Download, Lock, LockOpen, MapPin, Presentation } from 'lucide-react';
import { useAppData } from '../state/context';
import { useFeedback } from '../feedback/context';
import { useChartTheme } from '../hooks/useChartTheme';
import { FILTROS_VAZIOS } from '../lib/filtrosEntrega';
import { REGIOES } from '../lib/constants';
import {
  avaliarMetas, calcularDevolucoes, calcularMetricas, checarQualidade, filtrarBI, rankingTransportadoras, fmtMes, gerarDestaques, pesosSuspeitos, resolverPeriodo, serieEvolucao, type PeriodoId,
} from '../lib/bi';
import { EmptyState, PageHeader } from '../components/ui/basics';
import { PageLoader } from '../components/layout/PageLoader';
import type { DadosBI } from './bi/Secoes';
import { SECOES, secoesApresentaveis } from './bi/listaSecoes';
import { resumirArmazem } from './bi/armazem';
import { useFechamentos } from './bi/useFechamentos';
import { useIndicadores } from './indicadores/useIndicadores';
import { formatDateTimeBR, formatMoney, formatPercent, percentual } from '../lib/format';
import { Apresentacao } from './bi/Apresentacao';
import './bi/bi.css';

export default function Analise() {
  const { entregas, devolucoes, metas: metasCad, loading, setFiltros, isAdmin, email, perfis } = useAppData();
  const ind = useIndicadores();
  const { toast, confirm } = useFeedback();
  const fech = useFechamentos();
  const navigate = useNavigate();
  const c = useChartTheme();
  const painelRef = useRef<HTMLDivElement>(null);

  const [periodo, setPeriodo] = useState<PeriodoId>('tudo');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [mes, setMes] = useState('');
  const [regiao, setRegiao] = useState('');
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [apresentando, setApresentando] = useState<number | null>(null);

  const meses = useMemo(() => {
    const s = new Set<string>();
    entregas.forEach((e) => { if (e.data_faturamento) s.add(e.data_faturamento.substring(0, 7)); });
    return Array.from(s).sort().reverse();
  }, [entregas]);

  const per = useMemo(() => resolverPeriodo(periodo, { mes: mes || meses[0], de: dataInicio, ate: dataFim }),
    [periodo, mes, meses, dataInicio, dataFim]);
  const suspeitos = useMemo(() => pesosSuspeitos(entregas), [entregas]);

  const dadosVivos = useMemo<DadosBI | null>(() => {
    const atual = filtrarBI(entregas, per.atual, regiao);
    if (!atual.length) return null;
    const ant = per.anterior ? filtrarBI(entregas, per.anterior, regiao) : [];
    const m = calcularMetricas(atual, suspeitos);
    const ma = ant.length ? calcularMetricas(ant, suspeitos) : null;
    const ranking = rankingTransportadoras(m);
    const metas = avaliarMetas(atual, metasCad);
    const destaques = gerarDestaques(m, ma, per.rotuloAnterior);
    // destaques da etapa 2: melhor transportadora e metas de frete
    const melhor = ranking.find((r) => r.nota !== null && r.notas >= 3);
    const pior = [...ranking].reverse().find((r) => r.nota !== null && r.notas >= 3);
    if (melhor) {
      destaques.splice(Math.min(4, destaques.length), 0, {
        tom: 'neutro',
        texto: `Melhor transportadora do período: **${melhor.nome}** (nota ${melhor.nota})` +
          (pior && pior.nome !== melhor.nome && (pior.nota ?? 100) < 55 ? `; pior avaliada: **${pior.nome}** (nota ${pior.nota}).` : '.'),
      });
    }
    const avaliadas = metas.filter((x) => x.status === 'dentro' || x.status === 'acima');
    if (avaliadas.length) {
      const acima = avaliadas.filter((x) => x.status === 'acima').length;
      destaques.push({
        tom: acima ? 'ruim' : 'bom',
        texto: acima
          ? `**${acima} de ${avaliadas.length} metas de frete** ficaram acima do combinado (cliente × transportadora).`
          : `Todas as **${avaliadas.length} metas de frete** com CTE ficaram dentro do combinado.`,
      });
    }
    // etapa 3: armazém, devoluções e qualidade dos dados
    const armazem = ind.estado === 'ok' ? resumirArmazem(ind.dias, per.atual, per.anterior) : null;
    const dev = calcularDevolucoes(devolucoes, per.atual);
    const devAnt = per.anterior ? calcularDevolucoes(devolucoes, per.anterior) : null;
    if (armazem?.totalDias) {
      const exp = armazem.kpis.find((k) => k.area === 'expedicao' && k.id === 'prazo')?.valor ?? null;
      const div = armazem.kpis.find((k) => k.area === 'recebimento' && k.id === 'idx_div')?.valor ?? null;
      const partes = [
        exp !== null ? `**${formatPercent(exp, 1)} dos pedidos** coletados no prazo` : '',
        div !== null ? `divergência no recebimento de **${formatPercent(div, 1)}**` : '',
      ].filter(Boolean);
      if (partes.length) destaques.push({ tom: exp !== null && exp < 90 ? 'ruim' : 'neutro', texto: `No armazém: ${partes.join('; ')}.` });
    }
    if (dev.qtd) {
      const pctDev = percentual(dev.valor, m.faturamento);
      destaques.push({
        tom: pctDev > 1 ? 'ruim' : 'neutro',
        texto: `**${dev.qtd} devolução${dev.qtd > 1 ? 'ões' : ''}** no período (${formatPercent(pctDev, 2)} do faturamento)` +
          (dev.motivos[0] && dev.motivos[0].nome !== 'Não informado' ? `; principal motivo: **${dev.motivos[0].nome}**.` : '.'),
      });
    }
    return {
      m, ma, per, serie: serieEvolucao(atual), destaques, ranking, metas,
      armazem, dev, devAnt, qualidade: checarQualidade(atual, suspeitos),
    };
  }, [entregas, per, regiao, suspeitos, metasCad, devolucoes, ind.estado, ind.dias]);

  // ---- Fechamento mensal: mês fechado mostra os números congelados ----
  const mesSel = periodo === 'mes' ? (mes || meses[0] || '') : '';
  const fechamento = fech.lista.find((f) => f.mes === mesSel);
  const fechados = useMemo(() => new Set(fech.lista.map((f) => f.mes)), [fech.lista]);
  const [verAtual, setVerAtual] = useState(false);
  const [mesAnterior, setMesAnterior] = useState(mesSel);
  if (mesSel !== mesAnterior) { setMesAnterior(mesSel); setVerAtual(false); }
  const [congelado, setCongelado] = useState<{ mes: string; dados: DadosBI } | null>(null);
  const abrirFechamento = fech.abrir;
  useEffect(() => {
    if (!fechamento || congelado?.mes === fechamento.mes) return;
    let vivo = true;
    abrirFechamento(fechamento.mes).then((d) => { if (vivo && d) setCongelado({ mes: fechamento.mes, dados: d }); });
    return () => { vivo = false; };
  }, [fechamento, congelado?.mes, abrirFechamento]);
  const mostrandoFechamento = !!fechamento && !verAtual && congelado?.mes === mesSel;
  const dados = mostrandoFechamento ? congelado!.dados : dadosVivos;
  const mesAtual = new Date().toISOString().slice(0, 7);

  async function fecharMes() {
    if (!dadosVivos || !mesSel) return;
    const ok = await confirm({
      title: `Fechar ${fmtMes(mesSel)}?`,
      text: `Os números do BI deste mês (${dadosVivos.m.notas} NFs, ${formatMoney(dadosVivos.m.faturamento)}) ficam congelados como foram apresentados. Correções futuras em NFs deste mês não mudam o fechamento — o painel mostra a diferença.\n\nUm administrador pode reabrir o mês depois.`,
      confirmLabel: 'Fechar o mês',
    });
    if (!ok) return;
    try { await fech.fechar(mesSel, dadosVivos, email); setCongelado({ mes: mesSel, dados: dadosVivos }); toast({ kind: 'success', title: `${fmtMes(mesSel)} fechado` }); }
    catch (err) { toast({ kind: 'error', title: 'Não foi possível fechar o mês', text: err instanceof Error ? err.message : String(err) }); }
  }
  async function reabrirMes() {
    if (!mesSel) return;
    const ok = await confirm({ title: `Reabrir ${fmtMes(mesSel)}?`, text: 'O fechamento é excluído e o BI volta a mostrar os números atuais deste mês. Você pode fechar de novo depois.', confirmLabel: 'Reabrir', danger: true });
    if (!ok) return;
    try { await fech.reabrir(mesSel); setCongelado(null); toast({ kind: 'success', title: `${fmtMes(mesSel)} reaberto` }); }
    catch (err) { toast({ kind: 'error', title: 'Não foi possível reabrir', text: err instanceof Error ? err.message : String(err) }); }
  }
  const diferencas = useMemo(() => {
    if (!mostrandoFechamento || !dadosVivos || !congelado) return [];
    const a = congelado.dados.m; const b = dadosVivos.m; const out: string[] = [];
    if (b.notas !== a.notas) out.push(`${b.notas - a.notas > 0 ? '+' : ''}${b.notas - a.notas} NF(s)`);
    if (Math.abs(b.faturamento - a.faturamento) >= 0.01) out.push(`faturamento ${b.faturamento > a.faturamento ? '+' : '−'}${formatMoney(Math.abs(b.faturamento - a.faturamento))}`);
    if (Math.abs(b.pctFrete - a.pctFrete) >= 0.005) out.push(`% de frete ${formatPercent(a.pctFrete)} → ${formatPercent(b.pctFrete)}`);
    if (b.conferidas !== a.conferidas) out.push(`${b.conferidas - a.conferidas > 0 ? '+' : ''}${b.conferidas - a.conferidas} NF(s) com CTE`);
    return out;
  }, [mostrandoFechamento, dadosVivos, congelado]);
  const nomeDe = (e?: string | null) => perfis.find((p) => p.email?.toLowerCase() === e?.toLowerCase())?.nome ?? e ?? '—';

  const apresentaveis = useMemo(() => (dados ? secoesApresentaveis(dados) : []), [dados]);

  const abrirNoPainel = useCallback((status: string[]) => {
    setFiltros({ ...FILTROS_VAZIOS, status });
    navigate('/dashboard');
  }, [setFiltros, navigate]);
  const fecharApresentacao = useCallback(() => setApresentando(null), []);

  /** PDF em páginas A4 deitadas: capa + um bloco por página (pronto para reunião). */
  async function exportarPDF() {
    if (!painelRef.current) return;
    setGerandoPdf(true);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const W = 297, H = 210, M = 10;
      const cab = (titulo: string, n: number) => {
        pdf.setFillColor(11, 31, 51); pdf.rect(0, 0, W, 14, 'F');
        pdf.setTextColor(255, 255, 255); pdf.setFontSize(11); pdf.text(`MunilaLog · Painel de BI — ${titulo}`, M, 9);
        pdf.setFontSize(9); pdf.text(`${per.rotulo}${regiao ? ` · ${regiao}` : ''}   ${n}`, W - M, 9, { align: 'right' });
      };
      const ids = new Set(apresentaveis.map((s) => s.id));
      const blocos = Array.from(painelRef.current.querySelectorAll<HTMLElement>('[data-secao]')).filter((el) => ids.has(el.dataset.secao ?? ''));
      for (let k = 0; k < blocos.length; k++) {
        const el = blocos[k];
        const canvas = await html2canvas(el, {
          scale: 2, useCORS: true, backgroundColor: c.bg,
          ignoreElements: (n) => n instanceof HTMLElement && n.dataset.pdfIgnore !== undefined,
        });
        if (k > 0) pdf.addPage();
        cab(el.dataset.titulo ?? '', k + 1);
        const maxW = W - 2 * M, maxH = H - 14 - 2 * M;
        const r = Math.min(maxW / canvas.width, maxH / canvas.height);
        const w = canvas.width * r, h = canvas.height * r;
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', (W - w) / 2, 14 + M, w, h);
      }
      pdf.save(`BI_MunilaLog_${per.rotulo.replace(/[^\w]+/g, '_')}${regiao ? `_${regiao}` : ''}.pdf`);
      toast({ kind: 'success', title: 'PDF gerado', text: `${blocos.length} páginas, uma por bloco.` });
    } catch (err) {
      console.error(err);
      toast({ kind: 'error', title: 'Não foi possível gerar o PDF', text: 'Tente novamente.' });
    } finally {
      setGerandoPdf(false);
    }
  }

  if (loading && !entregas.length) return <PageLoader />;

  const ctxBase = dados ? { d: dados, abrir: abrirNoPainel, ir: navigate } : null;

  return (
    <div className="page bi">
      <PageHeader icon={<ChartPie size={22} />} title="Painel de BI" subtitle="Visão executiva da operação logística — pronta para reunião"
        actions={
          <>
            <button className="btn" onClick={exportarPDF} disabled={gerandoPdf || !dados}>
              <Download size={16} /> {gerandoPdf ? 'Gerando PDF…' : 'Exportar PDF'}
            </button>
            <button className="btn btn-primary" onClick={() => setApresentando(0)} disabled={!dados} title="Tela cheia, um bloco por vez (setas ← →)">
              <Presentation size={16} /> Apresentar
            </button>
          </>
        } />

      <div className="card card-pad no-print bi-filtros">
        <div className="field">
          <label><Calendar size={14} /> Período</label>
          <select className="select" value={periodo} onChange={(e) => setPeriodo(e.target.value as PeriodoId)}>
            <option value="tudo">Todo o histórico</option>
            <option value="mes">Mês…</option>
            <option value="30dias">Últimos 30 dias</option>
            <option value="90dias">Últimos 3 meses</option>
            <option value="esteAno">Este ano</option>
            <option value="personalizado">Personalizado…</option>
          </select>
        </div>
        {periodo === 'mes' && (
          <div className="field">
            <label>Mês</label>
            <select className="select" value={mes || meses[0] || ''} onChange={(e) => setMes(e.target.value)}>
              {meses.map((m) => <option key={m} value={m}>{fmtMes(m)}{fechados.has(m) ? ' · fechado' : ''}</option>)}
            </select>
          </div>
        )}
        {periodo === 'personalizado' && (
          <>
            <div className="field"><label>De</label><input type="date" className="input" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} /></div>
            <div className="field"><label>Até</label><input type="date" className="input" value={dataFim} onChange={(e) => setDataFim(e.target.value)} /></div>
          </>
        )}
        <div className="field">
          <label><MapPin size={14} /> Região</label>
          <select className="select" value={regiao} onChange={(e) => setRegiao(e.target.value)}>
            <option value="">Todas (Brasil)</option>
            {Object.keys(REGIOES).map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div className="bi-filtros__info">
          <strong>{per.rotulo}{regiao ? ` · ${regiao}` : ''}</strong>
          <span>{dados?.ma ? `Comparando com ${per.rotuloAnterior}` : per.anterior ? `Sem dados em ${per.rotuloAnterior} para comparar` : 'Escolha um período para ver a comparação ↑ ↓'}</span>
        </div>
      </div>

      {periodo === 'mes' && mesSel && fech.disponivel && (fechamento ? (
        <div className={`card fech ${mostrandoFechamento ? 'fech--on' : ''}`}>
          <Lock size={18} />
          <div className="fech__txt">
            <strong>{fmtMes(mesSel)} fechado em {formatDateTimeBR(fechamento.created_at)} por {nomeDe(fechamento.fechado_por)}.</strong>
            <span>{mostrandoFechamento
              ? (diferencas.length ? <>Exibindo os números congelados. Desde o fechamento mudou: {diferencas.join(' · ')}.</> : 'Exibindo os números congelados — nada mudou desde o fechamento.')
              : 'Exibindo os números ATUAIS (com as correções feitas depois do fechamento).'}</span>
          </div>
          <div className="fech__acoes">
            <button className="btn btn-sm" onClick={() => setVerAtual((v) => !v)}>{mostrandoFechamento || !verAtual ? 'Ver números atuais' : 'Ver fechamento'}</button>
            {isAdmin && <button className="btn btn-ghost btn-sm" onClick={reabrirMes}><LockOpen size={14} /> Reabrir</button>}
          </div>
        </div>
      ) : mesSel < mesAtual && isAdmin && dadosVivos ? (
        <div className="card fech">
          <LockOpen size={18} />
          <div className="fech__txt">
            <strong>{fmtMes(mesSel)} ainda está aberto.</strong>
            <span>Feche o mês depois da reunião para congelar os números apresentados.</span>
          </div>
          <div className="fech__acoes"><button className="btn btn-primary btn-sm" onClick={fecharMes}><Lock size={14} /> Fechar o mês</button></div>
        </div>
      ) : null)}

      {!dados || !ctxBase ? (
        <div className="card"><EmptyState title="Sem dados para este filtro" text="Nenhuma NF faturada no período/região selecionados." /></div>
      ) : (
        <div ref={painelRef} className="bi-painel">
          {SECOES.map((s, k) => {
            const idx = apresentaveis.findIndex((x) => x.id === s.id);
            return (
            <section key={s.id} className={`bi-secao ${s.interno ? 'bi-secao--interno' : ''}`} data-secao={s.id} data-titulo={s.titulo}>
              <div className="bi-secao__tit">
                <h2><span className="bi-secao__n">{k + 1}</span>{s.titulo}{s.interno && <span className="bi-secao__tag">só para a equipe</span>}</h2>
                {idx >= 0 && (
                  <button className="btn btn-ghost btn-sm no-print" data-pdf-ignore onClick={() => setApresentando(idx)} title="Apresentar a partir deste bloco">
                    <Presentation size={14} /> Apresentar daqui
                  </button>
                )}
              </div>
              {s.render({ ...ctxBase, c, ap: false, alto: 0 })}
            </section>
            );
          })}
        </div>
      )}

      {apresentando !== null && ctxBase && (
        <Apresentacao secoes={apresentaveis} inicio={apresentando} ctx={ctxBase} periodo={per.rotulo} regiao={regiao} onClose={fecharApresentacao} />
      )}
    </div>
  );
}
