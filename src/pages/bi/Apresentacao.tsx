import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Maximize, Minimize, Moon, Sun, X } from 'lucide-react';
import { useChartTheme } from '../../hooks/useChartTheme';
import type { CtxSecao } from './Secoes';
import { SECOES } from './listaSecoes';

/**
 * Modo apresentação: um bloco do BI por tela, em tela cheia, como slides.
 * ← → (ou PageUp/PageDown, espaço) navegam; Esc sai.
 */
export function Apresentacao({ inicio, ctx, periodo, regiao, onClose }: {
  inicio: number; ctx: Omit<CtxSecao, 'ap' | 'alto' | 'c'>; periodo: string; regiao: string; onClose: () => void;
}) {
  const c = useChartTheme();
  const rootRef = useRef<HTMLDivElement>(null);
  const [i, setI] = useState(inicio);
  const [alto, setAlto] = useState(() => window.innerHeight);
  const [cheia, setCheia] = useState(false);
  const temaOriginal = useRef(document.documentElement.dataset.theme);
  const total = SECOES.length;
  const ir = (n: number) => setI(Math.max(0, Math.min(total - 1, n)));

  useEffect(() => {
    const el = rootRef.current;
    el?.requestFullscreen?.().catch(() => { /* navegador sem tela cheia: segue como sobreposição */ });
    const onFs = () => {
      const ativa = !!document.fullscreenElement;
      setCheia(ativa);
      setAlto(window.innerHeight);
    };
    const onResize = () => setAlto(window.innerHeight);
    document.addEventListener('fullscreenchange', onFs);
    window.addEventListener('resize', onResize);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const tema = temaOriginal.current;
    return () => {
      document.removeEventListener('fullscreenchange', onFs);
      window.removeEventListener('resize', onResize);
      document.body.style.overflow = overflow;
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      if (tema) document.documentElement.dataset.theme = tema;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (['ArrowRight', 'PageDown', ' ', 'Enter'].includes(e.key)) { e.preventDefault(); setI((x) => Math.min(total - 1, x + 1)); }
      else if (['ArrowLeft', 'PageUp', 'Backspace'].includes(e.key)) { e.preventDefault(); setI((x) => Math.max(0, x - 1)); }
      else if (e.key === 'Home') setI(0);
      else if (e.key === 'End') setI(total - 1);
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [total, onClose]);

  const alternarTema = () => {
    const r = document.documentElement;
    r.dataset.theme = r.dataset.theme === 'dark' ? 'light' : 'dark';
  };
  const alternarTelaCheia = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else rootRef.current?.requestFullscreen?.().catch(() => {});
  };

  const s = SECOES[i];
  return (
    <div ref={rootRef} className="bi-apres" role="dialog" aria-modal="true" aria-label="Modo apresentação">
      <header className="bi-apres__top">
        <div className="bi-apres__marca">
          <img src="/favicon.png" alt="" />
          <div>
            <strong>Painel de BI</strong>
            <span>{periodo}{regiao ? ` · ${regiao}` : ''}</span>
          </div>
        </div>
        <h2 className="bi-apres__titulo"><s.icone size={22} />{s.titulo}</h2>
        <div className="bi-apres__acoes">
          <span className="bi-apres__cont">{i + 1} / {total}</span>
          <button className="icon-btn" onClick={alternarTema} title="Alternar tema claro/escuro">{c.dark ? <Sun size={18} /> : <Moon size={18} />}</button>
          <button className="icon-btn" onClick={alternarTelaCheia} title={cheia ? 'Sair da tela cheia' : 'Tela cheia'}>{cheia ? <Minimize size={18} /> : <Maximize size={18} />}</button>
          <button className="icon-btn" onClick={onClose} title="Sair (Esc)"><X size={20} /></button>
        </div>
      </header>

      <main className="bi-apres__corpo" key={s.id}>
        {s.render({ ...ctx, c, ap: true, alto: alto - 150 })}
      </main>

      <footer className="bi-apres__rodape">
        <button className="btn btn-ghost" onClick={() => ir(i - 1)} disabled={i === 0}><ChevronLeft size={18} /> Anterior</button>
        <div className="bi-apres__dots">
          {SECOES.map((x, k) => (
            <button key={x.id} className={k === i ? 'ativo' : ''} onClick={() => ir(k)} title={x.titulo} aria-label={x.titulo} />
          ))}
        </div>
        <button className="btn btn-ghost" onClick={() => ir(i + 1)} disabled={i === total - 1}>Próximo <ChevronRight size={18} /></button>
      </footer>
    </div>
  );
}
