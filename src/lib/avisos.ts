// Pede à função da Vercel que envie os avisos aos clientes que estão na fila
// (o gatilho do banco enfileira quando a NF é coletada ou entregue). Várias
// chamadas seguidas viram uma só; o banco garante que cada aviso sai uma vez.
let timer: ReturnType<typeof setTimeout> | undefined;
export function pedirEnvioAvisos(atraso = 4000) {
  clearTimeout(timer);
  timer = setTimeout(() => { fetch('/api/avisos-clientes', { method: 'POST' }).catch(() => {}); }, atraso);
}
export const STATUS_COM_AVISO = new Set(['Entregue', 'Em Transporte']);
