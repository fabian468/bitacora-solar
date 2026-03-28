'use client';
// src/app/setup/page.tsx
// Página de configuración inicial — solo funciona si no hay usuarios en el sistema
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { crearPerfil, obtenerUsuarios } from '@/lib/usuarios';
import { Sun, ShieldCheck, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

export default function SetupPage() {
  const router = useRouter();
  const [verificando, setVerificando] = useState(true);
  const [bloqueado, setBloqueado] = useState(false);
  const [exito, setExito] = useState(false);

  const [username, setUsername] = useState('');
  const [nombre, setNombre] = useState('');
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Verificar si ya existen usuarios
    obtenerUsuarios().then(users => {
      if (users.length > 0) setBloqueado(true);
      setVerificando(false);
    }).catch(() => setVerificando(false));
  }, []);

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !nombre.trim() || !password) return;

    setCargando(true);
    setError('');

    try {
      const email = `${username.trim().toLowerCase()}@bitacora.solar`;
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await crearPerfil(cred.user.uid, {
        username: username.trim().toLowerCase(),
        nombre: nombre.trim(),
        rol: 'admin',
        createdAt: Date.now(),
      });
      setExito(true);
      setTimeout(() => router.push('/'), 2000);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === 'auth/weak-password') {
        setError('La contraseña debe tener al menos 6 caracteres');
      } else if (code === 'auth/email-already-in-use') {
        setError('Ese usuario ya existe');
      } else {
        setError('Error al crear el administrador');
      }
    } finally {
      setCargando(false);
    }
  };

  if (verificando) {
    return (
      <div className="min-h-screen bg-grid flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-slate-600" />
      </div>
    );
  }

  if (bloqueado) {
    return (
      <div className="min-h-screen bg-grid flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-4">
            <ShieldCheck size={24} className="text-red-400" />
          </div>
          <p className="font-display font-600 text-[var(--c-text)] tracking-wider">ACCESO DENEGADO</p>
          <p className="text-sm text-slate-500 font-mono mt-1">El sistema ya está configurado</p>
          <button onClick={() => router.push('/')} className="btn-primary mt-4 px-6 py-2 rounded-xl text-sm">
            Ir al inicio
          </button>
        </div>
      </div>
    );
  }

  if (exito) {
    return (
      <div className="min-h-screen bg-grid flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-green-500/10 border border-green-500/30 flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={24} className="text-green-400" />
          </div>
          <p className="font-display font-600 text-[var(--c-text)] tracking-wider">ADMINISTRADOR CREADO</p>
          <p className="text-sm text-slate-500 font-mono mt-1">Redirigiendo al login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-grid flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center glow-gold">
            <Sun size={28} className="text-amber-400" />
          </div>
          <div className="text-center">
            <h1 className="font-display font-700 text-xl text-[var(--c-text)] tracking-widest">
              CONFIGURACIÓN INICIAL
            </h1>
            <p className="font-mono text-xs text-slate-500 mt-1">Crear cuenta de administrador</p>
          </div>
        </div>

        <div className="card-solar rounded-2xl p-6">
          <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2.5 mb-5">
            <ShieldCheck size={13} className="text-amber-400 flex-shrink-0" />
            <p className="text-xs font-mono text-amber-400/80">
              Este usuario tendrá acceso total al sistema
            </p>
          </div>

          <form onSubmit={handleSetup} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-xs text-slate-500">USUARIO</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
                placeholder="nombre.usuario"
                className="input-solar rounded-xl px-3 py-2.5 text-sm"
                autoComplete="off"
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-xs text-slate-500">NOMBRE COMPLETO</label>
              <input
                type="text"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                placeholder="Nombre Apellido"
                className="input-solar rounded-xl px-3 py-2.5 text-sm"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-xs text-slate-500">CONTRASEÑA</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="input-solar rounded-xl px-3 py-2.5 text-sm"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5 text-red-400 text-xs font-mono">
                <AlertCircle size={13} />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={cargando || !username.trim() || !nombre.trim() || !password}
              className="btn-primary w-full py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm font-display font-600 tracking-wider mt-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cargando
                ? <><Loader2 size={14} className="animate-spin" /> CREANDO...</>
                : <><ShieldCheck size={14} /> CREAR ADMINISTRADOR</>
              }
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
