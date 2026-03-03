// src/app/api/mejorar/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { texto, campo } = await req.json();

  if (!texto) return NextResponse.json({ error: 'Sin texto' }, { status: 400 });

  const GROQ_API_KEY = process.env.GROQ_API_KEY;

  if (!GROQ_API_KEY) {
    return NextResponse.json({ error: 'API key no configurada' }, { status: 500 });
  }

  const prompts: Record<string, string> = {
    acontecimiento: `Mejora la redacción técnica de este título de acontecimiento en una planta fotovoltaica. Hazlo conciso, claro y profesional. Devuelve SOLO el texto mejorado sin explicaciones:\n\n"${texto}"`,
    causa: `Mejora la redacción técnica de esta causa de un evento en una planta fotovoltaica. Hazla clara, precisa y en lenguaje técnico apropiado. Devuelve SOLO el texto mejorado sin explicaciones:\n\n"${texto}"`,
    detalle: `Mejora la redacción técnica de este detalle de un evento en una planta fotovoltaica. Hazlo más profesional, claro y completo. Devuelve SOLO el texto mejorado sin explicaciones:\n\n"${texto}"`,
  };

  const prompt = prompts[campo] || `Mejora la redacción de este texto para uso técnico profesional. Devuelve SOLO el texto mejorado:\n\n"${texto}"`;

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
        max_tokens: 300,
        temperature: 0.3,
      }),
    });

    if (!response.ok) throw new Error('Error en Groq API');

    const data = await response.json();
    const textoMejorado = data.choices[0]?.message?.content?.trim() || texto;

    return NextResponse.json({ textoMejorado });
  } catch (error) {
    console.error('Error IA:', error);
    return NextResponse.json({ error: 'Error al mejorar texto' }, { status: 500 });
  }
}
