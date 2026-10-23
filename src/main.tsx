import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

// Depois de uma nova publicação na Vercel, uma aba aberta pode tentar baixar
// arquivos da versão antiga (que não existem mais). Recarrega uma única vez.
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  const chave = 'munilalog:recarregou';
  if (!sessionStorage.getItem(chave)) {
    sessionStorage.setItem(chave, '1');
    window.location.reload();
  }
});
window.addEventListener('load', () => setTimeout(() => sessionStorage.removeItem('munilalog:recarregou'), 10000));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
