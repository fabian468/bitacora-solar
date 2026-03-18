// src/app/api/informe/route.ts
import { NextRequest, NextResponse } from 'next/server';

type RegistroResumen = {
  planta: string;
  cliente: string;
  acontecimiento: string;
  causa: string;
  detalle: string;
  fechaInicio: string;
  horaInicio: string;
  fechaFin: string;
  horaFin: string;
  estado?: string;
};

type RegistroResumenExt = RegistroResumen & { tipo?: string };

function buildResumen(registros: RegistroResumenExt[]): string {
  return registros.map((r, i) => `
EVENTO ${i + 1}${r.tipo === 'oficina' ? ' [NOVEDAD DE OFICINA]' : ''}:
- ${r.tipo === 'oficina' ? 'Origen: Oficina' : `Planta: ${r.planta} (${r.cliente})`}
- Acontecimiento: ${r.acontecimiento}
- Causa: ${r.causa || '-'}
- Detalle: ${r.detalle || 'Sin detalle'}
- Inicio: ${r.fechaInicio} ${r.horaInicio}
- Fin: ${r.fechaFin} ${r.horaFin}
- Estado: ${r.estado || 'pendiente'}
`).join('\n---\n');
}

function promptDiario(resumen: string, desde: string, hasta: string): string {
  return `Eres un asistente técnico de plantas fotovoltaicas. Se te dan los eventos del período ${desde} al ${hasta}.

REGISTROS:
${resumen}

Genera un RESUMEN OPERACIONAL DEL DÍA en español con esta estructura exacta:

# RESUMEN DEL DÍA
**Período:** ${desde} al ${hasta}

## ESTADO OPERACIONAL
[1-2 párrafos: ¿cómo estuvo el día? ¿las plantas operaron con normalidad? ¿hubo incidentes graves?]

## EVENTOS DEL PERÍODO
[Lista cada evento con: planta, acontecimiento, estado (✓ resuelto / ⏳ pendiente) y duración si aplica]

## PENDIENTES ACTIVOS
[Solo los eventos aún pendientes. Si no hay, escribe "Sin eventos pendientes."]

## OBSERVACIONES
[1-2 notas técnicas relevantes sobre lo ocurrido: equipos repetitivos, horas críticas, etc.]

Sé directo y técnico. No inventes datos.`;
}

function promptTurno(resumen: string, desde: string, hasta: string): string {
  return `Eres un técnico de turno en plantas fotovoltaicas. Necesitas generar un reporte para entregarle el turno al operador que entra.

EVENTOS DEL TURNO (${desde} al ${hasta}):
${resumen}

Genera un REPORTE DE ENTREGA DE TURNO en español con esta estructura exacta:

# ENTREGA DE TURNO
**Turno:** ${desde} al ${hasta}

## NOVEDADES DEL TURNO
[Describe brevemente qué ocurrió durante el turno. 2-3 oraciones claras, en primera persona como si lo estuviera contando el operador saliente]

## ACCIONES REALIZADAS
[Lista las acciones concretas que se tomaron: qué se hizo, en qué planta, con qué resultado]

## PENDIENTE PARA EL PRÓXIMO TURNO
[Lista SOLO los eventos que quedaron sin resolver, con planta y estado actual. Si no hay, escribe "Sin pendientes."]

## EQUIPOS A VIGILAR
[Menciona equipos o plantas que requieren atención especial, basado en los eventos del turno]

## NOVEDADES DE OFICINA
[Lista los eventos marcados como [NOVEDAD DE OFICINA]. Si no hay ninguno, escribe "Sin novedades de oficina."]

## RECOMENDACIONES PARA EL TURNO ENTRANTE
[2-3 puntos concretos de lo que debe priorizar o revisar el operador que entra]

Usa lenguaje directo, como lo hablaría un técnico a otro técnico. Sin rodeos.`;
}

export async function POST(req: NextRequest) {
  const { registros, fechaDesde, fechaHasta, tipoInforme = 'diario' } = await req.json() as {
    registros: RegistroResumenExt[];
    fechaDesde: string;
    fechaHasta: string;
    tipoInforme: string;
  };

  if (!registros || registros.length === 0) {
    return NextResponse.json({ error: 'No hay registros para el período' }, { status: 400 });
  }

  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) {
    return NextResponse.json({ error: 'GROQ_API_KEY no configurada' }, { status: 500 });
  }

  const resumen = buildResumen(registros);
  const prompt = tipoInforme === 'turno'
    ? promptTurno(resumen, fechaDesde, fechaHasta)
    : promptDiario(resumen, fechaDesde, fechaHasta);

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Groq error:', err);
      throw new Error('Error en Groq API');
    }

    const data = await response.json();
    const informe = data.choices[0]?.message?.content?.trim() || '';

    return NextResponse.json({ informe });
  } catch (error) {
    console.error('Error informe:', error);
    return NextResponse.json({ error: 'Error al generar el informe' }, { status: 500 });
  }
}
