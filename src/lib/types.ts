// src/lib/types.ts

export type Cliente = 'Carbon Free' | 'Matrix';

export interface Planta {
  id?: string;
  nombre: string;
  cliente: Cliente;
  createdAt?: number;
}

export interface RegistroBitacora {
  id?: string;
  planta: string;
  cliente: Cliente;
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

export const CLIENTES: Cliente[] = ['Carbon Free', 'Matrix'];

export interface Despacho {
  id?: string;
  planta: string;
  cliente: Cliente;
  numero: string;
  fecha: string;
  descripcion?: string;
  createdAt?: number;
}

export const TIPOS_ACONTECIMIENTO = [
  'Falla de inversor',
  'Corte de red eléctrica',
  'Limitación de potencia',
  'Mantenimiento preventivo',
  'Mantenimiento correctivo',
  'Alarma de temperatura',
  'Falla de comunicación',
  'Falla tracker',
  'Inspección rutinaria',
  'Limpieza de paneles',
  'Evento climático',
  'Otro',
];
