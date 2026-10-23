import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, LogIn, CircleCheck, CircleAlert } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useTheme } from '../hooks/useTheme';

export function Login() {
  useTheme();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [ver, setVer] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  async function entrar(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErro('');
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
      if (error) throw error;
    } catch (err) {
      const msg = (err as { message?: string })?.message ?? '';
      setErro(/invalid/i.test(msg) ? 'E-mail ou senha incorretos.' : 'Não foi possível entrar. Verifique sua conexão e tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login">
      <section className="login__brand">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/favicon.png" className="brand-mark" alt="" />
          <div className="brand-name">Munila<span>Log</span></div>
        </div>
        <div className="login__pitch">
          <h2>Acompanhamento logístico do pedido à entrega.</h2>
          <p>Entregas, CTEs, devoluções e custos de frete em um só lugar.</p>
          <ul className="login__features">
            <li><CircleCheck size={18} /> Importação de XML de CTE e NF-e</li>
            <li><CircleCheck size={18} /> Conferência automática de frete</li>
            <li><CircleCheck size={18} /> SLA e indicadores em tempo real</li>
          </ul>
        </div>
        <small className="login__brand-foot" style={{ color: 'var(--nav-text)', position: 'relative', zIndex: 1 }}>© {new Date().getFullYear()} Munila</small>
      </section>

      <section className="login__form-wrap">
        <form className="login__form" onSubmit={entrar}>
          <div>
            <h1>Entrar</h1>
            <p className="muted" style={{ marginTop: 4 }}>Use o e-mail cadastrado pela sua equipe.</p>
          </div>

          {erro && (
            <div className="callout tone-red" role="alert"><CircleAlert size={18} /> {erro}</div>
          )}

          <div className="field">
            <label htmlFor="email">E-mail</label>
            <input id="email" type="email" className="input" required autoComplete="username" autoFocus
              value={email} onChange={(e) => setEmail(e.target.value)} placeholder="exemplo@munila.com.br" />
          </div>
          <div className="field">
            <label htmlFor="senha">Senha</label>
            <div className="input-icon">
              <input id="senha" type={ver ? 'text' : 'password'} className="input" required autoComplete="current-password"
                value={senha} onChange={(e) => setSenha(e.target.value)} style={{ paddingLeft: 12, paddingRight: 44 }} />
              <span className="input-suffix">
                <button type="button" className="icon-btn icon-btn--sm" onClick={() => setVer((v) => !v)} aria-label={ver ? 'Ocultar senha' : 'Mostrar senha'}>
                  {ver ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </span>
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-block" style={{ height: 44 }} disabled={loading}>
            <LogIn size={18} /> {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </section>
    </div>
  );
}
