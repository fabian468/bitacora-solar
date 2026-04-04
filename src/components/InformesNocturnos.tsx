'use client';

import { useState, useRef, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
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

  // Calcular inicio/fin dia desde los datos (cols B-F, índices 1-5)
  let inicioDia: string | null = null;
  let finDia: string | null = null;
  let enPeriodoPositivo = false;
  for (const row of dataFormateada) {
    const time = String(row[0] ?? '');
    const valores = (row.slice(1, 6) as (number | string)[])
      .map(v => typeof v === 'number' ? v : parseFloat(String(v)))
      .filter(v => !isNaN(v));
    if (valores.length === 0) continue;
    const todosPositivos = valores.every(v => v > 0);
    const algunoNegativo = valores.some(v => v < 0);
    if (!inicioDia && todosPositivos) { inicioDia = time; enPeriodoPositivo = true; }
    if (enPeriodoPositivo && !finDia && algunoNegativo) { finDia = time; enPeriodoPositivo = false; }
  }

  // Colorear filas cada 15 min + col G promedio + apilar en col J
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  let jRow = 1; // col J empieza en r=1 (r=0 es header)
  for (let R = 1; R <= range.e.r; R++) {
    const celda = ws[XLSX.utils.encode_cell({ r: R, c: 0 })] as { v?: unknown; s?: Record<string, unknown> } | undefined;
    if (typeof celda?.v === 'string' && /:\d*(00|15|30|45)$/.test(celda.v)) {
      for (let C = 0; C <= range.e.c; C++) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = ws[addr] as { s?: Record<string, unknown> } | undefined;
        if (cell) cell.s = { ...(cell.s ?? {}), fill: { fgColor: { rgb: 'FFFF00' } } };
        else ws[addr] = { t: 'z', s: { fill: { fgColor: { rgb: 'FFFF00' } } } };
      }
      const excelRow = R + 1;
      // Col G: promedio*10 en la fila original
      ws[XLSX.utils.encode_cell({ r: R, c: 6 })] = { t: 'n', f: `AVERAGE(B${excelRow}:F${excelRow})*10`, s: { fill: { fgColor: { rgb: 'FFFF00' } }, font: { sz: 11 } } };
      // Col J: apilar promedios secuencialmente, verde si positivo
      const dataRow = dataFormateada[R - 1];
      const vals = dataRow ? (dataRow.slice(1, 6) as (number | string)[]).map(v => typeof v === 'number' ? v : parseFloat(String(v))).filter(v => !isNaN(v)) : [];
      const avg10 = vals.length > 0 ? (vals.reduce((a, b) => a + b, 0) / vals.length) * 10 : 0;
      const jStyle = avg10 > 0
        ? { font: { sz: 11 }, fill: { fgColor: { rgb: '00B050' } } }
        : { font: { sz: 11 } };
      ws[XLSX.utils.encode_cell({ r: jRow, c: 9 })] = { t: 'n', f: `AVERAGE(B${excelRow}:F${excelRow})*10`, s: jStyle };
      jRow++;
    }
  }

  // Colorear filas de inicio y fin de irradiancia en azul claro
  const AZUL_CLARO = 'FF0000';
  for (let R = 1; R <= range.e.r; R++) {
    const celda = ws[XLSX.utils.encode_cell({ r: R, c: 0 })] as { v?: unknown; s?: Record<string, unknown> } | undefined;
    const time = typeof celda?.v === 'string' ? celda.v : '';
    if (time === inicioDia || time === finDia) {
      for (let C = 0; C <= range.e.c; C++) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = ws[addr] as { s?: Record<string, unknown> } | undefined;
        if (cell) cell.s = { ...(cell.s ?? {}), fill: { fgColor: { rgb: AZUL_CLARO } } };
        else ws[addr] = { t: 'z', s: { fill: { fgColor: { rgb: AZUL_CLARO } } } };
      }
    }
  }

  // Headers y valores cols J-L
  range.e.c = Math.max(range.e.c, 11);
  ws['!ref'] = XLSX.utils.encode_range(range);
  ws[XLSX.utils.encode_cell({ r: 0, c: 9 })]  = { t: 's', v: 'Prom G',     s: { font: { bold: true, sz: 11 } } };
  ws[XLSX.utils.encode_cell({ r: 0, c: 10 })] = { t: 's', v: 'Inicio dia', s: { font: { bold: true, sz: 11 } } };
  ws[XLSX.utils.encode_cell({ r: 1, c: 10 })] = { t: 's', v: inicioDia ?? '-', s: { font: { sz: 11 } } };
  ws[XLSX.utils.encode_cell({ r: 0, c: 11 })] = { t: 's', v: 'Fin dia',    s: { font: { bold: true, sz: 11 } } };
  ws[XLSX.utils.encode_cell({ r: 1, c: 11 })] = { t: 's', v: finDia ?? '-',    s: { font: { sz: 11 } } };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Registros');
  XLSX.writeFile(wb, `${archivo.name.replace(/\.[^.]+$/, '')}_irradiancia_ldnorte.xlsx`, { cellStyles: true });
}

// ── Lógica Meter Luz del Norte (0 decimales, igual a LDP1) ──

async function descargarMeterLuzDelNorte(rows: string[][], headers: string[], archivo: File, ref1: string, ref2: string) {
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
      if (ws[cellAddr]) { ws[cellAddr].t = 'n'; ws[cellAddr].z = '#,##0;-#,##0'; }
    }
  }

  aplicarFuente11(ws as Record<string, unknown>, XLSX.utils);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Registros');
  XLSX.writeFile(wb, `${archivo.name.replace(/\.[^.]+$/, '')}_meter_luz_del_norte.xlsx`, { cellStyles: true });
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

// ── PRUEBA: últimos valores F y G por hoja ──

async function procesarUltimosFG(archivo: File, ultimaFila: number): Promise<void> {
  const XLSX = await import('xlsx-js-style');
  const buffer = await archivo.arrayBuffer();
  const wbOrig = XLSX.read(new Uint8Array(buffer), { type: 'array' });
  const wbNew = XLSX.utils.book_new();

  const filaLimite = Math.max(Number(ultimaFila) || 2975, 1);

  for (const sheetName of wbOrig.SheetNames) {
    const ws = wbOrig.Sheets[sheetName];
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][];

    let lastF: unknown = 0;
    let lastG: unknown = 0;
    const limite = Math.min(filaLimite, aoa.length - 1);
    for (let r = 1; r <= limite; r++) {
      const row = aoa[r] as unknown[];
      const fVal = row[5];
      const gVal = row[6];
      const fNum = typeof fVal === 'number' ? fVal : parseFloat(String(fVal ?? ''));
      const gNum = typeof gVal === 'number' ? gVal : parseFloat(String(gVal ?? ''));
      if (!isNaN(fNum) && fNum > 0) lastF = fVal;
      if (!isNaN(gNum) && gNum > 0) lastG = gVal;
    }

    const wsNew = XLSX.utils.aoa_to_sheet([[lastF, lastG]]);
    aplicarFuente11(wsNew as Record<string, unknown>, XLSX.utils);
    XLSX.utils.book_append_sheet(wbNew, wsNew, sheetName);
  }

  if (wbNew.SheetNames.length === 0) throw new Error('No se encontraron hojas en el archivo.');
  XLSX.writeFile(wbNew, `${archivo.name.replace(/\.[^.]+$/, '')}_ultimos_FG.xlsx`, { cellStyles: true });
}

// ── PRUEBA con referencias: extrae refs del Excel principal y filtra los otros Excel desde la fila coincidente ──

async function procesarConReferencias(
  archivoMain: File,
  archivosOtros: File[],
  ultimaFila: number,
): Promise<void> {
  const XLSX = await import('xlsx-js-style');
  const filaLimite = Math.max(Number(ultimaFila) || 2975, 1);

  // Paso 1: extraer lastF y lastG por hoja del Excel principal
  const bufferMain = await archivoMain.arrayBuffer();
  const wbMain = XLSX.read(new Uint8Array(bufferMain), { type: 'array' });
  const refs: Record<string, { lastF: unknown; lastG: unknown }> = {};

  for (const sheetName of wbMain.SheetNames) {
    const ws = wbMain.Sheets[sheetName];
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][];
    let lastF: unknown = '';
    let lastG: unknown = '';
    const limite = Math.min(filaLimite, aoa.length - 1);
    for (let r = 1; r <= limite; r++) {
      const row = aoa[r] as unknown[];
      const fVal = row[5];
      const gVal = row[6];
      const fNum = typeof fVal === 'number' ? fVal : parseFloat(String(fVal ?? ''));
      const gNum = typeof gVal === 'number' ? gVal : parseFloat(String(gVal ?? ''));
      if (!isNaN(fNum) && fNum > 0) lastF = fVal;
      if (!isNaN(gNum) && gNum > 0) lastG = gVal;
    }
    refs[sheetName] = { lastF, lastG };
  }

  // Paso 2: para cada Excel adicional, buscar la fila con los refs y extraer hacia abajo
  for (const archivo of archivosOtros) {
    const sheetName = archivo.name.replace(/\.[^.]+$/, '');
    const ref = refs[sheetName];
    if (!ref) continue;

    const ref1 = String(ref.lastF ?? '').trim();
    const ref2 = String(ref.lastG ?? '').trim();

    const buffer = await archivo.arrayBuffer();
    const wb = XLSX.read(new Uint8Array(buffer), { type: 'array' });
    const wbNew = XLSX.utils.book_new();

    for (const sName of wb.SheetNames) {
      const ws = wb.Sheets[sName];
      const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][];

      // Buscar fila donde col A === ref1 y col B === ref2
      const idx = aoa.findIndex((row) => {
        const a = String((row as unknown[])[0] ?? '').trim();
        const b = String((row as unknown[])[1] ?? '').trim();
        return a === ref1 && b === ref2;
      });

      // Si no se encontró, empezar desde fila 1 (saltando header)
      const startIdx = idx !== -1 ? idx : 1;
      const extracted = aoa.slice(startIdx);

      const wsNew = XLSX.utils.aoa_to_sheet(extracted);
      aplicarFuente11(wsNew as Record<string, unknown>, XLSX.utils);
      XLSX.utils.book_append_sheet(wbNew, wsNew, sName);
    }

    if (wbNew.SheetNames.length > 0) {
      XLSX.writeFile(wbNew, `${sheetName}.xlsx`, { cellStyles: true });
    }
  }
}

function CardPrueba() {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [archivosOtros, setArchivosOtros] = useState<File[]>([]);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState('');
  const [ultimaFila, setUltimaFila] = useState(2975);
  const [guardando, setGuardando] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const fileOtrosRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getDoc(doc(db, 'config', 'prueba_fg'))
      .then(snap => { if (snap.exists()) setUltimaFila(snap.data().ultimaFila ?? 2975); })
      .catch(() => {});
  }, []);

  const guardarUltimaFila = async (valor: number) => {
    setGuardando(true);
    try { await setDoc(doc(db, 'config', 'prueba_fg'), { ultimaFila: valor }); }
    catch { /* silencioso */ }
    finally { setGuardando(false); }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    setArchivo(e.target.files?.[0] ?? null);
  };

  const handleArchivosOtros = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    const files = Array.from(e.target.files ?? []);
    setArchivosOtros(files);
  };

  const handleDescargar = async () => {
    if (!archivo) return;
    setProcesando(true);
    setError('');
    try {
      if (archivosOtros.length > 0) {
        await procesarConReferencias(archivo, archivosOtros, ultimaFila);
      } else {
        await procesarUltimosFG(archivo, ultimaFila);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al procesar.');
    } finally {
      setProcesando(false);
    }
  };

  return (
    <div className="card-solar rounded-xl p-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center flex-shrink-0">
          <FileSpreadsheet size={13} className="text-rose-400" />
        </div>
        <div>
          <h3 className="font-display font-700 text-xs tracking-wider text-[var(--c-text)]">PRUEBA</h3>
          <p className="font-mono text-[10px] text-slate-500">Últimos valores col F y G por hoja</p>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <label className="font-mono text-[10px] text-slate-400 whitespace-nowrap">Última fila</label>
        <input
          type="number"
          value={ultimaFila}
          onChange={e => setUltimaFila(Number(e.target.value))}
          onBlur={e => guardarUltimaFila(Number(e.target.value))}
          className="w-24 bg-slate-800 border border-slate-600 rounded px-2 py-1 font-mono text-[10px] text-slate-200 focus:outline-none focus:border-rose-400"
        />
        {guardando && <Loader2 size={11} className="animate-spin text-slate-500" />}
      </div>

      {/* Excel principal */}
      <label className="flex items-center gap-2 cursor-pointer border border-dashed border-slate-600 rounded-lg px-3 py-2 hover:border-rose-400/50 transition-colors mb-2">
        <Upload size={13} className="text-slate-400 flex-shrink-0" />
        <span className="font-mono text-[10px] text-slate-400 truncate">
          {archivo ? archivo.name : 'Excel principal (.xlsx)'}
        </span>
        <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={handleFile} />
      </label>

      {/* Otros Excel (opcionales, nombrados igual que las hojas) */}
      <label className="flex items-center gap-2 cursor-pointer border border-dashed border-slate-700 rounded-lg px-3 py-2 hover:border-rose-400/30 transition-colors mb-3">
        <Upload size={13} className="text-slate-500 flex-shrink-0" />
        <span className="font-mono text-[10px] text-slate-500 truncate">
          {archivosOtros.length > 0
            ? `${archivosOtros.length} Excel(s) adicional(es)`
            : 'Otros Excel por hoja (opcional)'}
        </span>
        <input ref={fileOtrosRef} type="file" accept=".xlsx" multiple className="hidden" onChange={handleArchivosOtros} />
      </label>

      {/* Lista de archivos adicionales con indicador de coincidencia */}
      {archivosOtros.length > 0 && archivo && (
        <div className="mb-3 space-y-1">
          {archivosOtros.map((f) => {
            const sheetName = f.name.replace(/\.[^.]+$/, '');
            return (
              <div key={f.name} className="flex items-center gap-2">
                <span className="font-mono text-[9px] text-slate-400 truncate flex-1">{f.name}</span>
                <span className="font-mono text-[9px] text-slate-600">→ hoja &quot;{sheetName}&quot;</span>
              </div>
            );
          })}
        </div>
      )}

      {archivo && (
        <button
          onClick={handleDescargar}
          disabled={procesando}
          className="w-full flex items-center justify-center gap-2 bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 text-rose-300 rounded-lg px-3 py-2 font-mono text-[10px] transition-colors disabled:opacity-50"
        >
          {procesando ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
          {procesando
            ? 'Procesando...'
            : archivosOtros.length > 0
            ? `Descargar ${archivosOtros.length} Excel(s)`
            : 'Descargar Excel'}
        </button>
      )}

      {error && <p className="mt-2 font-mono text-[10px] text-red-400">{error}</p>}
    </div>
  );
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
            onDescargar={descargarMeterLuzDelNorte}
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
          <CardPrueba />
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
