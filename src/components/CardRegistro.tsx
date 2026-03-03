'use client';
// src/components/CardRegistro.tsx
import { RegistroBitacora } from '@/lib/types';
import { eliminarRegistro } from '@/lib/bitacora';
import { Sun, Clock, AlertTriangle, FileText, Trash2, CalendarDays } from 'lucide-react';
import { useState } from 'react';

interface Props {
  registro: RegistroBitacora;
  onEliminado: () => void;
}

function duracion(r: RegistroBitacora) {
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

export default function CardRegistro({ registro, onEliminado }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [eliminando, setEliminando] = useState(false);

  const dur = duracion(registro);

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setEliminando(true);
    await eliminarRegistro(registro.id!);
    onEliminado();
  };

  const formatDate = (fecha: string) => {
    const [y, m, d] = fecha.split('-');
    return `${d}/${m}/${y}`;
  };

  return (
    <div className="card-registro rounded-2xl p-5 animate-fade-up">
      {/* Top row */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/25 flex items-center justify-center flex-shrink-0">
            <Sun size={15} className="text-amber-400" />
          </div>
          <div>
            <p className="font-display font-700 text-amber-400 text-sm uppercase tracking-wider leading-none">
              {registro.planta}
            </p>
            <p className="font-mono text-xs text-slate-500 mt-0.5">
              {formatDate(registro.fechaInicio)}
            </p>
          </div>
        </div>
        <button
          onClick={handleDelete}
          disabled={eliminando}
          className={`p-1.5 rounded-lg transition-all text-xs flex items-center gap-1 ${
            confirmDelete
              ? 'bg-red-500/20 border border-red-500/40 text-red-400'
              : 'text-slate-600 hover:text-red-400 hover:bg-red-400/10'
          }`}
        >
          <Trash2 size={13} />
          {confirmDelete && <span className="font-mono">¿Confirmar?</span>}
        </button>
      </div>

      {/* Acontecimiento */}
      <div className="mb-3">
        <div className="flex items-center gap-1.5 mb-1">
          <AlertTriangle size={12} className="text-cyan-400" />
          <span className="font-mono text-xs text-cyan-400 uppercase tracking-widest">Acontecimiento</span>
        </div>
        <p className="text-white font-500 text-sm leading-snug">{registro.acontecimiento}</p>
      </div>

      {/* Causa */}
      <div className="mb-3 pl-3 border-l-2 border-slate-700">
        <p className="text-xs text-slate-400 mb-0.5 font-mono uppercase tracking-wide">Causa</p>
        <p className="text-slate-300 text-sm">{registro.causa}</p>
      </div>

      {/* Detalle */}
      {registro.detalle && (
        <div className="mb-4">
          <div className="flex items-center gap-1.5 mb-1">
            <FileText size={11} className="text-slate-500" />
            <span className="font-mono text-xs text-slate-500 uppercase tracking-widest">Detalle</span>
          </div>
          <p className="text-slate-400 text-xs leading-relaxed">{registro.detalle}</p>
        </div>
      )}

      {/* Time row */}
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
