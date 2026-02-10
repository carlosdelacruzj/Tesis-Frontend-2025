export interface DashboardEstadoConteo {
  id: number;
  nombre: string;
  total: number;
}

export interface DashboardEmbudoConversiones {
  cotizacionAPedidoPct: number;
  pedidoAProyectoPct: number;
  cotizacionAProyectoPct: number;
}

export interface DashboardEmbudoCore {
  cotizacionesTotal: number;
  pedidosTotal: number;
  proyectosTotal: number;
  cotizacionesConPedido: number;
  pedidosConProyecto: number;
  cotizacionesConProyectoFinal: number;
  conversiones: DashboardEmbudoConversiones;
}

export interface DashboardAntiguedadItem {
  total: number;
  promedioDias: number;
  maxDias: number;
}

export interface DashboardAntiguedadFases {
  cotizacionSinPedido: DashboardAntiguedadItem;
  pedidoSinProyecto: DashboardAntiguedadItem;
  proyectoActivoNoEntregado: DashboardAntiguedadItem;
}

export interface DashboardProyectoDelDiaBase {
  fecha: string;
  totalProyectos: number;
  totalDias: number;
}

export interface DashboardProyectoDiaEstadoConteo {
  estadoDiaId: number;
  estadoDia: string;
  total: number;
}

export interface DashboardProyectoDelDia extends DashboardProyectoDelDiaBase {
  porEstadoDia: DashboardProyectoDiaEstadoConteo[];
  proyectos: Array<{
    proyectoId: number;
    proyecto: string;
    estadoProyecto: string;
    estadoDia: string;
  }>;
}

export interface DashboardProyectosDelDia {
  hoy: DashboardProyectoDelDia;
  manana: DashboardProyectoDelDia;
}

export interface DashboardDevolucionesPendientes {
  totalEquiposPendientes: number;
  totalDiasConPendientes: number;
  items: Array<{
    diaId: number;
    fecha: string;
    proyectoId: number;
    proyecto: string;
    pendientes: number;
  }>;
}

export interface DashboardDiasSuspendidosCancelados {
  totalDias: number;
  items: Array<{
    diaId: number;
    fecha: string;
    proyectoId: number;
    estadoDia: string;
  }>;
}

export interface DashboardRetrasos {
  totalDias: number;
  items: Array<{
    diaId: number;
    fecha: string;
    proyectoId: number;
    proyecto: string;
  }>;
}

export interface DashboardCuelloBotellaCotizacionSinPedido {
  cotizacionId: number;
  cotizacion: string;
  diasSinPedido: number;
}

export interface DashboardCuelloBotellaPedidoSinProyecto {
  pedidoId: number;
  pedido: string;
  diasSinProyecto: number;
}

export interface DashboardCuelloBotellaProyectoNoEntregado {
  proyectoId: number;
  proyecto: string;
  diasActivo: number;
}

export interface DashboardCuellosBotella {
  cotizacionesSinPedido: DashboardCuelloBotellaCotizacionSinPedido[];
  pedidosSinProyecto: DashboardCuelloBotellaPedidoSinProyecto[];
  proyectosNoEntregados: DashboardCuelloBotellaProyectoNoEntregado[];
}

export interface DashboardKpiAlertas {
  devolucionesPendientes: DashboardDevolucionesPendientes;
  diasSuspendidosCancelados: DashboardDiasSuspendidosCancelados;
  retrasos: DashboardRetrasos;
  cuellosBotella: DashboardCuellosBotella;
}

export interface DashboardKpisData {
  cotizacionesPorEstado: DashboardEstadoConteo[];
  pedidosPorEstado: DashboardEstadoConteo[];
  proyectosPorEstado: DashboardEstadoConteo[];
  embudoCore: DashboardEmbudoCore;
  antiguedadFases: DashboardAntiguedadFases;
  proyectosDelDia: DashboardProyectosDelDia;
  alertas: DashboardKpiAlertas;
}

export interface DashboardKpisResponse {
  generatedAt: string;
  kpis: DashboardKpisData;
}

export interface DashboardResumenFasesCore {
  cotizacionesPorEstado: DashboardEstadoConteo[];
  pedidosPorEstado: DashboardEstadoConteo[];
  proyectosPorEstado: DashboardEstadoConteo[];
}

export interface DashboardAlertasResumen {
  equiposNoDevueltos: number;
  diasSuspendidosPorReprogramar: number;
  proyectoListoSinLinkFinal: number;
  cotizacionesPorExpirar7d: number;
  pedidosEnRiesgo7d: number;
}

export interface DashboardResumenData {
  fasesCore: DashboardResumenFasesCore;
  embudoCore: DashboardEmbudoCore;
  antiguedadFases: DashboardAntiguedadFases;
  proyectosDelDia: {
    hoy: DashboardProyectoDelDiaBase;
    manana: DashboardProyectoDelDiaBase;
  };
  alertasResumen: DashboardAlertasResumen;
}

export interface DashboardResumenResponse {
  generatedAt: string;
  resumen: DashboardResumenData;
  cacheHint: {
    scope: string;
    ttlSeconds: number;
  };
}

export interface DashboardAlertaProyectoListoSinLinkFinalItem {
  proyectoId: number;
  proyecto: string;
  pedidoId: number;
}

export interface DashboardAlertaEquiposNoDevueltosItem {
  diaId: number;
  fecha: string;
  proyectoId: number;
  pendientes: number;
}

export interface DashboardAlertaDiasSuspendidosPorReprogramarItem {
  diaId: number;
  fecha: string;
  proyectoId: number;
  estadoDia: string;
}

export interface DashboardColaOperativa {
  proyectoListoSinLinkFinal: {
    total: number;
    prioridad: string;
    items: DashboardAlertaProyectoListoSinLinkFinalItem[];
  };
  equiposNoDevueltos: {
    total: number;
    totalDias: number;
    prioridad: string;
    items: DashboardAlertaEquiposNoDevueltosItem[];
  };
  diasSuspendidosPorReprogramar: {
    total: number;
    prioridad: string;
    items: DashboardAlertaDiasSuspendidosPorReprogramarItem[];
  };
  cotizacionesPorExpirar: {
    total: number;
    totalVencidas: number;
    prioridad: string;
    items: {
      cotizacionId: number;
      cotizacion: string;
      clienteId: number | null;
      cliente: string | null;
      fechaVencimiento: string | null;
      diasParaVencer: number | null;
      vencida: boolean;
    }[];
  };
  pedidosEnRiesgo: {
    total: number;
    totalVencidos: number;
    totalSinFechaEvento: number;
    prioridad: string;
    items: {
      pedidoId: number;
      pedido: string;
      clienteId: number | null;
      cliente: string | null;
      fechaPrimerEvento: string | null;
      diasParaEvento: number | null;
      sinFechaEvento: boolean;
      vencido: boolean;
    }[];
  };
}

export interface DashboardAlertasResponse {
  generatedAt: string;
  horizonDays: number;
  totalAlertas: number;
  colaOperativa: DashboardColaOperativa;
}

export interface OperacionesAgendaResumenPorFecha {
  fecha: string;
  totalProyectoDias: number;
  totalProyectosUnicos: number;
  totalPedidosEventos: number;
  totalPedidosUnicos: number;
}

export interface OperacionesAgendaBloque {
  bloqueId: number;
  hora: string;
  ubicacion: string;
  orden: number;
}

export interface OperacionesAgendaProyectoDia {
  diaId: number;
  fecha: string;
  proyectoId: number;
  proyecto: string;
  estadoDiaId: number;
  estadoDia: string;
  estadoProyectoId: number;
  estadoProyecto: string;
  pedidoId: number;
  pedido: string;
  estadoPedidoId: number;
  estadoPedido: string;
  estadoPagoId?: number | null;
  estadoPago?: string | null;
  totalBloques: number;
  totalEmpleados: number;
  totalEquipos: number;
  totalEquiposPendientes: number;
  bloques: OperacionesAgendaBloque[];
  empleados: {
    empleadoId: number;
    empleado: string;
    rol: string | null;
  }[];
  equipos: {
    equipoId: number;
    serie: string;
    equipo: string;
    estadoAsignacion: string | null;
  }[];
  riesgosCapacidad: {
    staff80: boolean;
    equipo80: boolean;
  };
}

export interface OperacionesAgendaPedidoEvento {
  pedidoEventoId: number;
  pedidoId: number;
  pedido: string;
  fecha: string;
  hora: string;
  ubicacion: string;
  direccion: string | null;
  notas: string | null;
  estadoPedidoId: number;
  estadoPedido: string;
  estadoPagoId?: number | null;
  estadoPago?: string | null;
  proyectoIdVinculado: number | null;
}

export interface OperacionesAgendaResponse {
  generatedAt: string;
  range: {
    from: string;
    to: string;
  };
  resumenPorFecha: OperacionesAgendaResumenPorFecha[];
  agenda: {
    proyectoDias: OperacionesAgendaProyectoDia[];
    pedidoEventos: OperacionesAgendaPedidoEvento[];
  };
}

export interface DashboardCapacidadDiaMetrica {
  capacidadTotal: number;
  usado: number;
  libre: number;
  saturacionPct: number;
  asignaciones: number;
  sobreasignado: boolean;
}

export interface DashboardCapacidadEquipoDiaMetrica extends DashboardCapacidadDiaMetrica {
  pendientesDevolucion: number;
}

export interface DashboardCapacidadPorDia {
  fecha: string;
  staff: DashboardCapacidadDiaMetrica;
  equipo: DashboardCapacidadEquipoDiaMetrica;
}

export interface DashboardCapacidadResponse {
  generatedAt: string;
  range: {
    from: string;
    to: string;
  };
  capacidadBase: {
    totalStaffActivo: number;
    totalEquipoDisponible: number;
  };
  resumen: {
    diasEvaluados: number;
    diasRiesgoStaff80: number;
    diasRiesgoEquipo80: number;
  };
  capacidadPorDia: DashboardCapacidadPorDia[];
}

export interface DashboardHomeResponse {
  generatedAt: string;
  range: {
    fromYmd?: string;
    toYmd?: string;
    from?: string;
    to?: string;
  };
  operacionDia?: DashboardOperacionDia;
  dashboard: {
    resumen: DashboardResumenData;
    alertas: DashboardAlertasResponse;
    agenda: OperacionesAgendaResponse;
    capacidad: DashboardCapacidadResponse;
  };
}

export interface DashboardOperacionDiaTarjetas {
  serviciosProgramadosHoy: number;
  eventosHoy: number;
  proyectosEnCursoHoy: number;
  proyectosPendientesInicioHoy: number;
  equiposPorDevolverHoy: number;
  pagosConSaldoHoy: number;
}

export interface DashboardOperacionDiaAgendaItem {
  diaId: number;
  proyectoId: number;
  proyecto: string;
  pedidoId: number;
  pedido: string;
  horaInicio: string | null;
  estadoDia: string;
  estadoProyecto: string;
  estadoPedido: string;
  estadoPago: string | null;
  totalBloques: number;
  totalEmpleados: number;
  totalEquipos: number;
  totalEquiposPendientes: number;
  ubicacionPrincipal: string | null;
  riesgos: {
    sinStaff: boolean;
    sinEquipo: boolean;
    equipoPendienteDevolucion: boolean;
    pagoConSaldo: boolean;
  };
  riesgoCount: number;
}

export interface DashboardOperacionDiaColaPendienteItem {
  tipo: string;
  prioridad: string;
  proyectoId: number | null;
  diaId: number | null;
  mensaje: string;
}

export interface DashboardOperacionDia {
  fecha: string;
  tarjetas: DashboardOperacionDiaTarjetas;
  capacidadHoy: DashboardCapacidadPorDia;
  cobrosHoy: {
    pedidosPendientePago: number;
    pedidosParcialPago: number;
    pedidosPagado: number;
    pedidosConSaldo: number;
  };
  agendaHoy: {
    total: number;
    items: DashboardOperacionDiaAgendaItem[];
  };
  colaPendientesHoy: DashboardOperacionDiaColaPendienteItem[];
}

export interface DashboardOperativoDiaCards {
  eventosHoy: number;
  eventosEnCursoHoy: number;
  eventosPendientesInicioHoy: number;
  serviciosProgramadosHoy: number;
}

export interface DashboardOperativoDiaResumen {
  totalProyectosConDiaHoy: number;
  totalProyectoDiasHoy: number;
  estadoDia: {
    pendiente: number;
    enCurso: number;
    terminado: number;
    suspendido: number;
    cancelado: number;
  };
  cobrosHoy: {
    pedidosPendientePago: number;
    pedidosParcialPago: number;
    pedidosPagado: number;
    pedidosConSaldo: number;
  };
}

export interface DashboardOperativoDiaColaPendienteItem {
  tipo: string;
  prioridad: string;
  proyectoId: number | null;
  diaId: number | null;
  pedidoId: number | null;
  mensaje: string;
}

export interface DashboardOperativoDiaResponse {
  generatedAt: string;
  fecha: string;
  range: {
    from: string;
    to: string;
    fromYmd: string;
    toYmd: string;
  };
  strictDay: boolean;
  cards: DashboardOperativoDiaCards;
  resumenHoy: DashboardOperativoDiaResumen;
  agendaHoy: {
    total: number;
    items: DashboardOperacionDiaAgendaItem[];
  };
  colaPendientesHoy: {
    total: number;
    items: DashboardOperativoDiaColaPendienteItem[];
  };
  ocupacionHoy: {
    resumen: {
      personasOcupadas: number;
      equiposOcupados: number;
      capacidadStaffTotal: number;
      capacidadEquipoTotal: number;
      porcentajeStaffOcupado: number;
      porcentajeEquipoOcupado: number;
    };
    personas: Array<{
      empleadoId: number;
      empleado: string;
      rol: string | null;
      proyectoId: number | null;
      proyecto: string | null;
      diaId: number | null;
    }>;
    equipos: Array<{
      equipoId: number;
      equipo: string;
      serie: string | null;
      proyectoId: number | null;
      proyecto: string | null;
      diaId: number | null;
    }>;
  };
  capacidadHoy: DashboardCapacidadPorDia;
}
