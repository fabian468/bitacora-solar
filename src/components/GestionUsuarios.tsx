'use client';
// src/components/GestionUsuarios.tsx
import { useState, useEffect, useCallback } from 'react';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { firebaseConfig } from '@/lib/firebase';
import { crearPerfil, obtenerUsuarios, eliminarPerfil } from '@/lib/usuarios';
import { Usuario, RolUsuario } from '@/lib/types';
import { useAuth } from '@/context/AuthContext';
import {
  Users, Plus, Trash2, Loader2, RefreshCw, AlertCircle,
  ShieldCheck, User, Lock, Tag, Check, X
} from 'lucide-react';

const ROL_ESTILOS: Record<RolUsuario, { bg: string; border: string; text: string }> = {
  admin: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-400',
  },
  operador: {
    bg: 'bg-slate-500/10',
    border: 'border-slate-500/30',
    text: 'text-slate-400',
  },
  invitado: {
    bg: 'bg-slate-500/10',
    border: 'border-slate-500/20',
    text: 'text-slate-500',
  },
};

export default function GestionUsuarios() {
  const { usuario: usuarioActual } = useAuth();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Formulario
  const [username, setUsername] = useState('');
  const [nombre, setNombre] = useState('');
  const [password, setPassword] = useState('');
  const [rol, setRol] = useState<RolUsuario>('operador');

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const data = await obtenerUsuarios();
      // Ordenar: admins primero, luego por nombre
      data.sort((a, b) => {
        if (a.rol === 'admin' && b.rol !== 'admin') return -1;
        if (a.rol !== 'admin' && b.rol === 'admin') return 1;
        return a.nombre.localeCompare(b.nombre);
      });
      setUsuarios(data);
    } catch {
      setError('Error al cargar usuarios');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const handleCrear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !nombre.trim() || !password) return;

    setGuardando(true);
    setError('');

    // Usamos una app secundaria para no cerrar la sesión del admin actual
    const appId = `crear-${Math.random().toString(36).slice(2)}`;
    const appSecundaria = initializeApp(firebaseConfig, appId);
    const authSecundaria = getAuth(appSecundaria);

    try {
      const email = `${username.trim().toLowerCase()}@bitacora.solar`;
      const cred = await createUserWithEmailAndPassword(authSecundaria, email, password);
      await crearPerfil(cred.user.uid, {
        username: username.trim().toLowerCase(),
        nombre: nombre.trim(),
        rol,
        createdAt: Date.now(),
      });
      setUsername('');
      setNombre('');
      setPassword('');
      setRol('operador');
      await cargar();
    } catch (err: unknown) {
      const msg = (err as { code?: string })?.code;
      if (msg === 'auth/email-already-in-use') {
        setError('Ese nombre de usuario ya existe');
      } else if (msg === 'auth/weak-password') {
        setError('La contraseña debe tener al menos 6 caracteres');
      } else {
        setError('Error al crear usuario');
      }
    } finally {
      await deleteApp(appSecundaria);
      setGuardando(false);
    }
  };

  const handleEliminar = async (uid: string) => {
    if (uid === usuarioActual?.uid) {
      setError('No puedes eliminar tu propia cuenta');
      setConfirmDelete(null);
      return;
    }
    try {
      await eliminarPerfil(uid);
      await cargar();
    } catch {
      setError('Error al eliminar usuario');
    }
    setConfirmDelete(null);
  };

  return (
    <div className="space-y-6">

      {/* Título */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
            <Users size={16} className="text-amber-400" />
          </div>
          <div>
            <h2 className="font-display font-700 text-base tracking-wider text-[var(--c-text)]">
              GESTIÓN DE USUARIOS
            </h2>
            <p className="text-xs text-slate-500 font-mono">{usuarios.length} usuario{usuarios.length !== 1 ? 's' : ''} registrado{usuarios.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <button onClick={cargar} className="btn-ghost p-2 rounded-xl">
          <RefreshCw size={14} className={cargando ? 'spin-slow' : ''} />
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm font-mono">
          <AlertCircle size={14} />
          {error}
          <button onClick={() => setError('')} className="ml-auto"><X size={13} /></button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── FORMULARIO CREAR ── */}
        <div className="card-solar rounded-2xl p-5">
          <h3 className="font-display font-600 text-xs tracking-widest text-slate-400 mb-4 flex items-center gap-2">
            <Plus size={13} />
            NUEVO USUARIO
          </h3>

          <form onSubmit={handleCrear} className="flex flex-col gap-3">

            <div className="flex flex-col gap-1">
              <label className="font-mono text-xs text-slate-500 flex items-center gap-1.5">
                <User size={11} /> USUARIO
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
                placeholder="nombre.usuario"
                className="input-solar rounded-xl px-3 py-2 text-sm"
                autoComplete="off"
              />
              <p className="text-xs text-slate-600 font-mono">Sin espacios ni mayúsculas</p>
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-mono text-xs text-slate-500 flex items-center gap-1.5">
                <Tag size={11} /> NOMBRE COMPLETO
              </label>
              <input
                type="text"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                placeholder="Nombre Apellido"
                className="input-solar rounded-xl px-3 py-2 text-sm"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-mono text-xs text-slate-500 flex items-center gap-1.5">
                <Lock size={11} /> CONTRASEÑA
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="input-solar rounded-xl px-3 py-2 text-sm"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-mono text-xs text-slate-500 flex items-center gap-1.5">
                <ShieldCheck size={11} /> ROL
              </label>
              <div className="flex gap-2">
                {(['operador', 'admin'] as RolUsuario[]).map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRol(r)}
                    className={`flex-1 py-2 rounded-xl text-xs font-mono border transition-all capitalize ${
                      rol === r
                        ? ROL_ESTILOS[r].bg + ' ' + ROL_ESTILOS[r].border + ' ' + ROL_ESTILOS[r].text
                        : 'border-[var(--c-border-sub)] text-slate-500 hover:text-[var(--c-text-2)]'
                    }`}
                  >
                    {r === 'admin' ? 'Administrador' : 'Operador'}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-600 font-mono">
                {rol === 'admin'
                  ? 'Acceso total: bitácora, plantas, despachos, anydesk'
                  : 'Solo puede crear y editar registros de bitácora'}
              </p>
            </div>

            <button
              type="submit"
              disabled={guardando || !username.trim() || !nombre.trim() || !password}
              className="btn-primary py-2.5 rounded-xl flex items-center justify-center gap-2 text-sm font-display font-600 tracking-wider mt-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {guardando ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {guardando ? 'CREANDO...' : 'CREAR USUARIO'}
            </button>
          </form>
        </div>

        {/* ── LISTA DE USUARIOS ── */}
        <div className="card-solar rounded-2xl p-5">
          <h3 className="font-display font-600 text-xs tracking-widest text-slate-400 mb-4 flex items-center gap-2">
            <Users size={13} />
            USUARIOS REGISTRADOS
          </h3>

          {cargando ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={20} className="animate-spin text-slate-600" />
            </div>
          ) : usuarios.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-slate-600">
              <Users size={28} />
              <p className="text-sm font-mono">Sin usuarios aún</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {usuarios.map(u => {
                const estilos = ROL_ESTILOS[u.rol];
                const esTuCuenta = u.uid === usuarioActual?.uid;
                return (
                  <div
                    key={u.uid}
                    className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3 border ${
                      esTuCuenta
                        ? 'bg-amber-500/5 border-amber-500/20'
                        : 'bg-[var(--c-inner)] border-[var(--c-border-sub)]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-7 h-7 rounded-lg ${estilos.bg} ${estilos.border} border flex items-center justify-center flex-shrink-0`}>
                        <User size={12} className={estilos.text} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-mono text-[var(--c-text)] truncate">{u.nombre}</p>
                          {esTuCuenta && (
                            <span className="text-xs font-mono text-amber-400/70">(tú)</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 font-mono truncate">@{u.username}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-xs font-mono px-2 py-1 rounded-lg ${estilos.bg} ${estilos.border} border ${estilos.text}`}>
                        {u.rol}
                      </span>

                      {confirmDelete === u.uid ? (
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleEliminar(u.uid)}
                            className="p-1.5 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25 transition-all"
                          >
                            <Check size={12} />
                          </button>
                          <button
                            onClick={() => setConfirmDelete(null)}
                            className="p-1.5 rounded-lg border border-[var(--c-border-sub)] text-slate-500 hover:text-[var(--c-text-2)] transition-all"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDelete(u.uid)}
                          disabled={esTuCuenta}
                          className="p-1.5 rounded-lg border border-transparent text-slate-600 hover:border-red-500/30 hover:text-red-400 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                          title={esTuCuenta ? 'No puedes eliminar tu propia cuenta' : 'Eliminar usuario'}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
