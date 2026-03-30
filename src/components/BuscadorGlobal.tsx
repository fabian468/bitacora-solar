'use client';
// src/components/BuscadorGlobal.tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { obtenerProcedimientos } from '@/lib/procedimientos';
import { obtenerDespachos } from '@/lib/despachos';
import { RegistroBitacora, Planta, Procedimiento, Despacho } from '@/lib/types';
import { Search, X, LayoutDashboard, Building2, BookMarked, Truck, Loader2 } from 'lucide-react';

type Vista = 'bitacora' | 'informe' | 'plantas' | 'despachos' | 'anydesk' | 'alertas' | 'nocturnos' | 'usuarios' | 'fichas' | 'procedimientos';

interface Resultado {
  id: string;
  seccion: Vista;
  titulo: string;
  subtitulo?: string;
  etiqueta: string;
  color: string;
  icon: React.ReactNode;
}

interface Props {
  registros: RegistroBitacora[];
  plantas: Planta[];
  onNavegar: (vista: Vista) => void;
  onClose: () => void;
}

const SECCION_META: Record<string, { etiqueta: string; color: string; icon: React.ReactNode }> = {
  bitacora:      { etiqueta: 'Bitácora',      color: 'text-amber-400',  icon: <LayoutDashboard size={13} /> },
  plantas:       { etiqueta: 'Plantas',       color: 'text-green-400',  icon: <Building2 size={13} /> },
  procedimientos:{ etiqueta: 'Procedimientos',color: 'text-purple-400', icon: <BookMarked size={13} /> },
  despachos:     { etiqueta: 'Despachos',     color: 'text-cyan-400',   icon: <Truck size={13} /> },
};

function highlight(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-amber-400/25 text-amber-300 rounded px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export default function BuscadorGlobal({ registros, plantas, onNavegar, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [cargando, setCargando] = useState(true);
  const [procedimientos, setProcedimientos] = useState<Procedimiento[]>([]);
  const [despachos, setDespachos] = useState<Despacho[]>([]);
  const [seleccionado, setSeleccionado] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listaRef = useRef<HTMLDivElement>(null);

  // Cargar datos externos al abrir
  useEffect(() => {
    Promise.all([obtenerProcedimientos(), obtenerDespachos()])
      .then(([procs, desps]) => { setProcedimientos(procs); setDespachos(desps); })
      .finally(() => setCargando(false));
    inputRef.current?.focus();
  }, []);

  // Cerrar con Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Calcular resultados
  const resultados: Resultado[] = useCallback(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const res: Resultado[] = [];

    // Bitácora
    registros
      .filter(r => [r.planta, r.acontecimiento, r.causa, r.detalle].some(t => t?.toLowerCase().includes(q)))
      .slice(0, 5)
      .forEach(r => res.push({
        id: r.id!,
        seccion: 'bitacora',
        titulo: r.acontecimiento,
        subtitulo: `${r.planta} · ${r.fechaInicio}`,
        ...SECCION_META.bitacora,
      }));

    // Plantas
    plantas
      .filter(p => p.nombre.toLowerCase().includes(q) || p.cliente.toLowerCase().includes(q))
      .slice(0, 4)
      .forEach(p => res.push({
        id: p.id!,
        seccion: 'plantas',
        titulo: p.nombre,
        subtitulo: p.cliente,
        ...SECCION_META.plantas,
      }));

    // Procedimientos
    procedimientos
      .filter(p => p.titulo.toLowerCase().includes(q) || p.pasos?.some(s => s.texto.toLowerCase().includes(q)))
      .slice(0, 4)
      .forEach(p => res.push({
        id: p.id!,
        seccion: 'procedimientos',
        titulo: p.titulo,
        subtitulo: `${p.pasos?.length ?? 0} paso${(p.pasos?.length ?? 0) !== 1 ? 's' : ''}`,
        ...SECCION_META.procedimientos,
      }));

    // Despachos
    despachos
      .filter(d => [d.planta, d.numero, d.alimentador, d.subestacion].some(t => t?.toLowerCase().includes(q)))
      .slice(0, 4)
      .forEach(d => res.push({
        id: d.id!,
        seccion: 'despachos',
        titulo: d.planta,
        subtitulo: `N° ${d.numero}${d.alimentador ? ` · ${d.alimentador}` : ''}`,
        ...SECCION_META.despachos,
      }));

    return res;
  }, [query, registros, plantas, procedimientos, despachos])();

  // Resetear selección al cambiar query
  useEffect(() => { setSeleccionado(0); }, [query]);

  // Navegación con teclado
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSeleccionado(s => Math.min(s + 1, resultados.length - 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSeleccionado(s => Math.max(s - 1, 0));
      }
      if (e.key === 'Enter' && resultados[seleccionado]) {
        onNavegar(resultados[seleccionado].seccion);
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [resultados, seleccionado, onNavegar, onClose]);

  // Scroll al item seleccionado
  useEffect(() => {
    const el = listaRef.current?.children[seleccionado] as HTMLElement;
    el?.scrollIntoView({ block: 'nearest' });
  }, [seleccionado]);

  // Agrupar por sección
  const grupos = resultados.reduce<Record<string, Resultado[]>>((acc, r) => {
    if (!acc[r.seccion]) acc[r.seccion] = [];
    acc[r.seccion].push(r);
    return acc;
  }, {});

  const hayResultados = resultados.length > 0;
  const queryActiva = query.trim().length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-[var(--c-bg)] border border-[var(--c-border)] rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >

        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--c-border-sub)]">
          {cargando
            ? <Loader2 size={16} className="text-slate-500 animate-spin flex-shrink-0" />
            : <Search size={16} className="text-slate-500 flex-shrink-0" />
          }
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar en toda la app..."
            className="flex-1 bg-transparent text-sm text-[var(--c-text)] placeholder-slate-600 outline-none"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-slate-600 hover:text-slate-400 transition-colors">
              <X size={14} />
            </button>
          )}
          <kbd className="hidden sm:block font-mono text-xs text-slate-600 bg-[var(--c-inner)] border border-[var(--c-border-sub)] rounded px-1.5 py-0.5">
            ESC
          </kbd>
        </div>

        {/* Resultados */}
        <div ref={listaRef} className="max-h-[60vh] overflow-y-auto">

          {!queryActiva && (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <Search size={22} className="text-slate-700" />
              <p className="font-mono text-xs text-slate-600">Escribe para buscar en bitácora, plantas, procedimientos y despachos</p>
            </div>
          )}

          {queryActiva && !hayResultados && !cargando && (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <p className="font-mono text-xs text-slate-600">Sin resultados para <span className="text-slate-400">"{query}"</span></p>
            </div>
          )}

          {hayResultados && Object.entries(grupos).map(([seccion, items]) => {
            const meta = SECCION_META[seccion];
            return (
              <div key={seccion}>
                {/* Cabecera de grupo */}
                <div className="flex items-center gap-2 px-4 py-2 bg-[var(--c-inner)] border-b border-[var(--c-border-sub)]">
                  <span className={meta.color}>{meta.icon}</span>
                  <span className={`font-mono text-xs font-600 tracking-wider ${meta.color}`}>{meta.etiqueta}</span>
                  <span className="font-mono text-xs text-slate-600 ml-auto">{items.length}</span>
                </div>

                {/* Items */}
                {items.map(item => {
                  const globalIdx = resultados.indexOf(item);
                  const activo = globalIdx === seleccionado;
                  return (
                    <button
                      key={item.id}
                      onClick={() => { onNavegar(item.seccion); onClose(); }}
                      onMouseEnter={() => setSeleccionado(globalIdx)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-[var(--c-border-sub)] last:border-0 ${
                        activo ? 'bg-amber-500/8' : 'hover:bg-[var(--c-inner)]'
                      }`}
                    >
                      {/* Indicador activo */}
                      <span className={`w-0.5 h-6 rounded-full flex-shrink-0 transition-all ${activo ? 'bg-amber-400' : 'bg-transparent'}`} />

                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[var(--c-text)] truncate">
                          {highlight(item.titulo, query)}
                        </p>
                        {item.subtitulo && (
                          <p className="text-xs text-slate-500 truncate mt-0.5">
                            {highlight(item.subtitulo, query)}
                          </p>
                        )}
                      </div>

                      {activo && (
                        <kbd className="font-mono text-xs text-slate-600 bg-[var(--c-inner)] border border-[var(--c-border-sub)] rounded px-1.5 py-0.5 flex-shrink-0">
                          ↵
                        </kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        {hayResultados && (
          <div className="flex items-center gap-4 px-4 py-2.5 border-t border-[var(--c-border-sub)]">
            <span className="font-mono text-xs text-slate-600 flex items-center gap-1.5">
              <kbd className="bg-[var(--c-inner)] border border-[var(--c-border-sub)] rounded px-1 py-0.5">↑↓</kbd>
              Navegar
            </span>
            <span className="font-mono text-xs text-slate-600 flex items-center gap-1.5">
              <kbd className="bg-[var(--c-inner)] border border-[var(--c-border-sub)] rounded px-1 py-0.5">↵</kbd>
              Ir a sección
            </span>
            <span className="font-mono text-xs text-slate-600 flex items-center gap-1.5 ml-auto">
              {resultados.length} resultado{resultados.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}

      </div>
    </div>
  );
}
