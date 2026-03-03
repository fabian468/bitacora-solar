// src/lib/types.ts
export interface RegistroBitacora {
  id?: string;
  planta: string;
  acontecimiento: string;
  causa: string;
  detalle: string;
  fechaInicio: string;
  horaInicio: string;
  fechaFin: string;
  horaFin: string;
  createdAt?: number;
}

export const PLANTAS = [
  'Planta Solar Norte',
  'Planta Solar Sur',
  'Planta Solar Este',
  'Planta Solar Oeste',
  'Parque Fotovoltaico 1',
  'Parque Fotovoltaico 2',
];

export const TIPOS_ACONTECIMIENTO = [
  'Falla de inversor',
  'Corte de red eléctrica',
  'Mantenimiento preventivo',
  'Mantenimiento correctivo',
  'Alarma de temperatura',
  'Falla de comunicación',
  'Inspección rutinaria',
  'Limpieza de paneles',
  'Evento climático',
  'Otro',
];
