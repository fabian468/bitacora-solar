'use client';
// src/components/Informe.tsx
import { useState } from 'react';
import { RegistroBitacora } from '@/lib/types';
import {
  FileText, Loader2, Calendar, AlertCircle,
  CheckCircle, Clock, ClipboardCopy, ClipboardCheck,
  ChevronDown, ChevronUp, Zap
} from 'lucide-react';

interface Props {
  registros: RegistroBitacora[];
}

function formatDate(fecha: string): string {
  const [y, m, d] = fecha.split('-');
  return `${d}/${m}/${y}`;
}

function calcDuracion(r: RegistroBitacora): string {
  try {
    const ini = new Date(`${r.fechaInicio}T${r.horaInicio}`);
    const fin = new Date(`${r.fechaFin}T${r.horaFin}`);
    const diff = fin.getTime() - ini.getTime();
    if (diff <= 0) return '-';
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  } catch { return '-'; }
}

// Renderiza markdown simple a JSX
function RenderMarkdown({ texto }: { texto: string }) {
  const lineas = texto.split('\n');
  return (
    <div className="space-y-2">
      {lineas.map((linea, i) => {
        if (linea.startsWith('# ')) {
          return (
            <h1 key={i} className="font-display font-700 text-2xl text-white tracking-wide mt-4 mb-2">
              {linea.replace('# ', '')}
            </h1>
          );
        }
        if (linea.startsWith('## ')) {
          return (
            <h2 key={i} className="font-display font-600 text-lg text-amber-400 uppercase tracking-widest mt-6 mb-2 border-b border-[#1E2A3A] pb-1">
              {linea.replace('## ', '')}
            </h2>
          );
        }
        if (linea.startsWith('**') && linea.endsWith('**')) {
          return (
            <p key={i} className="text-white font-600 text-sm">
              {linea.replace(/\*\*/g, '')}
            </p>
          );
        }
        if (linea.startsWith('- ')) {
          return (
            <div key={i} className="flex items-start gap-2 text-slate-300 text-sm">
              <span className="text-amber-400 mt-0.5 flex-shrink-0">›</span>
              <span dangerouslySetInnerHTML={{
                __html: linea.replace('- ', '').replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>')
              }} />
            </div>
          );
        }
        if (linea.trim() === '') return <div key={i} className="h-1" />;

        // Línea normal con bold inline
        return (
          <p key={i} className="text-slate-300 text-sm leading-relaxed"
            dangerouslySetInnerHTML={{
              __html: linea.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>')
            }}
          />
        );
      })}
    </div>
  );
}

export default function Informe({ registros }: Props) {
  const hoy = new Date().toISOString().split('T')[0];
  const hace7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [fechaDesde, setFechaDesde] = useState(hace7);
  const [fechaHasta, setFechaHasta] = useState(hoy);
  const [generando, setGenerando] = useState(false);
  const [informe, setInforme] = useState('');
  const [error, setError] = useState('');
  const [copiado, setCopiado] = useState(false);
  const [mostrarEventos, setMostrarEventos] = useState(false);

  // Filtrar registros por rango de fechas
  const registrosFiltrados = registros.filter(r => {
    return r.fechaInicio >= fechaDesde && r.fechaInicio <= fechaHasta;
  });

  const pendientes = registrosFiltrados.filter(r => r.estado !== 'resuelto');
  const resueltos = registrosFiltrados.filter(r => r.estado === 'resuelto');

  const generarInforme = async () => {
    if (registrosFiltrados.length === 0) {
      setError('No hay registros en el período seleccionado.');
      return;
    }
    setGenerando(true);
    setError('');
    setInforme('');

    try {
      const res = await fetch('/api/informe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registros: registrosFiltrados,
          fechaDesde: formatDate(fechaDesde),
          fechaHasta: formatDate(fechaHasta),
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error);
      setInforme(data.informe);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      setError(msg);
    } finally {
      setGenerando(false);
    }
  };

  const copiarInforme = async () => {
    try {
      await navigator.clipboard.writeText(informe);
    } catch {
      const el = document.createElement('textarea');
      el.value = informe;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  };

  // Presets de fechas
  const setRango = (dias: number) => {
    const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    setFechaDesde(desde);
    setFechaHasta(hoy);
    setInforme('');
    setError('');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Selector de fechas */}
      <div className="bg-[#0D1321] border border-[#2A3F5A] rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
            <FileText size={18} className="text-amber-400" />
          </div>
          <div>
            <h2 className="font-display font-700 text-lg text-white tracking-wide">GENERAR INFORME</h2>
            <p className="text-xs text-slate-500">Selecciona el período y la IA analizará todos los eventos</p>
          </div>
        </div>

        {/* Presets rápidos */}
        <div className="flex flex-wrap gap-2 mb-4">
          {[
            { label: 'Hoy', dias: 0 },
            { label: 'Últimos 7 días', dias: 7 },
            { label: 'Últimos 15 días', dias: 15 },
            { label: 'Último mes', dias: 30 },
          ].map(({ label, dias }) => (
            <button
              key={label}
              onClick={() => dias === 0 ? (setFechaDesde(hoy), setFechaHasta(hoy), setInforme(''), setError('')) : setRango(dias)}
              className="btn-ghost px-3 py-1.5 rounded-lg text-xs font-mono"
            >
              {label}
            </button>
          ))}
        </div>

        {/* Fechas personalizadas */}
        <div className="grid grid-cols-2 gap-4 mb-5">
          <div className="space-y-1">
            <label className="text-xs font-mono text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
              <Calendar size={11} /> Desde
            </label>
            <input
              type="date"
              value={fechaDesde}
              onChange={e => { setFechaDesde(e.target.value); setInforme(''); setError(''); }}
              className="input-solar w-full rounded-xl px-3 py-2.5 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-mono text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
              <Calendar size={11} /> Hasta
            </label>
            <input
              type="date"
              value={fechaHasta}
              onChange={e => { setFechaHasta(e.target.value); setInforme(''); setError(''); }}
              className="input-solar w-full rounded-xl px-3 py-2.5 text-sm"
            />
          </div>
        </div>

        {/* Estadísticas del período */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-[#111827] border border-[#1E2A3A] rounded-xl px-4 py-3 text-center">
            <p className="font-mono text-2xl font-600 text-white">{registrosFiltrados.length}</p>
            <p className="font-mono text-xs text-slate-500 mt-0.5">Total eventos</p>
          </div>
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-3 text-center">
            <p className="font-mono text-2xl font-600 text-amber-400">{pendientes.length}</p>
            <p className="font-mono text-xs text-slate-500 mt-0.5">⏳ Pendientes</p>
          </div>
          <div className="bg-green-500/5 border border-green-500/20 rounded-xl px-4 py-3 text-center">
            <p className="font-mono text-2xl font-600 text-green-400">{resueltos.length}</p>
            <p className="font-mono text-xs text-slate-500 mt-0.5">✓ Resueltos</p>
          </div>
        </div>

        {/* Lista previa colapsable */}
        {registrosFiltrados.length > 0 && (
          <div className="mb-5">
            <button
              onClick={() => setMostrarEventos(!mostrarEventos)}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-[#111827] border border-[#1E2A3A] rounded-xl text-xs font-mono text-slate-400 hover:text-slate-200 transition-colors"
            >
              <span>Ver {registrosFiltrados.length} evento{registrosFiltrados.length !== 1 ? 's' : ''} del período</span>
              {mostrarEventos ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>

            {mostrarEventos && (
              <div className="mt-2 space-y-2 max-h-64 overflow-y-auto pr-1">
                {registrosFiltrados.map((r, i) => (
                  <div key={r.id || i} className="flex items-start gap-3 bg-[#111827] border border-[#1E2A3A] rounded-xl px-4 py-2.5">
                    <div className="flex-shrink-0 mt-0.5">
                      {r.estado === 'resuelto'
                        ? <CheckCircle size={13} className="text-green-400" />
                        : <Clock size={13} className="text-amber-400" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-xs font-500 truncate">{r.acontecimiento}</p>
                      <p className="font-mono text-xs text-slate-500">{r.planta} · {formatDate(r.fechaInicio)} {r.horaInicio} · ⏱ {calcDuracion(r)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm flex items-center gap-2">
            <AlertCircle size={14} />
            {error}
          </div>
        )}

        <button
          onClick={generarInforme}
          disabled={generando || registrosFiltrados.length === 0}
          className={`w-full py-3 rounded-xl font-display font-700 text-sm flex items-center justify-center gap-2 tracking-wider transition-all ${
            registrosFiltrados.length > 0 && !generando
              ? 'btn-primary'
              : 'bg-slate-800 text-slate-600 cursor-not-allowed'
          }`}
        >
          {generando
            ? <><Loader2 size={16} className="spin-slow" /> GENERANDO INFORME CON IA...</>
            : <><Zap size={16} /> GENERAR INFORME CON IA</>
          }
        </button>
      </div>

      {/* Resultado del informe */}
      {informe && (
        <div className="bg-[#0D1321] border border-[#2A3F5A] rounded-2xl overflow-hidden">
          {/* Header del informe */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#1E2A3A]">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="font-mono text-xs text-green-400 uppercase tracking-widest">Informe generado</span>
            </div>
            <button
              onClick={copiarInforme}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono border transition-all ${
                copiado
                  ? 'bg-green-500/20 border-green-500/40 text-green-400'
                  : 'btn-ghost'
              }`}
            >
              {copiado ? <ClipboardCheck size={12} /> : <ClipboardCopy size={12} />}
              {copiado ? '¡Copiado!' : 'Copiar informe'}
            </button>
          </div>

          {/* Contenido */}
          <div className="px-6 py-6">
            <RenderMarkdown texto={informe} />
          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t border-[#1E2A3A] flex items-center justify-between">
            <p className="font-mono text-xs text-slate-600">
              Generado con IA · {registrosFiltrados.length} eventos · {formatDate(fechaDesde)} — {formatDate(fechaHasta)}
            </p>
            <button
              onClick={generarInforme}
              disabled={generando}
              className="btn-ghost px-3 py-1.5 rounded-lg text-xs font-mono flex items-center gap-1.5"
            >
              <Loader2 size={11} className={generando ? 'spin-slow' : ''} />
              Regenerar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
