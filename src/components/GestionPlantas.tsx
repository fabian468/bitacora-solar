'use client';
// src/components/GestionPlantas.tsx
import { useState, useEffect, useCallback } from 'react';
import { Planta, Cliente, CLIENTES } from '@/lib/types';
import { crearPlanta, obtenerPlantas, eliminarPlanta } from '@/lib/plantas';
import { Plus, Trash2, Loader2, Sun, Building2, RefreshCw, AlertCircle } from 'lucide-react';

const COLORES: Record<Cliente, { bg: string; border: string; text: string; dot: string }> = {
  'Carbon Free': {
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
    text: 'text-green-400',
    dot: 'bg-green-400',
  },
  'Matrix': {
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/30',
    text: 'text-cyan-400',
    dot: 'bg-cyan-400',
  },
};

export default function GestionPlantas() {
  const [plantas, setPlantas] = useState<Planta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Form
  const [nombre, setNombre] = useState('');
  const [cliente, setCliente] = useState<Cliente>('Carbon Free');

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const data = await obtenerPlantas();
      setPlantas(data);
    } catch {
      setError('Error al cargar plantas');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const handleCrear = async () => {
    if (!nombre.trim()) { setError('Ingresa un nombre para la planta'); return; }
    const existe = plantas.some(p => p.nombre.toLowerCase() === nombre.trim().toLowerCase());
    if (existe) { setError('Ya existe una planta con ese nombre'); return; }

    setGuardando(true);
    setError('');
    try {
      await crearPlanta({ nombre: nombre.trim(), cliente });
      setNombre('');
      await cargar();
    } catch {
      setError('Error al guardar la planta');
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminar = async (id: string) => {
    if (confirmDelete !== id) { setConfirmDelete(id); return; }
    try {
      await eliminarPlanta(id);
      setConfirmDelete(null);
      await cargar();
    } catch {
      setError('Error al eliminar');
    }
  };

  const plantasPorCliente = (c: Cliente) => plantas.filter(p => p.cliente === c);

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* Formulario agregar planta */}
      <div className="bg-[#0D1321] border border-[#2A3F5A] rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
            <Building2 size={18} className="text-amber-400" />
          </div>
          <div>
            <h2 className="font-display font-700 text-lg text-white tracking-wide">AGREGAR PLANTA</h2>
            <p className="text-xs text-slate-500">Las plantas se usarán en todos los registros</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Selector de cliente */}
          <div className="space-y-2">
            <label className="text-xs font-mono text-slate-500 uppercase tracking-widest">
              Cliente
            </label>
            <div className="grid grid-cols-2 gap-3">
              {CLIENTES.map(c => {
                const col = COLORES[c];
                const activo = cliente === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCliente(c)}
                    className={`py-3 px-4 rounded-xl border-2 transition-all flex items-center gap-3 ${
                      activo
                        ? `${col.bg} ${col.border} ${col.text}`
                        : 'border-[#1E2A3A] text-slate-500 hover:border-slate-600'
                    }`}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${activo ? col.dot : 'bg-slate-700'}`} />
                    <span className="font-display font-600 tracking-wide text-sm">{c}</span>
                    {activo && <span className="ml-auto font-mono text-xs">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Nombre de planta */}
          <div className="space-y-1">
            <label className="text-xs font-mono text-slate-500 uppercase tracking-widest">
              Nombre de la planta
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={nombre}
                onChange={e => { setNombre(e.target.value); setError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleCrear()}
                placeholder="Ej: Planta Atacama Norte, Parque Solar Copiapó..."
                className="input-solar flex-1 rounded-xl px-4 py-2.5 text-sm"
              />
              <button
                onClick={handleCrear}
                disabled={guardando || !nombre.trim()}
                className={`px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm font-display font-700 tracking-wider transition-all flex-shrink-0 ${
                  nombre.trim() && !guardando
                    ? 'btn-primary'
                    : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                }`}
              >
                {guardando
                  ? <Loader2 size={15} className="spin-slow" />
                  : <Plus size={15} />
                }
                <span className="hidden sm:inline">AGREGAR</span>
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-2.5">
              <AlertCircle size={14} />
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Lista de plantas por cliente */}
      <div className="bg-[#0D1321] border border-[#2A3F5A] rounded-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display font-700 text-lg text-white tracking-wide flex items-center gap-2">
            <Sun size={18} className="text-amber-400" />
            PLANTAS REGISTRADAS
          </h2>
          <button onClick={cargar} className="btn-ghost p-2 rounded-lg">
            <RefreshCw size={14} className={cargando ? 'spin-slow' : ''} />
          </button>
        </div>

        {cargando && (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="spin-slow text-amber-400" />
          </div>
        )}

        {!cargando && plantas.length === 0 && (
          <div className="text-center py-12">
            <p className="text-slate-500 font-mono text-sm">No hay plantas registradas aún</p>
            <p className="text-slate-600 text-xs mt-1">Agrega la primera planta arriba</p>
          </div>
        )}

        {!cargando && plantas.length > 0 && (
          <div className="space-y-6">
            {CLIENTES.map(c => {
              const lista = plantasPorCliente(c);
              if (lista.length === 0) return null;
              const col = COLORES[c];
              return (
                <div key={c}>
                  {/* Header cliente */}
                  <div className={`flex items-center gap-2 mb-3 px-3 py-2 rounded-xl ${col.bg} border ${col.border}`}>
                    <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                    <span className={`font-display font-700 text-sm tracking-widest ${col.text}`}>{c}</span>
                    <span className={`ml-auto font-mono text-xs ${col.text} opacity-70`}>
                      {lista.length} planta{lista.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Lista */}
                  <div className="space-y-2 pl-2">
                    {lista.map(p => (
                      <div key={p.id}
                        className="flex items-center justify-between bg-[#111827] border border-[#1E2A3A] rounded-xl px-4 py-3 group hover:border-slate-600 transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-1.5 h-6 rounded-full ${col.dot} opacity-60`} />
                          <span className="text-white text-sm font-500">{p.nombre}</span>
                        </div>
                        <button
                          onClick={() => handleEliminar(p.id!)}
                          className={`p-1.5 rounded-lg transition-all text-xs flex items-center gap-1 opacity-0 group-hover:opacity-100 ${
                            confirmDelete === p.id
                              ? 'bg-red-500/20 border border-red-500/40 text-red-400 opacity-100'
                              : 'text-slate-600 hover:text-red-400 hover:bg-red-400/10'
                          }`}
                        >
                          <Trash2 size={12} />
                          {confirmDelete === p.id && <span className="font-mono">¿Eliminar?</span>}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
