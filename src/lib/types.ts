// src/lib/types.ts

export type Cliente = 'Carbon Free' | 'Matrix';

export type RolUsuario = 'admin' | 'operador';

export interface Usuario {
  uid: string;
  username: string;
  nombre: string;
  rol: RolUsuario;
  createdAt?: number;
}

export type TipoPlanta = 'Fotovoltaica' | 'Eólica' | 'Hidráulica' | 'Termosolar' | 'Otra';

export interface FichaPlanta {
  id?: string;
  plantaNombre: string;
  cliente: Cliente;

  // Identificación
  tipoPlanta?: TipoPlanta;
  fechaOperacion?: string;
  codigoPMGD?: string;
  numeroContrato?: string;
  empresa?: string;               // distribuidora

  // Generación
  potenciaInstaladaDC?: string;   // kWp
  potenciaNominalAC?: string;     // kW
  numInversores?: string;
  numTrackers?: string;
  numStrings?: string;
  tecnologia?: string;            // solo aplica fotovoltaica

  // Conexión eléctrica
  tensionAlimentador?: string;    // kV nominal
  capacidadAlimentador?: string;  // MVA
  tensionTrabajoMin?: string;     // kV mínimo
  tensionTrabajoMax?: string;     // kV máximo
  limitacion?: string;            // kW
  tipoLimitacion?: string;

  // Contactos
  contactoNombre?: string;
  contactoTelefono?: string;
  contactoDistribuidora?: string;
  telefonoDistribuidora?: string;
  contactoEmergencia?: string;

  // Operación
  procedimientos?: string;
  observaciones?: string;

  updatedAt?: number;
}

export interface Planta {
  id?: string;
  nombre: string;
  cliente: Cliente;
  createdAt?: number;
}

export interface RegistroBitacora {
  id?: string;
  tipo?: 'planta' | 'oficina';
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
  alimentador?: string;
  subestacion?: string;
  direccion?: string;
  createdAt?: number;
}

export interface AnyDesk {
  id?: string;
  planta: string;
  cliente: Cliente;
  nombre: string;
  numero: string;
  createdAt?: number;
}

export type TipoInforme = 'diario' | 'turno';

export interface InformeGuardado {
  id?: string;
  tipo: TipoInforme;
  titulo: string;
  contenido: string;
  cliente: Cliente | 'todos';
  fechaDesde: string;
  fechaHasta: string;
  totalEventos: number;
  createdAt?: number;
}

export const CAUSAS_CARBON_FREE = [
  'Aislamiento',
  'Alta Temperatura',
  'ANSI 27',
  'ANSI 59N',
  'ANSI 81',
  'Apertura de celda',
  'Apertura de Trafo',
  'Auto-limitacion',
  'Baja Corriente',
  'Baja DC',
  'Baja Frecuencia',
  'Baja Generacion',
  'Bajo Aceite',
  'Bajo Voltage',
  'Breaker Comunicaciones',
  'Breaker UPS',
  'Com Fail',
  'Condiciones Climaticas',
  'Disturbance',
  'Corriente Baja',
  'Curso Forsozo',
  'Falla irradiancia inclinada',
  'DC Box Aislada',
  'Poste Chocado',
  'DC BOX Baja Corriente',
  'DC Box detenida',
  'Detencion',
  'Emergencia',
  'ENTEL',
  'F-25 Baja Vdc',
  'F26 - Fallo Emergencia Modulo',
  'F27-F. Mod. Arranque',
  'F31 Error Diagnostico',
  'F45',
  'F57 Canal DU mal cableado',
  'F6- Baja Vac',
  'Falla Contactor AC',
  'Falla de Aislación',
  'Falla de equipo',
  'Falla en linea',
  'Falla en S/E',
  'Falla MSSU',
  'Falla PSSU',
  'Termografía',
  'Isolation resistance value out of limits',
  'Kit Aterramiento',
  'Lavado',
  'Limitacion',
  'Mantenimiento',
  'Medidor ION',
  'Microcorte',
  'Modulo Aislado',
  'Modulo Detenido',
  'Desconexion',
  'Posicionamiento',
  'Problema en Alimentador',
  'Problema en Reconectador',
  'Revision',
  'Robo',
  'SCADA',
  'Sin condiciones de arranque',
  'Sin Información',
  'Sobre Corriente',
  'Sobre Frecuencia',
  'Sobre Voltage',
  'SODI',
  'Yiel TEST',
  'SSAA Circuit Breaker Open',
  'STOW',
  'Suspension de servicio',
  'Trabajos Despacho',
  'Trabajos Internos',
  'Transf. de Carga',
  'Trip de Frecuencia',
  'Trip Frecuencia',
  'Trip Trafo1',
  'UPS',
  'W11 Falla Condensador',
  'W20- Falla Modulo',
  'Derrateo por sobretemperatura',
  'Grid_V-unbalanced',
  'Mantenimiento Preventivo',
  'Mantenimiento Correctivo',
  'Pago de Servicio',
  'Falla IGBT',
  'High Wind',
  'Mantenimieno correctivo',
  'HMI',
  'PC',
  'Poda',
];

export const CAUSAS_MATRIX = [
  'Corte de energía / corte de agua',
  'Desconexión programada mayor a 24 horas',
  'Desconexión programada menor a 24 horas',
  'Distribuidora no autoriza ingreso de PMGD',
  'Falla de la unidad generadora o de instalaciones que la conectan al sistema',
  'Falla en red de distribución y/o transmisión (falla externa)',
  'Fenómenos naturales que afectan instalaciones propias de la central',
  'Fenómenos naturales que no afectan instalaciones propias de la central',
  'Indisponibilidad de combustible',
  'Indisponibilidad de instalaciones para abastecimiento de combustible',
  'Indisponibilidad de instalaciones hidráulicas',
  'Indisponibilidad de recurso hídrico',
  'Mantenimiento en red de distribución y/o transmisión',
  'Mantenimiento unidad generadora',
  'Puesta en marcha, ajustes y/o pruebas',
  'Restricción judicial o ambiental',
  'Trabajos realizados por terceros / SODI',
  'Otra causa de origen externo',
  'Otra causa de origen interno',
];

export const TIPOS_ACONTECIMIENTO_SELECT = [
  'Apertura Planta',
  'Apertura de Incoming',
  'Trip Inversor',
  'Falla Tracker',
  'Mantenimiento',
  'Comunicación',
  'Malfuncionamiento Trafo',
  'DC Box',
  'Limitacion',
  'Apertura de trafo',
  'Detencion Inversor',
  'Apertura de celda',
  'Falla Interna',
  'SODI',
  'String',
  'NCU',
  'Trip UPS',
  'Falla Inversor',
  'UPS',
  'Posicionamiento Tracker',
  'Baja Generacion',
  'CCTV',
  'Ausencia de Tension',
  'Falla tablero comunicación',
  'Revision Preventiva',
  'En Revision',
  'Lavado',
  'Correctivo',
];

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
