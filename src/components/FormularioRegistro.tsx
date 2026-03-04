'use client';
// src/components/FormularioRegistro.tsx
import { useState } from 'react';
import { crearRegistro } from '@/lib/bitacora';
import { RegistroBitacora, Planta, Cliente, CLIENTES } from '@/lib/types';
import { X, Sparkles, Loader2, Sun, Clock } from 'lucide-react';

interface Props {
  onClose: () => void;
  onCreado: () => void;
  plantas: Planta[];
}

type CampoAI = 'acontecimiento' | 'causa' | 'detalle';

const HOY = new Date().toISOString().split('T')[0];
const AHORA = new Date().toTimeString().slice(0, 5);

const CLIENTE_ESTILOS: Record<Cliente, { activo: string; inactivo: string; dot: string }> = {
  'Carbon Free': {
    activo: 'bg-green-500/20 border-green-500/50 text-green-400',
    inactivo: 'border-[#2A3F5A] text-slate-500 hover:border-green-500/30 hover:text-green-400',
    dot: 'bg-green-400',
  },
  'Matrix': {
    activo: 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400',
    inactivo: 'border-[#2A3F5A] text-slate-500 hover:border-cyan-500/30 hover:text-cyan-400',
    dot: 'bg-cyan-400',
  },
};

export default function FormularioRegistro({ onClose, onCreado, plantas }: Props) {
  const ultimoCliente = (typeof window !== 'undefined'
    ? localStorage.getItem('ultimoCliente')
    : null) as Cliente | null;

  const ultimoEstado = (typeof window !== 'undefined'
    ? localStorage.getItem('ultimoEstado')
    : null) as 'pendiente' | 'resuelto' | null;

  const [cliente, setCliente] = useState<Cliente>(ultimoCliente ?? 'Carbon Free');
  const [form, setForm] = useState<Omit<RegistroBitacora, 'id' | 'createdAt'>>({
    planta: '',
    cliente: ultimoCliente ?? 'Carbon Free',
    acontecimiento: '',
    causa: '',
    detalle: '',
    fechaInicio: HOY,
    horaInicio: AHORA,
    fechaFin: HOY,
    horaFin: AHORA,
    estado: ultimoEstado ?? 'pendiente',
  });
  const [cargando, setCargando] = useState(false);
  const [mejorando, setMejorando] = useState<CampoAI | null>(null);
  const [error, setError] = useState('');

  // Plantas filtradas por cliente seleccionado
  const plantasFiltradas = plantas.filter(p => p.cliente === cliente);

  const set = (field: string, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const cambiarCliente = (c: Cliente) => {
    setCliente(c);
    setForm(prev => ({ ...prev, cliente: c, planta: '' }));
    localStorage.setItem('ultimoCliente', c);
  };

  const mejorarConIA = async (campo: CampoAI) => {
    const texto = form[campo];
    if (!texto.trim()) return;
    setMejorando(campo);
    try {
      const res = await fetch('/api/mejorar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto, campo }),
      });
      const data = await res.json();
      if (data.textoMejorado) set(campo, data.textoMejorado);
    } catch {
      // silencio
    } finally {
      setMejorando(null);
    }
  };

  const handleSubmit = async () => {
    if (!form.planta || !form.acontecimiento || !form.causa) {
      setError('Completa los campos requeridos: planta, acontecimiento y causa.');
      return;
    }
    setCargando(true);
    try {
      await crearRegistro(form);
      onCreado();
      onClose();
    } catch {
      setError('Error al guardar. Verifica la configuración de Firebase.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-[#0D1321] border border-[#2A3F5A] rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2A3F5A]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
              <Sun size={18} className="text-amber-400" />
            </div>
            <div>
              <h2 className="font-display font-700 text-xl text-white tracking-wide">NUEVO REGISTRO</h2>
              <p className="text-xs text-slate-500">Bitácora de Planta Fotovoltaica</p>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost p-2 rounded-lg">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">

          {/* Selector de cliente */}
          <div className="space-y-2">
            <label className="text-xs font-display uppercase tracking-widest text-slate-400">
              Cliente <span className="text-amber-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              {CLIENTES.map(c => {
                const est = CLIENTE_ESTILOS[c];
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => cambiarCliente(c)}
                    className={`py-3 px-4 rounded-xl border-2 transition-all flex items-center gap-3 font-display font-600 tracking-wide text-sm ${cliente === c ? est.activo : est.inactivo
                      }`}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${cliente === c ? est.dot : 'bg-slate-700'}`} />
                    {c}
                    {cliente === c && <span className="ml-auto text-xs">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Planta (filtrada por cliente) */}
          <div className="space-y-1">
            <label className="text-xs font-display uppercase tracking-widest text-slate-400">
              Planta <span className="text-amber-500">*</span>
            </label>
            {plantasFiltradas.length === 0 ? (
              <div className="input-solar w-full rounded-lg px-3 py-2.5 text-sm text-slate-500 flex items-center gap-2">
                <span>No hay plantas para {cliente} —</span>
                <span className="text-amber-400 text-xs">ve a la pestaña PLANTAS para agregar</span>
              </div>
            ) : (
              <select
                value={form.planta}
                onChange={e => set('planta', e.target.value)}
                className="input-solar w-full rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Selecciona la planta...</option>
                {plantasFiltradas.map(p => (
                  <option key={p.id} value={p.nombre}>{p.nombre}</option>
                ))}
              </select>
            )}
          </div>

          {/* Acontecimiento */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-display uppercase tracking-widest text-slate-400">
                Acontecimiento <span className="text-amber-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => mejorarConIA('acontecimiento')}
                disabled={!form.acontecimiento.trim() || mejorando === 'acontecimiento'}
                className="btn-ai px-2 py-1 rounded flex items-center gap-1"
              >
                {mejorando === 'acontecimiento' ? <Loader2 size={11} className="spin-slow" /> : <Sparkles size={11} />}
                {mejorando === 'acontecimiento' ? 'Mejorando...' : 'Mejorar con IA'}
              </button>
            </div>
            <textarea
              rows={2}
              value={form.acontecimiento}
              onChange={e => set('acontecimiento', e.target.value)}
              placeholder="Ej: Falla en inversor string 3 sector norte..."
              className="input-solar w-full rounded-lg px-3 py-2 text-sm resize-none"
            />
          </div>

          {/* Causa */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-display uppercase tracking-widest text-slate-400">
                Causa del acontecimiento <span className="text-amber-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => mejorarConIA('causa')}
                disabled={!form.causa.trim() || mejorando === 'causa'}
                className="btn-ai px-2 py-1 rounded flex items-center gap-1"
              >
                {mejorando === 'causa' ? <Loader2 size={11} className="spin-slow" /> : <Sparkles size={11} />}
                {mejorando === 'causa' ? 'Mejorando...' : 'Mejorar con IA'}
              </button>
            </div>
            <textarea
              rows={2}
              value={form.causa}
              onChange={e => set('causa', e.target.value)}
              placeholder="Ej: Sobrecalentamiento por ventilación bloqueada..."
              className="input-solar w-full rounded-lg px-3 py-2 text-sm resize-none"
            />
          </div>

          {/* Fechas y Horas */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-display uppercase tracking-widest text-slate-400 flex items-center gap-1">
                <Clock size={11} /> Inicio
              </label>
              <input type="date" value={form.fechaInicio} onChange={e => set('fechaInicio', e.target.value)}
                className="input-solar w-full rounded-lg px-3 py-2 text-sm" />
              <input type="time" value={form.horaInicio} onChange={e => set('horaInicio', e.target.value)}
                className="input-solar w-full rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-display uppercase tracking-widest text-slate-400 flex items-center gap-1">
                <Clock size={11} /> Fin
              </label>
              <input type="date" value={form.fechaFin} onChange={e => set('fechaFin', e.target.value)}
                className="input-solar w-full rounded-lg px-3 py-2 text-sm" />
              <input type="time" value={form.horaFin} onChange={e => set('horaFin', e.target.value)}
                className="input-solar w-full rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>

          {/* Detalle */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-display uppercase tracking-widest text-slate-400">
                Detalle adicional
              </label>
              <button
                type="button"
                onClick={() => mejorarConIA('detalle')}
                disabled={!form.detalle.trim() || mejorando === 'detalle'}
                className="btn-ai px-2 py-1 rounded flex items-center gap-1"
              >
                {mejorando === 'detalle' ? <Loader2 size={11} className="spin-slow" /> : <Sparkles size={11} />}
                {mejorando === 'detalle' ? 'Mejorando...' : 'Mejorar con IA'}
              </button>
            </div>
            <textarea
              rows={4}
              value={form.detalle}
              onChange={e => set('detalle', e.target.value)}
              placeholder="Describe acciones tomadas, observaciones, resultados..."
              className="input-solar w-full rounded-lg px-3 py-2 text-sm resize-none"
            />
          </div>

          {/* Estado */}
          <div className="space-y-2">
            <label className="text-xs font-display uppercase tracking-widest text-slate-400">Estado</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => set('estado', 'pendiente')}
                className={`flex-1 py-2 rounded-xl text-sm font-mono border transition-all ${form.estado !== 'resuelto'
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                  : 'border-[#2A3F5A] text-slate-500 hover:border-amber-500/30'
                  }`}>
                ⏳ Pendiente
              </button>
              <button type="button" onClick={() => set('estado', 'resuelto')}
                className={`flex-1 py-2 rounded-xl text-sm font-mono border transition-all ${form.estado === 'resuelto'
                  ? 'bg-green-500/20 border-green-500/50 text-green-400'
                  : 'border-[#2A3F5A] text-slate-500 hover:border-green-500/30'
                  }`}>
                ✓ Resuelto
              </button>
            </div>
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/30 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="btn-ghost flex-1 py-2.5 rounded-xl text-sm font-display font-600 uppercase tracking-wider">
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={cargando}
              className="btn-primary flex-1 py-2.5 rounded-xl text-sm flex items-center justify-center gap-2"
            >
              {cargando ? <Loader2 size={16} className="spin-slow" /> : null}
              {cargando ? 'Guardando...' : 'GUARDAR REGISTRO'}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
