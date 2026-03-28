'use client';
// src/components/Login.tsx
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Sun, LogIn, User, Lock, AlertCircle, Settings } from 'lucide-react';

export default function Login() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;

    setCargando(true);
    setError('');

    try {
      const email = `${username.trim().toLowerCase()}@bitacora.solar`;
      await signInWithEmailAndPassword(auth, email, password);
    } catch {
      setError('Usuario o contraseña incorrectos');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="min-h-screen bg-grid flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center glow-gold">
            <Sun size={28} className="text-amber-400" />
          </div>
          <div className="text-center">
            <h1 className="font-display font-700 text-xl text-[var(--c-text)] tracking-widest">
              BITÁCORA SOLAR
            </h1>
            <p className="font-mono text-xs text-slate-500 mt-1">Sistema de Registro Fotovoltaico</p>
          </div>
        </div>

        {/* Formulario */}
        <div className="card-solar rounded-2xl p-6">
          <h2 className="font-display font-600 text-sm tracking-widest text-slate-400 mb-5">
            INICIAR SESIÓN
          </h2>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">

            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-xs text-slate-500">USUARIO</label>
              <div className="relative">
                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="nombre de usuario"
                  className="input-solar w-full rounded-xl pl-9 pr-4 py-2.5 text-sm"
                  autoComplete="username"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-xs text-slate-500">CONTRASEÑA</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-solar w-full rounded-xl pl-9 pr-4 py-2.5 text-sm"
                  autoComplete="current-password"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5 text-red-400 text-xs font-mono">
                <AlertCircle size={13} />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={cargando || !username.trim() || !password}
              className="btn-primary w-full py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm font-display font-600 tracking-wider mt-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cargando ? (
                <Sun size={15} className="spin-slow" />
              ) : (
                <LogIn size={15} />
              )}
              {cargando ? 'INGRESANDO...' : 'INGRESAR'}
            </button>
          </form>
        </div>

        {/* Link configuración inicial */}
        <button
          onClick={() => router.push('/setup')}
          className="mt-4 w-full flex items-center justify-center gap-2 text-xs font-mono text-slate-600 hover:text-amber-400 transition-colors py-2"
        >
          <Settings size={12} />
          Primera vez — Configurar administrador
        </button>

      </div>
    </div>
  );
}
