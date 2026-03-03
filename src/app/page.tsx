'use client';
// src/app/page.tsx
import { useState, useEffect, useCallback } from 'react';
import { obtenerRegistros } from '@/lib/bitacora';
import { RegistroBitacora } from '@/lib/types';
import CardRegistro from '@/components/CardRegistro';
import FormularioRegistro from '@/components/FormularioRegistro';
import EscanearCuaderno from '@/components/EscanearCuaderno';
import { Sun, Plus, RefreshCw, Search, Zap, Activity, BookOpen } from 'lucide-react';

export default function Home() {
  const [registros, setRegistros] = useState<RegistroBitacora[]>([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [mostrarEscanear, setMostrarEscanear] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const data = await obtenerRegistros();
      setRegistros(data);
    } catch {
      setError('No se pudo conectar a Firebase. Verifica tu configuración en .env.local');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const filtrados = registros.filter(r =>
    !busqueda || [r.planta, r.acontecimiento, r.causa, r.detalle]
      .some(t => t?.toLowerCase().includes(busqueda.toLowerCase()))
  );

  const hoy = new Date().toISOString().split('T')[0];
  const deHoy = registros.filter(r => r.fechaInicio === hoy).length;

  return (
    <div className="min-h-screen bg-grid">

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-[#1E2A3A] bg-[#0A0E1A]/95 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">

          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center glow-gold">
              <Sun size={20} className="text-amber-400" />
            </div>
            <div>
              <h1 className="font-display font-700 text-xl text-white tracking-widest leading-none">
                BITÁCORA SOLAR
              </h1>
              <p className="font-mono text-xs text-slate-500">Sistema de Registro Fotovoltaico</p>
            </div>
          </div>

          {/* Stats */}
          <div className="hidden sm:flex items-center gap-4">
            <div className="flex items-center gap-2 bg-[#111827] border border-[#1E2A3A] rounded-xl px-4 py-2">
              <Activity size={14} className="text-green-400" />
              <span className="font-mono text-xs text-slate-400">
                Total: <span className="text-white font-500">{registros.length}</span>
              </span>
            </div>
            <div className="flex items-center gap-2 bg-[#111827] border border-[#1E2A3A] rounded-xl px-4 py-2">
              <Zap size={14} className="text-amber-400" />
              <span className="font-mono text-xs text-slate-400">
                Hoy: <span className="text-amber-400 font-500">{deHoy}</span>
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMostrarEscanear(true)}
              className="btn-ghost px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm"
            >
              <BookOpen size={16} />
              <span className="hidden sm:inline">ESCANEAR</span>
            </button>
            <button
              onClick={() => setMostrarForm(true)}
              className="btn-primary px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">NUEVO REGISTRO</span>
              <span className="sm:hidden">NUEVO</span>
            </button>
          </div>

        </div>
      </header>

      {/* Main */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">

        {/* Search y refresh */}
        <div className="flex items-center gap-3 mb-8">
          <div className="relative flex-1 max-w-md">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
            <input
              type="text"
              placeholder="Buscar registros..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              className="input-solar w-full rounded-xl pl-9 pr-4 py-2.5 text-sm"
            />
          </div>
          <button onClick={cargar} className="btn-ghost p-2.5 rounded-xl">
            <RefreshCw size={15} className={cargando ? 'spin-slow' : ''} />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-5 py-4 mb-6 text-red-400 text-sm font-mono">
            ⚠ {error}
          </div>
        )}

        {/* Loading */}
        {cargando && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center animate-pulse-gold">
              <Sun size={24} className="text-amber-400 spin-slow" />
            </div>
            <p className="font-mono text-sm text-slate-500">Cargando registros...</p>
          </div>
        )}

        {/* Empty state */}
        {!cargando && filtrados.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-[#111827] border border-[#1E2A3A] flex items-center justify-center">
              <Sun size={30} className="text-slate-700" />
            </div>
            <div className="text-center">
              <p className="font-display font-600 text-slate-500 text-lg tracking-wide">
                {busqueda ? 'Sin resultados' : 'Sin registros aún'}
              </p>
              <p className="text-slate-600 text-sm mt-1">
                {busqueda ? 'Intenta con otro término de búsqueda' : 'Crea el primer registro del día'}
              </p>
            </div>
            {!busqueda && (
              <button
                onClick={() => setMostrarForm(true)}
                className="btn-primary px-6 py-2.5 rounded-xl text-sm flex items-center gap-2 mt-2"
              >
                <Plus size={15} /> CREAR PRIMER REGISTRO
              </button>
            )}
          </div>
        )}

        {/* Grid de cards */}
        {!cargando && filtrados.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtrados.map((r, i) => (
              <div key={r.id} style={{ animationDelay: `${i * 0.05}s` }}>
                <CardRegistro registro={r} onEliminado={cargar} />
              </div>
            ))}
          </div>
        )}

      </main>

      {/* Modal nuevo registro manual */}
      {mostrarForm && (
        <FormularioRegistro
          onClose={() => setMostrarForm(false)}
          onCreado={cargar}
        />
      )}

      {/* Modal escanear cuaderno */}
      {mostrarEscanear && (
        <EscanearCuaderno
          onClose={() => setMostrarEscanear(false)}
          onGuardados={cargar}
        />
      )}

    </div>
  );
}
