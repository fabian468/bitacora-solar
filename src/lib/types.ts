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
  estado?: 'resuelto' | 'pendiente';
  createdAt?: number;
}

export const PLANTAS = [
  'Mutupin',
  'Santa fe',
  'Chillan 1',
  'Chillan 2',
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