'use client';
// src/components/CardRegistro.tsx
import { RegistroBitacora, Planta, CAUSAS_CARBON_FREE, CAUSAS_MATRIX, TIPOS_ACONTECIMIENTO_SELECT } from '@/lib/types';
import { eliminarRegistro, actualizarRegistro } from '@/lib/bitacora';
import {
  Sun, Clock, AlertTriangle, FileText, Trash2, CalendarDays,
  Pencil, X, Check, Loader2, ClipboardCopy, ClipboardCheck, Building2, Copy, UserRound
} from 'lucide-react';
import { useState } from 'react';

interface Props {
  registro: RegistroBitacora;
  plantas: Planta[];
  onEliminado: () => void;
  onActualizado: () => void;
  onClonar: (registro: RegistroBitacora) => void;
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

const MESES_CORTOS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function formatDateExcelHeader(fecha: string): string {
  const [y, m, d] = fecha.split('-');
  return `${parseInt(d)}-${MESES_CORTOS[parseInt(m) - 1]}-${y}`;
}

function formatDateExcel(fecha: string): string {
  const [y, m, d] = fecha.split('-');
  return `${parseInt(m)}/${parseInt(d)}/${y}`;
}

export default function CardRegistro({ registro, plantas, onEliminado, onActualizado, onClonar }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [form, setForm] = useState({ ...registro });

  const dur = calcDuracion(editando ? form : registro);

  // Plantas filtradas por cliente del registro — vienen de Firebase via prop
  const plantasDisponibles = (plantas ?? []).filter(p => p.cliente === form.cliente);

  const set = (field: string, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const copiarParaExcel = async () => {
    const limpiar = (s?: string) => (s ?? '').replace(/[\r\n\t]+/g, ' ').trim();
    const r = {
      ...registro,
      acontecimiento: limpiar(registro.acontecimiento),
      causa: limpiar(registro.causa),
      detalle: limpiar(registro.detalle),
    };
    let columnas: string[];

    if (r.cliente === 'Carbon Free') {
      columnas = [
        '',                                                  // Col 1: vacía
        '',                                                  // Col 2: vacía
        formatDateExcelHeader(r.fechaInicio),                // Col 3: "14-Mar-2026"
        r.estado === 'resuelto' ? 'Resuelto' : 'Pendiente', // Col 4: estado
        r.planta,                                            // Col 5: planta
        r.acontecimiento,                                    // Col 6: acontecimiento
        '',                                                  // Col 7: vacía
        '',                                                  // Col 8: vacía
        r.causa,                                             // Col 9: causa
        '',                                                  // Col 10: vacía
        '',                                                  // Col 11: vacía
        '',                                                  // Col 12: vacía
        '',                                                  // Col 13: vacía
        formatDateExcel(r.fechaInicio),                      // Col 14: fecha inicio
        r.horaInicio,                                        // Col 15: hora inicio
        '',                                                  // Col 16: intacta
        '',                                                  // Col 17: intacta
        '',                                                  // Col 18: intacta
        '',                                                  // Col 19: intacta
        '',                                                  // Col 20: intacta
        '',                                                  // Col 21: intacta
        '',                                                  // Col 22: intacta
        '',                                                  // Col 23: intacta
        '',                                                  // Col 24: intacta
        formatDateExcel(r.fechaFin),                         // Col 25: fecha fin
        r.horaFin,                                           // Col 26: hora fin
        '=(P952-O952)*24',                                   // Col 27: fórmula horas
        '=(SI(U950>T950;U950-T950;(U950+0,5)-(T950-0,5)))*24', // Col 28: fórmula diferencia
        '=(AK950)*24',                                       // Col 29: fórmula AK
        'Si',                                                // Col 30: perdió generación
        '',                                                  // Col 31
        '',                                                  // Col 32
        '',                                                  // Col 33
        '',                                                  // Col 34
        '',                                                  // Col 35
        '',                                                  // Col 36
        '=SI(N952="";"";((Y952+Z952)-(N952+O952)))',         // Col 37: fórmula
        '',                                                  // Col 38
        '=SI.ERROR(BUSCARV(E952;Datos!M$6:Datos!P980;4;0);0)', // Col 39: fórmula
        '',                                                  // Col 40
        '',                                                  // Col 41
        r.detalle ?? '',                                     // Col 42: detalle adicional
      ];
    } else if (r.cliente === 'Matrix') {
      columnas = [
        '',                                                  // Col 1: vacía
        formatDate(r.fechaInicio),                           // Col 2: fecha inicio DD/MM/YYYY
        r.estado === 'resuelto' ? 'Resuelto' : 'Pendiente', // Col 3: estado
        r.planta,                                            // Col 4: planta
        r.acontecimiento,                                    // Col 5: acontecimiento
        '',                                                  // Col 6: vacía
        '',                                                  // Col 7: vacía
        '',                                                  // Col 8: vacía
        '',                                                  // Col 9: vacía
        formatDate(r.fechaInicio),                           // Col 10: fecha inicio DD/MM/YYYY
        r.horaInicio,                                        // Col 11: hora inicio
        formatDate(r.fechaFin),                              // Col 12: fecha fin
        r.horaFin,                                           // Col 13: hora fin
        '=SI(Y(#REF!>=0;#REF!<=2);"SI";"NO")',              // Col 14: fórmula
        '=SI(Y(#REF!>=0;#REF!<=2);"SI";"NO")',              // Col 15: fórmula
        r.causa,                                             // Col 16: causa
        r.detalle ?? '',                                     // Col 17: detalle
      ];
    } else {
      columnas = [
        formatDate(r.fechaInicio),
        r.planta,
        r.acontecimiento,
        r.causa,
        r.detalle ?? '',
        formatDate(r.fechaInicio),
        r.horaInicio,
        formatDate(r.fechaFin),
        r.horaFin,
        calcDuracion(r) ?? '',
        r.estado ?? 'pendiente',
      ];
    }
    const texto = columnas.join('\t');
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      const el = document.createElement('textarea');
      el.value = texto;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  };

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
      // silencioso
    } finally {
      setGuardando(false);
    }
  };

  const estadoBadge = (estado?: string) =>
    estado === 'resuelto'
      ? 'bg-green-500/15 border-green-500/30 text-green-400'
      : 'bg-amber-500/15 border-amber-500/30 text-amber-400';

  // ── MODO EDICIÓN ──
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
            <button
              onClick={handleSave}
              disabled={guardando}
              className="btn-primary px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5"
            >
              {guardando ? <Loader2 size={12} className="spin-slow" /> : <Check size={12} />}
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-mono text-slate-500 uppercase tracking-wide">Planta</label>
            {plantasDisponibles.length > 0 ? (
              <select
                value={form.planta}
                onChange={e => set('planta', e.target.value)}
                className="input-solar w-full rounded-lg px-2 py-1.5 text-xs mt-1"
              >
                {plantasDisponibles.map(p => (
                  <option key={p.id} value={p.nombre}>{p.nombre}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={form.planta}
                onChange={e => set('planta', e.target.value)}
                className="input-solar w-full rounded-lg px-2 py-1.5 text-xs mt-1"
              />
            )}
          </div>

          <div>
            <label className="text-xs font-mono text-slate-500 uppercase tracking-wide">Acontecimiento</label>
            {form.cliente === 'Matrix' && form.tipo !== 'oficina' ? (
              <select value={form.acontecimiento}
                onChange={e => set('acontecimiento', e.target.value)}
                className="input-solar w-full rounded-lg px-2 py-1.5 text-xs mt-1">
                <option value="">Selecciona...</option>
                {TIPOS_ACONTECIMIENTO_SELECT.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            ) : (
              <textarea rows={2} value={form.acontecimiento}
                onChange={e => set('acontecimiento', e.target.value)}
                className="input-solar w-full rounded-lg px-2 py-1.5 text-xs mt-1 resize-none" />
            )}
          </div>

          <div>
            <label className="text-xs font-mono text-slate-500 uppercase tracking-wide">Causa</label>
            {form.cliente === 'Carbon Free' && form.tipo !== 'oficina' ? (
              <select value={form.causa} onChange={e => set('causa', e.target.value)}
                className="input-solar w-full rounded-lg px-2 py-1.5 text-xs mt-1">
                <option value="">Selecciona la causa...</option>
                {CAUSAS_CARBON_FREE.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            ) : form.cliente === 'Matrix' && form.tipo !== 'oficina' ? (
              <select value={form.causa} onChange={e => set('causa', e.target.value)}
                className="input-solar w-full rounded-lg px-2 py-1.5 text-xs mt-1">
                <option value="">Selecciona la causa...</option>
                {CAUSAS_MATRIX.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            ) : (
              <textarea rows={2} value={form.causa}
                onChange={e => set('causa', e.target.value)}
                className="input-solar w-full rounded-lg px-2 py-1.5 text-xs mt-1 resize-none" />
            )}
          </div>

          <div>
            <label className="text-xs font-mono text-slate-500 uppercase tracking-wide">Detalle</label>
            <textarea rows={3} value={form.detalle}
              onChange={e => set('detalle', e.target.value)}
              className="input-solar w-full rounded-lg px-2 py-1.5 text-xs mt-1 resize-none" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-mono text-slate-500 uppercase tracking-wide">F. Inicio</label>
              <input type="date" value={form.fechaInicio}
                onChange={e => set('fechaInicio', e.target.value)}
                className="input-solar w-full rounded-lg px-2 py-1.5 text-xs mt-1" />
            </div>
            <div>
              <label className="text-xs font-mono text-slate-500 uppercase tracking-wide">H. Inicio</label>
              <input type="time" value={form.horaInicio}
                onChange={e => set('horaInicio', e.target.value)}
                className="input-solar w-full rounded-lg px-2 py-1.5 text-xs mt-1" />
            </div>
            <div>
              <label className="text-xs font-mono text-slate-500 uppercase tracking-wide">F. Fin</label>
              <input type="date" value={form.fechaFin}
                onChange={e => set('fechaFin', e.target.value)}
                className="input-solar w-full rounded-lg px-2 py-1.5 text-xs mt-1" />
            </div>
            <div>
              <label className="text-xs font-mono text-slate-500 uppercase tracking-wide">H. Fin</label>
              <input type="time" value={form.horaFin}
                onChange={e => set('horaFin', e.target.value)}
                className="input-solar w-full rounded-lg px-2 py-1.5 text-xs mt-1" />
            </div>
          </div>

          <div>
            <label className="text-xs font-mono text-slate-500 uppercase tracking-wide">Estado</label>
            <div className="flex gap-2 mt-1">
              <button type="button" onClick={() => set('estado', 'pendiente')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-mono border transition-all ${
                  form.estado !== 'resuelto'
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                    : 'border-slate-700 text-slate-500 hover:border-amber-500/30'
                }`}>
                ⏳ Pendiente
              </button>
              <button type="button" onClick={() => set('estado', 'resuelto')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-mono border transition-all ${
                  form.estado === 'resuelto'
                    ? 'bg-green-500/20 border-green-500/50 text-green-400'
                    : 'border-slate-700 text-slate-500 hover:border-green-500/30'
                }`}>
                ✓ Resuelto
              </button>
            </div>
          </div>

          {dur && <p className="font-mono text-xs text-amber-400 text-right">⏱ Duración: {dur}</p>}
        </div>
      </div>
    );
  }

  const esOficina = registro.tipo === 'oficina';

  // ── MODO VISTA ──
  return (
    <div className={`card-registro rounded-2xl p-5 animate-fade-up ${esOficina ? 'border-violet-500/30' : ''}`}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
            esOficina
              ? 'bg-violet-500/15 border border-violet-500/25'
              : 'bg-amber-500/15 border border-amber-500/25'
          }`}>
            {esOficina
              ? <Building2 size={15} className="text-violet-400" />
              : <Sun size={15} className="text-amber-400" />
            }
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className={`font-display font-700 text-sm uppercase tracking-wider leading-none ${
                esOficina ? 'text-violet-400' : 'text-amber-400'
              }`}>
                {esOficina ? 'Oficina' : registro.planta}
              </p>
              {esOficina && (
                <span className="bg-violet-500/15 border border-violet-500/30 text-violet-400 font-mono text-xs px-1.5 py-0.5 rounded-md">
                  OFICINA
                </span>
              )}
            </div>
            <p className="font-mono text-xs text-slate-500 mt-0.5">{formatDate(registro.fechaInicio)}</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button onClick={copiarParaExcel} title="Copiar para Excel"
            className={`p-1.5 rounded-lg transition-all text-xs flex items-center gap-1 ${
              copiado
                ? 'bg-green-500/20 border border-green-500/40 text-green-400'
                : 'text-slate-600 hover:text-green-400 hover:bg-green-400/10'
            }`}>
            {copiado ? <ClipboardCheck size={13} /> : <ClipboardCopy size={13} />}
            {copiado && <span className="font-mono">¡Copiado!</span>}
          </button>

          <button onClick={() => onClonar(registro)} title="Clonar registro"
            className="p-1.5 rounded-lg text-slate-600 hover:text-violet-400 hover:bg-violet-400/10 transition-all">
            <Copy size={13} />
          </button>

          <button onClick={handleEdit} title="Editar"
            className="p-1.5 rounded-lg text-slate-600 hover:text-cyan-400 hover:bg-cyan-400/10 transition-all">
            <Pencil size={13} />
          </button>

          <button onClick={handleDelete} disabled={eliminando}
            className={`p-1.5 rounded-lg transition-all text-xs flex items-center gap-1 ${
              confirmDelete
                ? 'bg-red-500/20 border border-red-500/40 text-red-400'
                : 'text-slate-600 hover:text-red-400 hover:bg-red-400/10'
            }`}>
            <Trash2 size={13} />
            {confirmDelete && <span className="font-mono">¿Confirmar?</span>}
          </button>
        </div>
      </div>

      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <AlertTriangle size={12} className={esOficina ? 'text-violet-400' : 'text-cyan-400'} />
            <span className={`font-mono text-xs uppercase tracking-widest ${esOficina ? 'text-violet-400' : 'text-cyan-400'}`}>
              {esOficina ? 'Novedad de Oficina' : 'Acontecimiento'}
            </span>
          </div>
          <span className={`badge border px-2 py-0.5 rounded-full text-xs ${estadoBadge(registro.estado)}`}>
            {registro.estado === 'resuelto' ? '✓ Resuelto' : '⏳ Pendiente'}
          </span>
        </div>
        <p className="text-[var(--c-text)] font-500 text-sm leading-snug">{registro.acontecimiento}</p>
      </div>

      <div className="mb-3 pl-3 border-l-2 border-slate-700">
        <p className="text-xs text-slate-400 mb-0.5 font-mono uppercase tracking-wide">Causa</p>
        <p className="text-[var(--c-text-2)] text-sm">{registro.causa}</p>
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

      <div className="flex items-center gap-4 pt-3 border-t border-[var(--c-border-sub)]">
        <div className="flex items-center gap-1.5">
          <Clock size={11} className="text-slate-600" />
          <span className="font-mono text-xs text-slate-500">
            Inicio: <span className="text-[var(--c-text-2)]">
              {registro.fechaInicio !== registro.fechaFin ? `${formatDate(registro.fechaInicio)} ` : ''}
              {registro.horaInicio}
            </span>
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <CalendarDays size={11} className="text-slate-600" />
          <span className="font-mono text-xs text-slate-500">
            Fin: <span className="text-[var(--c-text-2)]">
              {registro.fechaInicio !== registro.fechaFin ? `${formatDate(registro.fechaFin)} ` : ''}
              {registro.horaFin}
            </span>
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

      {registro.creadoPor && (
        <div className="flex items-center gap-1.5 pt-2 mt-1 border-t border-[var(--c-border-sub)]">
          <UserRound size={11} className="text-slate-600" />
          <span className="font-mono text-xs text-slate-600">
            Registrado por: <span className="text-slate-400">{registro.creadoPor}</span>
          </span>
        </div>
      )}
    </div>
  );
}
