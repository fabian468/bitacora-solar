'use client';

import { useState, useRef } from 'react';
import { Moon, Zap, FileSpreadsheet, Upload, X, Download, Loader2 } from 'lucide-react';

// ── Parsers ──

const COLS_FORMATO = [4, 5, 6, 7];

function parseLDP(text: string): { headers: string[]; rows: string[][] } | null {
  const lines = text.split('\n');
  const headerIdx = lines.findIndex(l => l.trim().startsWith('Record, Date, Time, Status'));
  if (headerIdx === -1) return null;
  const headers = lines[headerIdx].split(',').map(h => h.trim().replace(/"/g, ''));
  const rows: string[][] = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = line.split(',').map(c => c.trim().replace(/"/g, ''));
    if (cols.length < 5) continue;
    rows.push(cols);
  }
  return { headers, rows };
}

function parseMeter(text: string): { headers: string[]; rows: string[][] } | null {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) return null;
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const rows = lines.slice(1).map(line =>
    line.split(',').map(c => c.trim().replace(/"/g, ''))
  ).filter(row => row.length >= 2);
  return { headers, rows };
}

// ── Helper: aplica fuente 11 a todas las celdas ──

type XLSXUtils = { decode_range: (r: string) => { s: { r: number; c: number }; e: { r: number; c: number } }; encode_cell: (a: { r: number; c: number }) => string };

function aplicarFuente11(ws: Record<string, unknown>, utils: XLSXUtils) {
  const ref = (ws as Record<string, string>)['!ref'];
  if (!ref) return;
  const decoded = utils.decode_range(ref);
  for (let R = decoded.s.r; R <= decoded.e.r; R++) {
    for (let C = decoded.s.c; C <= decoded.e.c; C++) {
      const addr = utils.encode_cell({ r: R, c: C });
      const cell = ws[addr] as { z?: string; s?: object } | undefined;
      if (!cell) continue;
      cell.s = { font: { sz: 11 }, ...(cell.z ? { numFmt: cell.z } : {}) };
    }
  }
}

// ── Lógica LDP1 ──

function reordenarColumnas(row: (string | number)[]): (string | number)[] {
  return [row[0], row[1], row[2], row[3], row[6], row[7], row[5], row[4]];
}

function filtrarPorReferencia(rows: string[][], ref1: string, ref2: string, cantidad: number): string[][] | null {
  const v1 = Math.round(parseFloat(ref1));
  const v2 = Math.round(parseFloat(ref2));
  const idx = rows.findIndex(row =>
    row.some(cell => Math.round(parseFloat(cell)) === v1) &&
    row.some(cell => Math.round(parseFloat(cell)) === v2)
  );
  if (idx === -1) return null;
  const resultado = rows.slice(idx + 1, idx + 1 + cantidad);
  return resultado.length > 0 ? resultado : null;
}

async function descargarLDP1(rows: string[][], headers: string[], archivo: File, ref1: string, ref2: string) {
  const XLSX = await import('xlsx-js-style');
  const filtradas = filtrarPorReferencia(rows, ref1, ref2, 96);
  if (!filtradas) throw new Error(`No se encontró fila con valores ${ref1} y ${ref2}.`);

  const dataFormateada = filtradas.map(row =>
    reordenarColumnas(
      row.map((cell, colIdx) =>
        COLS_FORMATO.includes(colIdx) ? parseFloat(cell) || 0 : cell
      )
    )
  );
  const headersReordenados = reordenarColumnas(headers);
  const ws = XLSX.utils.aoa_to_sheet([headersReordenados, ...dataFormateada]);

  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  for (let R = 1; R <= range.e.r; R++) {
    for (const C of COLS_FORMATO) {
      const cellAddr = XLSX.utils.encode_cell({ r: R, c: C });
      if (ws[cellAddr]) { ws[cellAddr].t = 'n'; ws[cellAddr].z = '#,##0;-#,##0'; }
    }
  }
  aplicarFuente11(ws as Record<string, unknown>, XLSX.utils);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Registros');
  XLSX.writeFile(wb, `${archivo.name.replace(/\.[^.]+$/, '')}_energia_real_ldp1.xlsx`, { cellStyles: true });
}

// ── Lógica Meter Hanqwa (2 decimales) ──

async function descargarMeterHanqwa(rows: string[][], headers: string[], archivo: File, ref1: string, ref2: string) {
  const XLSX = await import('xlsx-js-style');
  const filtradas = filtrarPorReferencia(rows, ref1, ref2, 96);
  if (!filtradas) throw new Error(`No se encontró fila con valores ${ref1} y ${ref2}.`);

  const dataFormateada = filtradas.map(row =>
    row.slice(0, 8).map((cell, i) => {
      if (i === 0) return reformatearFecha(cell);
      return parseFloat(cell) || 0;
    })
  );

  const ws = XLSX.utils.aoa_to_sheet([headers.slice(0, 8), ...dataFormateada]);

  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  for (let R = 1; R <= range.e.r; R++) {
    for (let C = 1; C <= 7; C++) {
      const cellAddr = XLSX.utils.encode_cell({ r: R, c: C });
      if (ws[cellAddr]) { ws[cellAddr].t = 'n'; ws[cellAddr].z = '#,##0.00;-#,##0.00'; }
    }
  }

  aplicarFuente11(ws as Record<string, unknown>, XLSX.utils);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Registros');
  XLSX.writeFile(wb, `${archivo.name.replace(/\.[^.]+$/, '')}_meter_hanqwa.xlsx`, { cellStyles: true });
}

// ── Lógica CEN Hanqwa (Meter + eliminar columnas C-H) ──

async function descargarCENHanqwa(rows: string[][], headers: string[], archivo: File, ref1: string, ref2: string) {
  const XLSX = await import('xlsx-js-style');
  const filtradas = filtrarPorReferencia(rows, ref1, ref2, 96);
  if (!filtradas) throw new Error(`No se encontró fila con valores ${ref1} y ${ref2}.`);

  // Solo columnas A y B (índices 0 y 1), eliminar C-H
  const dataFormateada = filtradas.map(row => {
    const fecha = reformatearFecha(row[0] || '');
    const kwh = parseFloat(row[1]) || 0;
    return [fecha, kwh, null]; // col C vacía por defecto
  });

  const ws = XLSX.utils.aoa_to_sheet([[headers[0], headers[1], 'kWh hora'], ...dataFormateada]);

  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');

  // Formato col B
  for (let R = 1; R <= range.e.r; R++) {
    const cellAddr = XLSX.utils.encode_cell({ r: R, c: 1 });
    if (ws[cellAddr]) { ws[cellAddr].t = 'n'; ws[cellAddr].z = '#,##0.00;-#,##0.00'; }
  }

  // Fórmula horaria en col C: cada 4 filas (grupos de 15min = 1h)
  // i es índice 0-based en dataFormateada; hoja: fila = i+2 (1-indexed)
  for (let i = 3; i < dataFormateada.length; i += 4) {
    const sheetRow = i + 2; // fila Excel 1-indexed
    const startRow = sheetRow - 3;
    const cellAddr = XLSX.utils.encode_cell({ r: i + 1, c: 2 });
    ws[cellAddr] = { t: 'n', f: `SUM(B${startRow}:B${sheetRow})/1000`, z: '#,##0.00;-#,##0.00' };
  }

  // Actualizar rango del sheet
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: range.e.r, c: 2 } });

  // AutoFilter en columna C
  ws['!autofilter'] = { ref: `A1:C${dataFormateada.length + 1}` };

  // Ocultar filas sin valor en C (solo mostrar filas horarias)
  const rowsProps: { hidden?: boolean }[] = [{}]; // fila header visible
  for (let i = 0; i < dataFormateada.length; i++) {
    const esHoraria = (i + 1) % 4 === 0;
    rowsProps.push(esHoraria ? {} : { hidden: true });
  }
  ws['!rows'] = rowsProps;

  aplicarFuente11(ws as Record<string, unknown>, XLSX.utils);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Registros');
  XLSX.writeFile(wb, `${archivo.name.replace(/\.[^.]+$/, '')}_cen_hanqwa.xlsx`, { cellStyles: true });
}

// ── Lógica Irradiancia Luz del Norte (Daily Report) ──

function parseIrradianciaLDN(text: string): { headers: string[]; rows: string[][] } | null {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) return null;
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const rows = lines.slice(1).map(line =>
    line.split(',').map(c => c.trim().replace(/"/g, ''))
  ).filter(row => row.length >= 2);
  return { headers, rows };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function descargarIrradianciaLDN(rows: string[][], headers: string[], archivo: File, _ref1: string, _ref2: string) {
  const XLSX = await import('xlsx-js-style');

  // TODO: definir columnas exactas según el Excel de irradiancia
  const dataFormateada = rows.map(row =>
    row.slice(0, headers.length).map((cell, i) => {
      if (i === 0) return reformatearFecha(cell);
      const n = parseFloat(cell);
      return isNaN(n) ? cell : n;
    })
  );
  const ws = XLSX.utils.aoa_to_sheet([headers, ...dataFormateada]);
  aplicarFuente11(ws as Record<string, unknown>, XLSX.utils);

  // Colorear en amarillo las filas donde col A contiene "01:00"
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  for (let R = 1; R <= range.e.r; R++) {
    const celda = ws[XLSX.utils.encode_cell({ r: R, c: 0 })] as { v?: unknown; s?: Record<string, unknown> } | undefined;
    if (typeof celda?.v === 'string' && celda.v.includes('01:15')) {
      for (let C = 0; C <= range.e.c; C++) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = ws[addr] as { s?: Record<string, unknown> } | undefined;
        if (cell) cell.s = { ...(cell.s ?? {}), fill: { fgColor: { rgb: 'FFFF00' } } };
        else ws[addr] = { t: 'z', s: { fill: { fgColor: { rgb: 'FFFF00' } } } };
      }
      // Promedio B:F en columna G de esta fila
      const excelRow = R + 1;
      const addrG = XLSX.utils.encode_cell({ r: R, c: 6 });
      ws[addrG] = { t: 'n', f: `AVERAGE(B${excelRow}:F${excelRow})`, s: { fill: { fgColor: { rgb: 'FFFF00' } }, font: { sz: 11 } } };
      // Ampliar el rango del sheet si col G queda fuera
      if (range.e.c < 6) {
        range.e.c = 6;
        ws['!ref'] = XLSX.utils.encode_range(range);
      }
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Registros');
  XLSX.writeFile(wb, `${archivo.name.replace(/\.[^.]+$/, '')}_irradiancia_ldnorte.xlsx`, { cellStyles: true });
}

// ── Lógica CEN Luz del Norte (columna D para energía) ──

async function descargarCENLuzDelNorte(rows: string[][], headers: string[], archivo: File, ref1: string, ref2: string) {
  const XLSX = await import('xlsx-js-style');
  const filtradas = filtrarPorReferencia(rows, ref1, ref2, 96);
  if (!filtradas) throw new Error(`No se encontró fila con valores ${ref1} y ${ref2}.`);

  // Col A (fecha) y col D (índice 3, kWh rec int)
  const dataFormateada = filtradas.map(row => {
    const fecha = reformatearFecha(row[0] || '');
    const kwh = parseFloat(row[3]) || 0;
    return [fecha, kwh, null];
  });

  const ws = XLSX.utils.aoa_to_sheet([[headers[0], headers[3], 'kWh hora'], ...dataFormateada]);

  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');

  // Formato col B
  for (let R = 1; R <= range.e.r; R++) {
    const cellAddr = XLSX.utils.encode_cell({ r: R, c: 1 });
    if (ws[cellAddr]) { ws[cellAddr].t = 'n'; ws[cellAddr].z = '#,##0.00;-#,##0.00'; }
  }

  // Fórmula horaria en col C cada 4 filas
  for (let i = 3; i < dataFormateada.length; i += 4) {
    const sheetRow = i + 2;
    const startRow = sheetRow - 3;
    const cellAddr = XLSX.utils.encode_cell({ r: i + 1, c: 2 });
    ws[cellAddr] = { t: 'n', f: `SUM(B${startRow}:B${sheetRow})/1000`, z: '#,##0.00;-#,##0.00' };
  }

  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: range.e.r, c: 2 } });
  ws['!autofilter'] = { ref: `A1:C${dataFormateada.length + 1}` };

  const rowsProps: { hidden?: boolean }[] = [{}];
  for (let i = 0; i < dataFormateada.length; i++) {
    rowsProps.push((i + 1) % 4 === 0 ? {} : { hidden: true });
  }
  ws['!rows'] = rowsProps;

  aplicarFuente11(ws as Record<string, unknown>, XLSX.utils);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Registros');
  XLSX.writeFile(wb, `${archivo.name.replace(/\.[^.]+$/, '')}_cen_luz_del_norte.xlsx`, { cellStyles: true });
}

// ── Lógica CEN LDP1 El Pelicano (columna E tras reordenar = original[6]) ──

async function descargarCENLDP1Pelicano(rows: string[][], headers: string[], archivo: File, ref1: string, ref2: string) {
  const XLSX = await import('xlsx-js-style');
  const filtradas = filtrarPorReferencia(rows, ref1, ref2, 96);
  if (!filtradas) throw new Error(`No se encontró fila con valores ${ref1} y ${ref2}.`);

  // Reordenar igual que LDP1 y tomar col E (índice 4 = original[6])
  const dataFormateada = filtradas.map(row => {
    const reordenada = reordenarColumnas(
      row.map((cell, colIdx) => COLS_FORMATO.includes(colIdx) ? parseFloat(cell) || 0 : cell)
    );
    const fecha = `${row[1]} ${row[2]}`; // Date + Time del LDP
    const kwh = reordenada[4] as number;  // col E tras reordenar
    return [fecha, kwh, null];
  });

  const headersReordenados = reordenarColumnas(headers);
  const ws = XLSX.utils.aoa_to_sheet([[headers[1] || 'Fecha', String(headersReordenados[4]) || 'kWh', 'kWh hora'], ...dataFormateada]);

  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');

  for (let R = 1; R <= range.e.r; R++) {
    const cellAddr = XLSX.utils.encode_cell({ r: R, c: 1 });
    if (ws[cellAddr]) { ws[cellAddr].t = 'n'; ws[cellAddr].z = '#,##0.00;-#,##0.00'; }
  }

  for (let i = 3; i < dataFormateada.length; i += 4) {
    const sheetRow = i + 2;
    const startRow = sheetRow - 3;
    const cellAddr = XLSX.utils.encode_cell({ r: i + 1, c: 2 });
    ws[cellAddr] = { t: 'n', f: `SUM(B${startRow}:B${sheetRow})/1000`, z: '#,##0.00;-#,##0.00' };
  }

  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: range.e.r, c: 2 } });
  ws['!autofilter'] = { ref: `A1:C${dataFormateada.length + 1}` };

  const rowsProps: { hidden?: boolean }[] = [{}];
  for (let i = 0; i < dataFormateada.length; i++) {
    rowsProps.push((i + 1) % 4 === 0 ? {} : { hidden: true });
  }
  ws['!rows'] = rowsProps;

  aplicarFuente11(ws as Record<string, unknown>, XLSX.utils);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Registros');
  XLSX.writeFile(wb, `${archivo.name.replace(/\.[^.]+$/, '')}_cen_ldp1_pelicano.xlsx`, { cellStyles: true });
}

// ── Lógica LDP2 ──

async function descargarLDP2(rows: string[][], headers: string[], archivo: File, ref1: string, ref2: string) {
  const XLSX = await import('xlsx-js-style');
  const filtradas = filtrarPorReferencia(rows, ref1, ref2, 96);
  if (!filtradas) throw new Error(`No se encontró fila con valores ${ref1} y ${ref2}.`);

  // Columnas A-G (índices 0-6), suprimir H en adelante
  const dataFormateada = filtradas.map(row =>
    row.slice(0, 7).map((cell, i) =>
      i >= 4 ? parseFloat(cell) || 0 : cell
    )
  );

  const ws = XLSX.utils.aoa_to_sheet([headers.slice(0, 7), ...dataFormateada]);

  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  for (let R = 1; R <= range.e.r; R++) {
    for (let C = 4; C <= 6; C++) {
      const cellAddr = XLSX.utils.encode_cell({ r: R, c: C });
      if (ws[cellAddr]) { ws[cellAddr].t = 'n'; ws[cellAddr].z = '#,##0;-#,##0'; }
    }
  }

  aplicarFuente11(ws as Record<string, unknown>, XLSX.utils);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Registros');
  XLSX.writeFile(wb, `${archivo.name.replace(/\.[^.]+$/, '')}_energia_real_ldp2.xlsx`, { cellStyles: true });
}

// ── Lógica Meter ──

function reformatearFecha(dateStr: string): string {
  // "3/18/2026 3:45:00.000 AM" → "3/18/2026 03:45" (24h)
  const partes = dateStr.trim().split(' ');
  if (partes.length < 2) return dateStr;
  const fecha = partes[0];
  const [hStr, mStr] = partes[1].split(':');
  const meridiem = partes[2]?.toUpperCase();
  let h = parseInt(hStr, 10);
  const m = mStr?.padStart(2, '0') ?? '00';
  if (meridiem === 'AM') {
    if (h === 12) h = 0;
  } else if (meridiem === 'PM') {
    if (h !== 12) h += 12;
  }
  return `${fecha} ${String(h).padStart(2, '0')}:${m}`;
}

async function descargarMeter(rows: string[][], headers: string[], archivo: File, ref1: string, ref2: string) {
  const XLSX = await import('xlsx-js-style');

  // Filtrar 144 filas desde la siguiente a la referencia (3:15 → 15:00 día siguiente)
  const filtradas = filtrarPorReferencia(rows, ref1, ref2, 96);
  if (!filtradas) throw new Error(`No se encontró fila con valores ${ref1} y ${ref2}.`);

  // Columnas A-H (índices 0-7), suprimir I-M (8-12)
  const dataFormateada = filtradas.map(row =>
    row.slice(0, 8).map((cell, i) => {
      if (i === 0) return reformatearFecha(cell);
      return parseFloat(cell) || 0;
    })
  );

  const ws = XLSX.utils.aoa_to_sheet([headers.slice(0, 8), ...dataFormateada]);

  // Aplicar formato número a columnas B-H (índices 1-7)
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  for (let R = 1; R <= range.e.r; R++) {
    for (let C = 1; C <= 7; C++) {
      const cellAddr = XLSX.utils.encode_cell({ r: R, c: C });
      if (ws[cellAddr]) { ws[cellAddr].t = 'n'; ws[cellAddr].z = '#,##0;-#,##0'; }
    }
  }

  aplicarFuente11(ws as Record<string, unknown>, XLSX.utils);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Registros');
  XLSX.writeFile(wb, `${archivo.name.replace(/\.[^.]+$/, '')}_meter_formateado.xlsx`, { cellStyles: true });
}

// ── Lógica Carbon Free (sin filtrado por referencia) ──

async function descargarMeterCarbonFree(rows: string[][], headers: string[], archivo: File) {
  const XLSX = await import('xlsx-js-style');

  const dataFormateada = rows.map(row =>
    row.slice(0, 8).map((cell, i) => {
      if (i === 0) return reformatearFecha(cell);
      return parseFloat(cell) || 0;
    })
  );

  const ws = XLSX.utils.aoa_to_sheet([headers.slice(0, 8), ...dataFormateada]);

  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  for (let R = 1; R <= range.e.r; R++) {
    for (let C = 1; C <= 7; C++) {
      const cellAddr = XLSX.utils.encode_cell({ r: R, c: C });
      if (ws[cellAddr]) { ws[cellAddr].t = 'n'; ws[cellAddr].z = '#,##0.00;-#,##0.00'; }
    }
  }

  aplicarFuente11(ws as Record<string, unknown>, XLSX.utils);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Registros');
  XLSX.writeFile(wb, `${archivo.name.replace(/\.[^.]+$/, '')}_meter.xlsx`, { cellStyles: true });
}

async function descargarCENCarbonFree(rows: string[][], headers: string[], archivo: File) {
  const XLSX = await import('xlsx-js-style');

  const dataFormateada = rows.map(row => {
    const fecha = reformatearFecha(row[0] || '');
    const kwh = parseFloat(row[1]) || 0;
    return [fecha, kwh, null];
  });

  const ws = XLSX.utils.aoa_to_sheet([[headers[0], headers[1], 'kWh hora'], ...dataFormateada]);

  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');

  for (let R = 1; R <= range.e.r; R++) {
    const cellAddr = XLSX.utils.encode_cell({ r: R, c: 1 });
    if (ws[cellAddr]) { ws[cellAddr].t = 'n'; ws[cellAddr].z = '#,##0.00;-#,##0.00'; }
  }

  for (let i = 3; i < dataFormateada.length; i += 4) {
    const sheetRow = i + 2;
    const startRow = sheetRow - 3;
    const cellAddr = XLSX.utils.encode_cell({ r: i + 1, c: 2 });
    ws[cellAddr] = { t: 'n', f: `SUM(B${startRow}:B${sheetRow})/1000`, z: '#,##0.00;-#,##0.00' };
  }

  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: range.e.r, c: 2 } });
  ws['!autofilter'] = { ref: `A1:C${dataFormateada.length + 1}` };

  const rowsProps: { hidden?: boolean }[] = [{}];
  for (let i = 0; i < dataFormateada.length; i++) {
    rowsProps.push((i + 1) % 4 === 0 ? {} : { hidden: true });
  }
  ws['!rows'] = rowsProps;

  aplicarFuente11(ws as Record<string, unknown>, XLSX.utils);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Registros');
  XLSX.writeFile(wb, `${archivo.name.replace(/\.[^.]+$/, '')}_cen.xlsx`, { cellStyles: true });
}

// ── Card multi-archivo (Carbon Free) ──

interface ArchivoItem {
  file: File;
  datos: { headers: string[]; rows: string[][] } | null;
  error: string;
}

interface CardInformeMultiProps {
  titulo: string;
  subtitulo: string;
  labelBtn: string;
  labelBtn2: string;
  parser: (text: string) => { headers: string[]; rows: string[][] } | null;
  sinReferencias?: boolean;
  onDescargar: (rows: string[][], headers: string[], archivo: File, ref1: string, ref2: string) => Promise<void>;
  onDescargar2: (rows: string[][], headers: string[], archivo: File, ref1: string, ref2: string) => Promise<void>;
  onDescargarSinRef?: (rows: string[][], headers: string[], archivo: File) => Promise<void>;
  onDescargar2SinRef?: (rows: string[][], headers: string[], archivo: File) => Promise<void>;
}

function CardInformeMulti({ titulo, subtitulo, labelBtn, labelBtn2, parser, sinReferencias, onDescargar, onDescargar2, onDescargarSinRef, onDescargar2SinRef }: CardInformeMultiProps) {
  const [archivos, setArchivos] = useState<ArchivoItem[]>([]);
  const [ref1, setRef1] = useState('');
  const [ref2, setRef2] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [errorGlobal, setErrorGlobal] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const agregarArchivos = async (nuevos: FileList | null) => {
    if (!nuevos) return;
    const items: ArchivoItem[] = [];
    for (const file of Array.from(nuevos)) {
      try {
        const text = await file.text();
        const datos = parser(text);
        items.push({ file, datos, error: datos ? '' : 'No se pudo leer la sección de registros.' });
      } catch {
        items.push({ file, datos: null, error: 'Error al leer el archivo.' });
      }
    }
    setArchivos(prev => [...prev, ...items]);
    if (fileRef.current) fileRef.current.value = '';
  };

  const quitarArchivo = (idx: number) => setArchivos(prev => prev.filter((_, i) => i !== idx));

  const ejecutarTodos = async (
    fn: (rows: string[][], headers: string[], archivo: File, ref1: string, ref2: string) => Promise<void>,
    fnSinRef?: (rows: string[][], headers: string[], archivo: File) => Promise<void>
  ) => {
    setErrorGlobal('');
    setProcesando(true);
    const errores: string[] = [];
    for (const item of archivos) {
      if (!item.datos) { errores.push(`${item.file.name}: sin datos.`); continue; }
      try {
        if (sinReferencias && fnSinRef) await fnSinRef(item.datos.rows, item.datos.headers, item.file);
        else await fn(item.datos.rows, item.datos.headers, item.file, ref1, ref2);
      } catch (e: unknown) { errores.push(`${item.file.name}: ${e instanceof Error ? e.message : 'Error.'}`); }
    }
    if (errores.length) setErrorGlobal(errores.join('\n'));
    setProcesando(false);
  };

  const faltanRefs = !sinReferencias && (!ref1 || !ref2);
  const hayArchivosValidos = archivos.some(a => a.datos !== null);

  return (
    <div className="card-solar rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
          <Zap size={13} className="text-amber-400" />
        </div>
        <div>
          <h3 className="font-display font-700 text-xs tracking-wider text-[var(--c-text)]">{titulo}</h3>
          <p className="font-mono text-[10px] text-slate-500">{subtitulo}</p>
        </div>
      </div>

      {/* Zona de carga */}
      <div className="flex gap-2 mb-3">
        <div
          onClick={() => fileRef.current?.click()}
          className="flex-1 flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border-2 border-dashed border-[var(--c-border-sub)] hover:border-amber-500/40 cursor-pointer transition-all"
        >
          <div className="flex items-center gap-2">
            <FileSpreadsheet size={14} className="text-slate-500 flex-shrink-0" />
            <p className="font-mono text-xs text-slate-400">Agregar archivos</p>
          </div>
          <Upload size={13} className="text-slate-600 flex-shrink-0" />
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" multiple className="hidden"
            onChange={e => agregarArchivos(e.target.files)} />
        </div>
        {archivos.length > 0 && (
          <button
            onClick={() => { setArchivos([]); setErrorGlobal(''); }}
            className="px-3 py-2 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors font-mono text-xs flex items-center gap-1.5 flex-shrink-0"
          >
            <X size={12} />
            Limpiar
          </button>
        )}
      </div>

      {/* Lista de archivos */}
      {archivos.length > 0 && (
        <div className="flex flex-col gap-1.5 mb-3 max-h-40 overflow-y-auto pr-1">
          {archivos.map((item, idx) => (
            <div key={idx} className={`flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg border ${item.datos ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
              <div className="flex items-center gap-2 min-w-0">
                <FileSpreadsheet size={12} className={item.datos ? 'text-green-400 flex-shrink-0' : 'text-red-400 flex-shrink-0'} />
                <p className={`font-mono text-[10px] truncate ${item.datos ? 'text-green-400' : 'text-red-400'}`}>{item.file.name}</p>
              </div>
              <button onClick={() => quitarArchivo(idx)} className="p-0.5 rounded hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-colors flex-shrink-0">
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Referencias */}
      {!sinReferencias && (
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="flex flex-col gap-1">
            <label className="font-mono text-[10px] text-slate-500 uppercase tracking-wider">Ref. 1</label>
            <input type="number" value={ref1} onChange={e => setRef1(e.target.value)}
              placeholder="0" className="input-solar rounded-lg px-3 py-2 text-xs font-mono" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="font-mono text-[10px] text-slate-500 uppercase tracking-wider">Ref. 2</label>
            <input type="number" value={ref2} onChange={e => setRef2(e.target.value)}
              placeholder="0" className="input-solar rounded-lg px-3 py-2 text-xs font-mono" />
          </div>
        </div>
      )}

      {/* Error global */}
      {errorGlobal && (
        <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-3">
          <span className="text-red-400 text-sm leading-none">⚠</span>
          <p className="font-mono text-[10px] text-red-400 whitespace-pre-line">{errorGlobal}</p>
        </div>
      )}

      {/* Aviso refs faltantes */}
      {hayArchivosValidos && faltanRefs && (
        <p className="font-mono text-[10px] text-amber-400 mb-2">
          Ingresa los dos valores de referencia para descargar.
        </p>
      )}

      {/* Botones */}
      {hayArchivosValidos && (
        <div className="flex flex-col gap-2">
          <button
            onClick={() => ejecutarTodos(onDescargar, onDescargarSinRef)}
            disabled={procesando || faltanRefs}
            className="btn-primary w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-mono disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {procesando ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
            {labelBtn} {archivos.filter(a => a.datos).length > 1 ? `(${archivos.filter(a => a.datos).length} archivos)` : ''}
          </button>
          <button
            onClick={() => ejecutarTodos(onDescargar2, onDescargar2SinRef)}
            disabled={procesando || faltanRefs}
            className="btn-ghost w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-mono border border-[var(--c-border-sub)] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {procesando ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
            {labelBtn2} {archivos.filter(a => a.datos).length > 1 ? `(${archivos.filter(a => a.datos).length} archivos)` : ''}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Card reutilizable ──

interface CardInformeProps {
  titulo: string;
  subtitulo: string;
  labelBtn: string;
  parser: (text: string) => { headers: string[]; rows: string[][] } | null;
  sinReferencias?: boolean;
  onDescargar: (rows: string[][], headers: string[], archivo: File, ref1: string, ref2: string) => Promise<void>;
  labelBtn2?: string;
  onDescargar2?: (rows: string[][], headers: string[], archivo: File, ref1: string, ref2: string) => Promise<void>;
}

function CardInforme({ titulo, subtitulo, labelBtn, parser, sinReferencias, onDescargar, labelBtn2, onDescargar2 }: CardInformeProps) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [datos, setDatos] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [error, setError] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [ref1, setRef1] = useState('');
  const [ref2, setRef2] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleArchivo = async (file: File | null) => {
    setArchivo(file);
    setDatos(null);
    setError('');
    if (!file) return;
    setProcesando(true);
    try {
      const text = await file.text();
      const resultado = parser(text);
      if (!resultado) setError('No se pudo leer la sección de registros.');
      else setDatos(resultado);
    } catch {
      setError('Error al leer el archivo.');
    } finally {
      setProcesando(false);
    }
  };

  const handleDescargar = async () => {
    if (!datos || !archivo) return;
    setError('');
    setProcesando(true);
    try {
      await onDescargar(datos.rows, datos.headers, archivo, ref1, ref2);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al generar el archivo.');
    } finally {
      setProcesando(false);
    }
  };

  const faltanRefs = !sinReferencias && (!ref1 || !ref2);

  return (
    <div className="card-solar rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
          <Zap size={13} className="text-amber-400" />
        </div>
        <div>
          <h3 className="font-display font-700 text-xs tracking-wider text-[var(--c-text)]">{titulo}</h3>
          <p className="font-mono text-[10px] text-slate-500">{subtitulo}</p>
        </div>
      </div>

      {/* Input archivo */}
      <div
        onClick={() => fileRef.current?.click()}
        className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border-2 cursor-pointer transition-all mb-3
          ${archivo ? 'bg-green-500/10 border-green-500/30' : 'border-dashed border-[var(--c-border-sub)] hover:border-amber-500/40'}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <FileSpreadsheet size={14} className={archivo ? 'text-green-400 flex-shrink-0' : 'text-slate-500 flex-shrink-0'} />
          <p className={`font-mono text-xs truncate ${archivo ? 'text-green-400' : 'text-slate-400'}`}>
            {archivo ? archivo.name : 'Seleccionar archivo'}
          </p>
        </div>
        {archivo ? (
          <button
            onClick={e => { e.stopPropagation(); handleArchivo(null); if (fileRef.current) fileRef.current.value = ''; }}
            className="p-1 rounded hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-colors flex-shrink-0"
          >
            <X size={12} />
          </button>
        ) : (
          <Upload size={13} className="text-slate-600 flex-shrink-0" />
        )}
        <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
          onChange={e => handleArchivo(e.target.files?.[0] ?? null)} />
      </div>

      {/* Referencias (solo si aplica) */}
      {!sinReferencias && (
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="flex flex-col gap-1">
            <label className="font-mono text-[10px] text-slate-500 uppercase tracking-wider">Ref. 1</label>
            <input type="number" value={ref1} onChange={e => setRef1(e.target.value)}
              placeholder="0" className="input-solar rounded-lg px-3 py-2 text-xs font-mono" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="font-mono text-[10px] text-slate-500 uppercase tracking-wider">Ref. 2</label>
            <input type="number" value={ref2} onChange={e => setRef2(e.target.value)}
              placeholder="0" className="input-solar rounded-lg px-3 py-2 text-xs font-mono" />
          </div>
        </div>
      )}

      {/* Alerta error */}
      {error && (
        <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-3">
          <span className="text-red-400 text-sm leading-none">⚠</span>
          <p className="font-mono text-[10px] text-red-400">{error}</p>
        </div>
      )}

      {/* Aviso refs faltantes */}
      {datos && faltanRefs && (
        <p className="font-mono text-[10px] text-amber-400 mb-2">
          Ingresa los dos valores de referencia para descargar.
        </p>
      )}

      {/* Botones */}
      {datos && (
        <div className="flex flex-col gap-2">
          <button
            onClick={handleDescargar}
            disabled={procesando || faltanRefs}
            className="btn-primary w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-mono disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {procesando ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
            {labelBtn}
          </button>
          {labelBtn2 && onDescargar2 && (
            <button
              onClick={async () => {
                if (!datos || !archivo) return;
                setError('');
                setProcesando(true);
                try { await onDescargar2(datos.rows, datos.headers, archivo, ref1, ref2); }
                catch (e: unknown) { setError(e instanceof Error ? e.message : 'Error al generar el archivo.'); }
                finally { setProcesando(false); }
              }}
              disabled={procesando || faltanRefs}
              className="btn-ghost w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-mono border border-[var(--c-border-sub)] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {procesando ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
              {labelBtn2}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Página principal ──

export default function InformesNocturnos() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Moon size={16} className="text-indigo-400" />
        <h2 className="font-display font-700 text-base tracking-wider text-[var(--c-text)]">
          INFORMES NOCTURNOS
        </h2>
      </div>

      {/* Grupo: El Pelicano Noche */}
      <div className="border border-[var(--c-border-sub)] rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          <h3 className="font-display font-600 text-xs tracking-widest text-slate-400 uppercase">
            Informes El Pelicano — Noche
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <CardInforme
            titulo="ENERGÍA REAL METER EL PELICANO"
            subtitulo="Energía del CEN"
            labelBtn="Descargar Excel con Energía Real Meter"
            parser={parseMeter}
            onDescargar={descargarMeter}
          />
          <CardInforme
            titulo="ENERGÍA REAL LDP1 EL PELICANO"
            subtitulo="Energía del CEN"
            labelBtn="Descargar Excel con Energía Real LDP1"
            labelBtn2="Energía Real para el CEN"
            parser={parseLDP}
            onDescargar={descargarLDP1}
            onDescargar2={descargarCENLDP1Pelicano}
          />
          <CardInforme
            titulo="ENERGÍA REAL LDP2 EL PELICANO"
            subtitulo="Energía del CEN"
            labelBtn="Descargar Excel con Energía Real LDP2"
            parser={parseLDP}
            onDescargar={descargarLDP2}
          />
        </div>
      </div>

      {/* Grupo: Hanqwa */}
      <div className="border border-[var(--c-border-sub)] rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-2 h-2 rounded-full bg-cyan-400" />
          <h3 className="font-display font-600 text-xs tracking-widest text-slate-400 uppercase">
            Informes Hanqwa
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <CardInforme
            titulo="ENERGÍA REAL METER SOL DEL NORTE - HANQWA"
            subtitulo="Energía del CEN"
            labelBtn="Descargar Excel con Energía Real Meter"
            labelBtn2="Energía Real para el CEN"
            parser={parseMeter}
            onDescargar={descargarMeterHanqwa}
            onDescargar2={descargarCENHanqwa}
          />
          <CardInforme
            titulo="ENERGÍA REAL METER DESIERTO - HANQWA"
            subtitulo="Energía del CEN"
            labelBtn="Descargar Excel con Energía Real Meter"
            labelBtn2="Energía Real para el CEN"
            parser={parseMeter}
            onDescargar={descargarMeterHanqwa}
            onDescargar2={descargarCENHanqwa}
          />
          <CardInforme
            titulo="ENERGÍA REAL METER LOS ANDES - HANQWA"
            subtitulo="Energía del CEN"
            labelBtn="Descargar Excel con Energía Real Meter"
            labelBtn2="Energía Real para el CEN"
            parser={parseMeter}
            onDescargar={descargarMeterHanqwa}
            onDescargar2={descargarCENHanqwa}
          />
        </div>
      </div>

      {/* Grupo: Luz del Norte */}
      <div className="border border-[var(--c-border-sub)] rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-2 h-2 rounded-full bg-green-400" />
          <h3 className="font-display font-600 text-xs tracking-widest text-slate-400 uppercase">
            Informes Luz del Norte
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <CardInforme
            titulo="ENERGÍA REAL LUZ DEL NORTE"
            subtitulo="Energía del CEN"
            labelBtn="Descargar Excel con Energía Real Meter"
            labelBtn2="Energía Real para el CEN"
            parser={parseMeter}
            onDescargar={descargarMeterHanqwa}
            onDescargar2={descargarCENLuzDelNorte}
          />
          <CardInforme
            titulo="IRRADIANCIA DEL DÍA LUZ DEL NORTE"
            subtitulo="Daily Report"
            labelBtn="Descargar Excel Irradiancia"
            sinReferencias
            parser={parseIrradianciaLDN}
            onDescargar={descargarIrradianciaLDN}
          />
        </div>
      </div>

      {/* Grupo: Carbon Free */}
      <div className="border border-[var(--c-border-sub)] rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-2 h-2 rounded-full bg-violet-400" />
          <h3 className="font-display font-600 text-xs tracking-widest text-slate-400 uppercase">
            Informes Carbon Free
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <CardInformeMulti
            titulo="ENERGÍA REAL METER — CARBON FREE"
            subtitulo="Procesamiento multi-archivo"
            labelBtn="Descargar Excel con Energía Real Meter"
            labelBtn2="Energía Real para el CEN"
            parser={parseMeter}
            sinReferencias
            onDescargar={descargarMeterHanqwa}
            onDescargar2={descargarCENHanqwa}
            onDescargarSinRef={descargarMeterCarbonFree}
            onDescargar2SinRef={descargarCENCarbonFree}
          />
        </div>
      </div>

    </div>
  );
}
