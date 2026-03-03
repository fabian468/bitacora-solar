'use client';
// src/components/CardRegistro.tsx
import { RegistroBitacora, PLANTAS } from '@/lib/types';
import { eliminarRegistro, actualizarRegistro } from '@/lib/bitacora';
import { Sun, Clock, AlertTriangle, FileText, Trash2, CalendarDays, Pencil, X, Check, Loader2, ClipboardCopy, ClipboardCheck } from 'lucide-react';
import { useState } from 'react';

interface Props {
  registro: RegistroBitacora;
  onEliminado: () => void;
  onActualizado: () => void;
}

function calcDuracion(r: RegistroBitacora): string | null {
  try {
    const ini = new Date(`${r.fechaInicio}T${r.horaInicio}`);
    const fin = new Date(`${r.fechaFin}T${r.horaFin}`);
    const diff = fin.getTime() - ini.getTime();
    if (diff <= 0) return null;
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  } catch { return null; }
}

function formatDate(fecha: string): string {
  const [y, m, d] = fecha.split('-');
  return `${d}/${m}/${y}`;
}

export default function CardRegistro({ registro, onEliminado, onActualizado }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [form, setForm] = useState({ ...registro });

  const dur = calcDuracion(editando ? form : registro);

  // ---- COPIAR PARA EXCEL ----
  // Columnas: Fecha | Planta | Acontecimiento | Causa | Detalle | F.Inicio | H.Inicio | F.Fin | H.Fin | Duración
  const copiarParaExcel = async () => {
    const r = registro;
    const duracion = calcDuracion(r) ?? '';
    const fechaRegistro = formatDate(r.fechaInicio);

    const columnas = [
      fechaRegistro,          // 1 - Fecha
      r.planta,               // 2 - Planta
      r.acontecimiento,       // 3 - Acontecimiento
      r.causa,                // 4 - Causa
      r.detalle,              // 5 - Detalle
      formatDate(r.fechaInicio), // 6 - Fecha Inicio
      r.horaInicio,           // 7 - Hora Inicio
      formatDate(r.fechaFin), // 8 - Fecha Fin
      r.horaFin,              // 9 - Hora Fin
      duracion,               // 10 - Duración
      r.detalle,              // 11 - Detalle (repetido según tu spec)
    ];

    // Separado por tabulaciones → al pegar en Excel cada valor va a su columna
    const texto = columnas.join('\t');

    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // fallback para navegadores sin permisos
      const el = document.createElement('textarea');
      el.value = texto;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    }
  };

  // ---- EDICIÓN ----
  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setEliminando(true);
    await eliminarRegistro(registro.id!);
    onEliminado();
  };

  const handleEdit = () => {
    setForm({ ...registro });
    setConfirmDelete(false);
    setEditando(true);
  };

  const handleCancel = () => {
    setForm({ ...registro });
    setEditando(false);
  };

  const handleSave = async () => {
    setGuardando(true);
    try {
      const { id: _id, createdAt: _c, ...datos } = form;
      await actualizarRegistro(registro.id!, datos);
      onActualizado();
      setEditando(false);
    } catch {
    } finally {
      setGuardando(false);
    }
  };

  const set = (field: string, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  // ---- MODO EDICIÓN ----
  if (editando) {
    return (
      <div className="card-registro rounded-2xl p-5" style={{ borderColor: 'rgba(6,182,212,0.4)' }}>
        <div className="flex items-center justify-between mb-4">
          <span className="font-mono text-xs text-cyan-400 uppercase tracking-widest flex items-center gap-1.5">
            <Pencil size={11} /> Editando registro
          </span>
          <div className="flex items-center gap-2">
            <button onClick={handleCancel} className="btn-ghost p-1.5 rounded-lg">
              <X size={14} />
            </button>
            <button onClick={handleSave} disabled={guardando}
              className="btn-primary px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5">
              {guardando ? <Loader2 size={12} className="spin-slow" /> : <Check size={12} />}
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-mono text-slate-500 uppercase tracking-wide">Planta</label>
            <select value={form.planta} onChange={e => set('planta', e.target.value)}
              className="input-solar w-full rounded-lg px-2 py-1.5 text-xs mt-1">
              {PLANTAS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-mono text-slate-500 uppercase tracking-wide">Acontecimiento</label>
            <textarea rows={2} value={form.acontecimiento} onChange={e => set('acontecimiento', e.target.value)}
              className="input-solar w-full rounded-lg px-2 py-1.5 text-xs mt-1 resize-none" />
          </div>
          <div>
            <label className="text-xs font-mono text-slate-500 uppercase tracking-wide">Causa</label>
            <textarea rows={2} value={form.causa} onChange={e => set('causa', e.target.value)}
              className="input-solar w-full rounded-lg px-2 py-1.5 text-xs mt-1 resize-none" />
          </div>
          <div>
            <label className="text-xs font-mono text-slate-500 uppercase tracking-wide">Detalle</label>
            <textarea rows={3} value={form.detalle} onChange={e => set('detalle', e.target.value)}
              className="input-solar w-full rounded-lg px-2 py-1.5 text-xs mt-1 resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-mono text-slate-500 uppercase tracking-wide">F. Inicio</label>
              <input type="date" value={form.fechaInicio} onChange={e => set('fechaInicio', e.target.value)}
                className="input-solar w-full rounded-lg px-2 py-1.5 text-xs mt-1" />
            </div>
            <div>
              <label className="text-xs font-mono text-slate-500 uppercase tracking-wide">H. Inicio</label>
              <input type="time" value={form.horaInicio} onChange={e => set('horaInicio', e.target.value)}
                className="input-solar w-full rounded-lg px-2 py-1.5 text-xs mt-1" />
            </div>
            <div>
              <label className="text-xs font-mono text-slate-500 uppercase tracking-wide">F. Fin</label>
              <input type="date" value={form.fechaFin} onChange={e => set('fechaFin', e.target.value)}
                className="input-solar w-full rounded-lg px-2 py-1.5 text-xs mt-1" />
            </div>
            <div>
              <label className="text-xs font-mono text-slate-500 uppercase tracking-wide">H. Fin</label>
              <input type="time" value={form.horaFin} onChange={e => set('horaFin', e.target.value)}
                className="input-solar w-full rounded-lg px-2 py-1.5 text-xs mt-1" />
            </div>
          </div>
          {dur && <p className="font-mono text-xs text-amber-400 text-right">⏱ Duración: {dur}</p>}
        </div>
      </div>
    );
  }

  // ---- MODO VISTA ----
  return (
    <div className="card-registro rounded-2xl p-5 animate-fade-up">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/25 flex items-center justify-center flex-shrink-0">
            <Sun size={15} className="text-amber-400" />
          </div>
          <div>
            <p className="font-display font-700 text-amber-400 text-sm uppercase tracking-wider leading-none">
              {registro.planta}
            </p>
            <p className="font-mono text-xs text-slate-500 mt-0.5">{formatDate(registro.fechaInicio)}</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Copiar para Excel */}
          <button
            onClick={copiarParaExcel}
            title="Copiar para Excel"
            className={`p-1.5 rounded-lg transition-all text-xs flex items-center gap-1 ${copiado
                ? 'bg-green-500/20 border border-green-500/40 text-green-400'
                : 'text-slate-600 hover:text-green-400 hover:bg-green-400/10'
              }`}
          >
            {copiado ? <ClipboardCheck size={13} /> : <ClipboardCopy size={13} />}
            {copiado && <span className="font-mono">¡Copiado!</span>}
          </button>

          {/* Editar */}
          <button onClick={handleEdit}
            className="p-1.5 rounded-lg text-slate-600 hover:text-cyan-400 hover:bg-cyan-400/10 transition-all"
            title="Editar">
            <Pencil size={13} />
          </button>

          {/* Eliminar */}
          <button onClick={handleDelete} disabled={eliminando}
            className={`p-1.5 rounded-lg transition-all text-xs flex items-center gap-1 ${confirmDelete
                ? 'bg-red-500/20 border border-red-500/40 text-red-400'
                : 'text-slate-600 hover:text-red-400 hover:bg-red-400/10'
              }`}>
            <Trash2 size={13} />
            {confirmDelete && <span className="font-mono">¿Confirmar?</span>}
          </button>
        </div>
      </div>

      <div className="mb-3">
        <div className="flex items-center gap-1.5 mb-1">
          <AlertTriangle size={12} className="text-cyan-400" />
          <span className="font-mono text-xs text-cyan-400 uppercase tracking-widest">Acontecimiento</span>
        </div>
        <p className="text-white font-500 text-sm leading-snug">{registro.acontecimiento}</p>
      </div>

      <div className="mb-3 pl-3 border-l-2 border-slate-700">
        <p className="text-xs text-slate-400 mb-0.5 font-mono uppercase tracking-wide">Causa</p>
        <p className="text-slate-300 text-sm">{registro.causa}</p>
      </div>

      {registro.detalle && (
        <div className="mb-4">
          <div className="flex items-center gap-1.5 mb-1">
            <FileText size={11} className="text-slate-500" />
            <span className="font-mono text-xs text-slate-500 uppercase tracking-widest">Detalle</span>
          </div>
          <p className="text-slate-400 text-xs leading-relaxed">{registro.detalle}</p>
        </div>
      )}

      <div className="flex items-center gap-4 pt-3 border-t border-[#1E2A3A]">
        <div className="flex items-center gap-1.5">
          <Clock size={11} className="text-slate-600" />
          <span className="font-mono text-xs text-slate-500">
            Inicio: <span className="text-slate-300">{registro.fechaInicio !== registro.fechaFin ? `${formatDate(registro.fechaInicio)} ` : ''}{registro.horaInicio}</span>
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <CalendarDays size={11} className="text-slate-600" />
          <span className="font-mono text-xs text-slate-500">
            Fin: <span className="text-slate-300">{registro.fechaInicio !== registro.fechaFin ? `${formatDate(registro.fechaFin)} ` : ''}{registro.horaFin}</span>
          </span>
        </div>
        {dur && (
          <div className="ml-auto">
            <span className="badge bg-amber-500/10 border border-amber-500/25 text-amber-400 px-2 py-0.5 rounded-full">
              ⏱ {dur}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}