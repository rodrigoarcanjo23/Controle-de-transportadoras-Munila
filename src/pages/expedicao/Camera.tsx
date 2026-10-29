import { useEffect, useRef, useState } from 'react';
import { CameraOff, X } from 'lucide-react';

/**
 * Leitura contínua de código de barras pela câmera (celular, tablet ou app Android).
 * Usa o leitor nativo do navegador quando existe; senão, a biblioteca ZXing.
 */
export function CameraLeitor({ onLer, onClose }: { onLer: (texto: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [erro, setErro] = useState('');
  const ultimo = useRef({ t: '', em: 0 });
  const onLerRef = useRef(onLer);
  useEffect(() => { onLerRef.current = onLer; });

  useEffect(() => {
    let parar = () => {};
    let ativo = true;
    const entregar = (t: string) => {
      const agora = Date.now();
      if (t === ultimo.current.t && agora - ultimo.current.em < 2500) return; // evita ler o mesmo código várias vezes
      ultimo.current = { t, em: agora };
      onLerRef.current(t);
    };
    (async () => {
      try {
        type Detector = { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
        const BD = (window as unknown as { BarcodeDetector?: { new (o: { formats: string[] }): Detector; getSupportedFormats?: () => Promise<string[]> } }).BarcodeDetector;
        const formatos = BD?.getSupportedFormats ? await BD.getSupportedFormats() : [];
        if (BD && formatos.includes('code_128')) {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 } } });
          if (!ativo) { stream.getTracks().forEach((t) => t.stop()); return; }
          video.current!.srcObject = stream; await video.current!.play();
          const det = new BD({ formats: ['code_128', 'qr_code', 'ean_13', 'itf'] });
          const timer = window.setInterval(async () => {
            try { const r = await det.detect(video.current!); if (r[0]?.rawValue) entregar(r[0].rawValue); } catch { /* quadro sem código */ }
          }, 250);
          parar = () => { window.clearInterval(timer); stream.getTracks().forEach((t) => t.stop()); };
        } else {
          const { BrowserMultiFormatReader } = await import('@zxing/browser');
          const leitor = new BrowserMultiFormatReader();
          const ctrl = await leitor.decodeFromConstraints({ video: { facingMode: 'environment' } }, video.current!, (res) => { if (res) entregar(res.getText()); });
          if (!ativo) { ctrl.stop(); return; }
          parar = () => ctrl.stop();
        }
      } catch (e) {
        const m = e instanceof Error ? e.message : String(e);
        setErro(/Permission|NotAllowed/i.test(m) ? 'Permita o acesso à câmera para ler os códigos.' : /NotFound|Requested device/i.test(m) ? 'Nenhuma câmera encontrada neste aparelho.' : `Não foi possível abrir a câmera (${m}).`);
      }
    })();
    return () => { ativo = false; parar(); };
  }, []);

  return (
    <div className="exp-cam" role="dialog" aria-modal="true" aria-label="Ler código de barras">
      <div className="exp-cam__box">
        <div className="exp-cam__top">
          <strong>Aponte para o código de barras do DANFE</strong>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar câmera"><X size={22} /></button>
        </div>
        {erro ? <div className="exp-cam__erro"><CameraOff size={28} /><span>{erro}</span></div> : (
          <div className="exp-cam__video">
            <video ref={video} playsInline muted />
            <div className="exp-cam__mira" />
          </div>
        )}
        <p className="muted">A leitura é contínua: vá passando as notas. Cada NF lida aparece na lista.</p>
      </div>
    </div>
  );
}
