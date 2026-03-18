'use client';
// src/components/FormularioRegistro.tsx
import { useState } from 'react';
import { crearRegistro } from '@/lib/bitacora';
import { RegistroBitacora, Planta, Cliente, CLIENTES, CAUSAS_CARBON_FREE, CAUSAS_MATRIX, TIPOS_ACONTECIMIENTO_SELECT } from '@/lib/types';
import { X, Sparkles, Loader2, Sun, Clock, Building2 } from 'lucide-react';

interface Props {
  onClose: () => void;
  onCreado: () => void;
  plantas: Planta[];
  registroBase?: RegistroBitacora;
}

type CampoAI = 'acontecimiento' | 'causa' | 'detalle';

const HOY = new Date().toISOString().split('T')[0];
const AHORA = new Date().toTimeString().slice(0, 5);

const CLIENTE_ESTILOS: Record<Cliente, { activo: string; inactivo: string; dot: string }> = {
  'Carbon Free': {
    activo: 'bg-green-500/20 border-green-500/50 text-green-400',
    inactivo: 'border-[var(--c-border)] text-slate-500 hover:border-green-500/30 hover:text-green-400',
    dot: 'bg-green-400',
  },
  'Matrix': {
    activo: 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400',
    inactivo: 'border-[var(--c-border)] text-slate-500 hover:border-cyan-500/30 hover:text-cyan-400',
    dot: 'bg-cyan-400',
  },
};

export default function FormularioRegistro({ onClose, onCreado, plantas, registroBase }: Props) {
  const esClonacion = !!registroBase;
  const [tipoRegistro, setTipoRegistro] = useState<'planta' | 'oficina'>(registroBase?.tipo ?? 'planta');
  const [cliente, setCliente] = useState<Cliente>(registroBase?.cliente ?? 'Carbon Free');
  const [form, setForm] = useState<Omit<RegistroBitacora, 'id' | 'createdAt'>>({
    tipo: registroBase?.tipo ?? 'planta',
    planta: registroBase?.planta ?? '',
    cliente: registroBase?.cliente ?? 'Carbon Free',
    acontecimiento: registroBase?.acontecimiento ?? '',
    causa: registroBase?.causa ?? '',
    detalle: registroBase?.detalle ?? '',
    fechaInicio: HOY,
    horaInicio: AHORA,
    fechaFin: HOY,
    horaFin: AHORA,
    estado: 'pendiente',
  });
  const [cargando, setCargando] = useState(false);
  const [mejorando, setMejorando] = useState<CampoAI | null>(null);
  const [error, setError] = useState('');

  // Plantas filtradas por cliente seleccionado
  const plantasFiltradas = plantas.filter(p => p.cliente === cliente);

  const set = (field: string, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const cambiarTipo = (t: 'planta' | 'oficina') => {
    setTipoRegistro(t);
    setForm(prev => ({
      ...prev,
      tipo: t,
      planta: t === 'oficina' ? 'Oficina' : '',
      causa: t === 'oficina' ? (prev.causa || '-') : prev.causa,
    }));
    setError('');
  };

  const cambiarCliente = (c: Cliente) => {
    setCliente(c);
    setForm(prev => ({ ...prev, cliente: c, planta: tipoRegistro === 'oficina' ? 'Oficina' : '' }));
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
    if (tipoRegistro === 'planta' && (!form.planta || !form.acontecimiento || !form.causa)) {
      setError('Completa los campos requeridos: planta, acontecimiento y causa.');
      return;
    }
    if (tipoRegistro === 'oficina' && !form.acontecimiento) {
      setError('Describe el acontecimiento de oficina.');
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
    <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="w-full max-w-2xl bg-[var(--c-card)] border border-[var(--c-border)] rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-[var(--c-border)]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
              <Sun size={18} className="text-amber-400" />
            </div>
            <div>
              <h2 className="font-display font-700 text-xl text-[var(--c-text)] tracking-wide">
                {esClonacion ? 'CLONAR REGISTRO' : 'NUEVO REGISTRO'}
              </h2>
              <p className="text-xs text-slate-500">
                {esClonacion ? `Basado en: ${registroBase!.planta || 'Oficina'}` : 'Bitácora de Planta Fotovoltaica'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost p-2 rounded-lg">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 max-h-[85vh] overflow-y-auto">

          {/* Toggle tipo de registro */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => cambiarTipo('planta')}
              className={`py-2.5 px-4 rounded-xl border-2 transition-all flex items-center gap-2.5 font-display font-600 tracking-wide text-sm ${
                tipoRegistro === 'planta'
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                  : 'border-[var(--c-border)] text-slate-500 hover:border-amber-500/30 hover:text-amber-400'
              }`}
            >
              <Sun size={15} className="flex-shrink-0" />
              Planta
              {tipoRegistro === 'planta' && <span className="ml-auto text-xs">✓</span>}
            </button>
            <button
              type="button"
              onClick={() => cambiarTipo('oficina')}
              className={`py-2.5 px-4 rounded-xl border-2 transition-all flex items-center gap-2.5 font-display font-600 tracking-wide text-sm ${
                tipoRegistro === 'oficina'
                  ? 'bg-violet-500/15 border-violet-500/40 text-violet-400'
                  : 'border-[var(--c-border)] text-slate-500 hover:border-violet-500/30 hover:text-violet-400'
              }`}
            >
              <Building2 size={15} className="flex-shrink-0" />
              Oficina
              {tipoRegistro === 'oficina' && <span className="ml-auto text-xs">✓</span>}
            </button>
          </div>

          {tipoRegistro === 'oficina' && (
            <div className="bg-violet-500/10 border border-violet-500/25 rounded-xl px-4 py-2.5 flex items-center gap-2">
              <Building2 size={13} className="text-violet-400 flex-shrink-0" />
              <p className="text-xs text-violet-300">Este registro aparecerá en el informe de entrega de turno, no en el resumen del día.</p>
            </div>
          )}

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
                    className={`py-3 px-4 rounded-xl border-2 transition-all flex items-center gap-3 font-display font-600 tracking-wide text-sm ${
                      cliente === c ? est.activo : est.inactivo
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

          {/* Planta (filtrada por cliente) — oculta en modo oficina */}
          {tipoRegistro === 'oficina' && (
            <div className="input-solar w-full rounded-lg px-3 py-2.5 text-sm text-violet-400 flex items-center gap-2 border border-violet-500/25">
              <Building2 size={13} />
              <span>Planta: <strong>Oficina</strong></span>
            </div>
          )}
          <div className={`space-y-1 ${tipoRegistro === 'oficina' ? 'hidden' : ''}`}>
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
            <label className="text-xs font-display uppercase tracking-widest text-slate-400">
              Acontecimiento <span className="text-amber-500">*</span>
            </label>
            {cliente === 'Matrix' && tipoRegistro !== 'oficina' ? (
              <select
                value={form.acontecimiento}
                onChange={e => set('acontecimiento', e.target.value)}
                className="input-solar w-full rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Selecciona el acontecimiento...</option>
                {TIPOS_ACONTECIMIENTO_SELECT.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            ) : (
              <div className="flex items-start gap-2">
                <textarea
                  rows={2}
                  value={form.acontecimiento}
                  onChange={e => set('acontecimiento', e.target.value)}
                  placeholder={tipoRegistro === 'oficina' ? 'Describe la novedad de oficina...' : 'Ej: Falla en inversor string 3 sector norte...'}
                  className="input-solar w-full rounded-lg px-3 py-2 text-sm resize-none"
                />
                <button
                  type="button"
                  onClick={() => mejorarConIA('acontecimiento')}
                  disabled={!form.acontecimiento.trim() || mejorando === 'acontecimiento'}
                  className="btn-ai px-2 py-1 rounded flex items-center gap-1 flex-shrink-0 mt-0.5"
                >
                  {mejorando === 'acontecimiento' ? <Loader2 size={11} className="spin-slow" /> : <Sparkles size={11} />}
                  {mejorando === 'acontecimiento' ? 'Mejorando...' : 'IA'}
                </button>
              </div>
            )}
          </div>

          {/* Causa */}
          <div className="space-y-1">
            <label className="text-xs font-display uppercase tracking-widest text-slate-400">
              Causa del acontecimiento {tipoRegistro !== 'oficina' && <span className="text-amber-500">*</span>}
            </label>
            {cliente === 'Carbon Free' && tipoRegistro !== 'oficina' ? (
              <select
                value={form.causa}
                onChange={e => set('causa', e.target.value)}
                className="input-solar w-full rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Selecciona la causa...</option>
                {CAUSAS_CARBON_FREE.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            ) : cliente === 'Matrix' && tipoRegistro !== 'oficina' ? (
              <select
                value={form.causa}
                onChange={e => set('causa', e.target.value)}
                className="input-solar w-full rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Selecciona la causa...</option>
                {CAUSAS_MATRIX.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            ) : (
              <div className="flex items-start gap-2">
                <textarea
                  rows={2}
                  value={form.causa}
                  onChange={e => set('causa', e.target.value)}
                  placeholder="Ej: Sobrecalentamiento por ventilación bloqueada..."
                  className="input-solar w-full rounded-lg px-3 py-2 text-sm resize-none"
                />
                <button
                  type="button"
                  onClick={() => mejorarConIA('causa')}
                  disabled={!form.causa.trim() || mejorando === 'causa'}
                  className="btn-ai px-2 py-1 rounded flex items-center gap-1 flex-shrink-0 mt-0.5"
                >
                  {mejorando === 'causa' ? <Loader2 size={11} className="spin-slow" /> : <Sparkles size={11} />}
                  {mejorando === 'causa' ? 'Mejorando...' : 'IA'}
                </button>
              </div>
            )}
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
                className={`flex-1 py-2 rounded-xl text-sm font-mono border transition-all ${
                  form.estado !== 'resuelto'
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                    : 'border-[var(--c-border)] text-slate-500 hover:border-amber-500/30'
                }`}>
                ⏳ Pendiente
              </button>
              <button type="button" onClick={() => set('estado', 'resuelto')}
                className={`flex-1 py-2 rounded-xl text-sm font-mono border transition-all ${
                  form.estado === 'resuelto'
                    ? 'bg-green-500/20 border-green-500/50 text-green-400'
                    : 'border-[var(--c-border)] text-slate-500 hover:border-green-500/30'
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
