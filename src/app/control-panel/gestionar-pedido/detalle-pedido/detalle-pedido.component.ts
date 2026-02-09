import { AfterViewInit, Component, OnInit, ViewChild, inject } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { PedidoService } from '../service/pedido.service';
import { VisualizarService } from '../service/visualizar.service';
import Swal from 'sweetalert2/dist/sweetalert2.esm.all.js';
import { MatSort } from '@angular/material/sort';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ActivatedRoute, Router } from '@angular/router';
import { DateInput, formatDisplayDate, parseDateInput } from '../../../shared/utils/date-utils';
import { PedidoResponse } from '../model/visualizar.model';
import { TableColumn } from 'src/app/components/table-base/table-base.component';

type AnyRecord = Record<string, unknown>;

interface UbicacionRow {
  ID: number;
  dbId: number;
  Direccion: string;
  Fecha: string;
  Hora: string;
  DireccionExacta: string;
  Notas: string;
}

interface PaqueteResumenRow {
  id?: number;
  key: string | number;
  eventKey: string | number | null;
  idEventoServicio?: number | null;
  eventoId?: number | null;
  ID?: number;
  servicioId?: number | null;
  titulo: string;
  descripcion: string;
  precio: number;
  precioOriginal?: number;
  cantidad?: number;
  horas?: number | null;
  personal?: number | null;
  notas: string;
}

@Component({
  selector: 'app-detalle-pedido',
  templateUrl: './detalle-pedido.component.html',
  styleUrls: ['./detalle-pedido.component.css']
})
export class DetallePedidoComponent implements OnInit, AfterViewInit {
  // ====== Columnas (solo lectura) ======
  columnsToDisplay = ['Nro', 'Fecha', 'Hora', 'Direccion', 'DireccionExacta', 'Notas']; // sin Editar/Quitar
  columnsToDisplay1 = ['Descripcion', 'Precio']; // sin Seleccionar
  // Campos “sólo lectura” para los inputs de cabecera de evento
  Direccion = '';
  DireccionExacta = '';
  NotasEvento = '';
  // ====== Catálogos (solo para mostrar combos deshabilitados) ======
  servicios: AnyRecord[] = [];
  evento: AnyRecord[] = [];
  servicioSeleccionado = 1;
  eventoSeleccionado = 1;

  dataSource: MatTableDataSource<UbicacionRow> = new MatTableDataSource<UbicacionRow>([]);
  dataSource1: MatTableDataSource<AnyRecord> = new MatTableDataSource<AnyRecord>([]);

  @ViewChild('sortUbic') sortUbic!: MatSort;
  @ViewChild('sortPaq') sortPaq!: MatSort;

  private bindSorts() {
    if (this.sortUbic) this.dataSource.sort = this.sortUbic;
    if (this.sortPaq) this.dataSource1.sort = this.sortPaq;
  }

  // ====== Estado general ======
  CodigoEmpleado = 1;
  infoCliente = { nombre: '-', apellido: '-', celular: '-', correo: '-', documento: '-', direccion: '-', idCliente: 0, idUsuario: 0 };
  dniCliente = '';

  // ====== Fechas visibles ======
  fechaCreate = new Date();
  minimo = '';
  maximo = '';

  // ====== Ubicaciones ======
  ubicacion: UbicacionRow[] = [];

  // ====== Paquetes seleccionados (solo para mostrar) ======
  selectedPaquetes: PaqueteResumenRow[] = [];
  selectedPaquetesColumns: TableColumn<PaqueteResumenRow>[] = [
    { key: 'titulo', header: 'Titulo', sortable: false, width: '30%' },
    { key: 'cantidad', header: 'Cantidad', sortable: false, class: 'text-center', width: '100px' },
    { key: 'precioUnit', header: 'Precio unit.', sortable: false, class: 'text-center', width: '140px' },
    { key: 'horas', header: 'Horas', sortable: false, class: 'text-center', width: '90px' },
    { key: 'staff', header: 'Staff', sortable: false, class: 'text-center', width: '90px' },
    { key: 'subtotal', header: 'Subtotal', sortable: false, class: 'text-center', width: '140px' },
    { key: 'notas', header: 'Notas', sortable: false, width: '24%' }
  ];

  // ====== Pedido actual ======
  private pedidoId!: number;
  pedidoSubtotal = 0;
  pedidoIgv = 0;
  pedidoTotal = 0;
  private readonly pedidoService = inject(PedidoService);
  readonly visualizarService = inject(VisualizarService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private toOptionalString(value: unknown): string | undefined {
    if (value == null) {
      return undefined;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed ? trimmed : undefined;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
    return undefined;
  }

  get clienteNombreCompleto(): string {
    const nombre = this.toOptionalString(this.infoCliente?.nombre);
    const apellido = this.toOptionalString(this.infoCliente?.apellido);
    const texto = [nombre, apellido].filter(Boolean).join(' ').trim();
    return texto || '-';
  }

  get clienteDocumento(): string {
    return (
      this.toOptionalString(this.infoCliente?.documento) ??
      this.toOptionalString(this.dniCliente) ??
      '-'
    );
  }

  get clienteCelular(): string {
    return this.toOptionalString(this.infoCliente?.celular) ?? '-';
  }

  // ====== Ciclo de vida ======
  ngOnInit(): void {
    this.pedidoId = +(this.route.snapshot.paramMap.get('id') || 0);
    if (!this.pedidoId) {
      Swal.fire({
        text: 'ID de pedido inválido.',
        icon: 'error',
        showCancelButton: false,
        customClass: { confirmButton: 'btn btn-danger' },
        buttonsStyling: false
      });
      this.router.navigate(['/home/gestionar-pedido']);
      return;
    }

    // Opcional: cargar catálogos para combos deshabilitados
    this.getServicio();
    this.getEventos();
    this.getEventoxServicio();

    // Inicializa cabecera visible
    this.visualizarService.selectAgregarPedido.fechaCreate = formatDisplayDate(this.fechaCreate, '');
    this.fechaValidate(this.fechaCreate);

    // Cargar el pedido existente (solo para ver)
    this.loadPedido(this.pedidoId);
  }

  ngAfterViewInit(): void {
    this.bindSorts();
  }

  // ====== Utiles fecha/hora ======
  fechaValidate(date: Date) {
    this.minimo = this.addDaysToDate(date, -365);
    this.maximo = this.addDaysToDate(date, 365);
  }

  convert(strOrDate: string | Date) {
    const parsed = parseDateInput(strOrDate) ?? new Date();
    const mnth = ('0' + (parsed.getMonth() + 1)).slice(-2);
    const day = ('0' + parsed.getDate()).slice(-2);
    return [parsed.getFullYear(), mnth, day].join('-');
  }

  addDaysToDate(date: Date, days: number) {
    const res = new Date(date);
    res.setDate(res.getDate() + days);
    return this.convert(res);
  }

  weekdayPeru(fechaISO: string): string {
    const parsed = parseDateInput(fechaISO);
    if (!parsed) {
      return '';
    }
    const midDay = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 12, 0, 0);
    const fmt = new Intl.DateTimeFormat('es-PE', { weekday: 'short', timeZone: 'America/Lima' });
    return fmt.format(midDay);
  }

  formatProgramDate(value: string | Date): string {
    return formatDisplayDate(value, '');
  }

  // ====== Catálogos (solo carga) ======
  getServicio() {
    const obs = this.pedidoService.getServicios?.() as Observable<unknown> | undefined;
    if (!obs) {
      this.servicios = [];
      return;
    }
    obs.pipe(catchError(() => of([]))).subscribe((res) => {
      this.servicios = Array.isArray(res) ? (res as AnyRecord[]) : [];
    });
  }

  getEventos() {
    const obs = this.pedidoService.getEventos?.() as Observable<unknown> | undefined;
    if (!obs) {
      this.evento = [];
      return;
    }
    obs.pipe(catchError(() => of([]))).subscribe((res) => {
      this.evento = Array.isArray(res) ? (res as AnyRecord[]) : [];
    });
  }

  getEventoxServicio() {
    const obs = this.visualizarService?.getEventosServicio?.(this.eventoSeleccionado, this.servicioSeleccionado) as Observable<unknown> | undefined;
    if (!obs) {
      this.dataSource1.data = [];
      this.bindSorts();
      return;
    }
    obs.pipe(catchError(() => of([]))).subscribe((res) => {
      this.dataSource1.data = Array.isArray(res) ? (res as AnyRecord[]) : [];
      this.bindSorts();
    });
  }

  // ====== Carga del pedido existente (solo mapeo) ======
  private loadPedido(id: number) {
    const obs = this.visualizarService.getPedidoById?.(id) as Observable<PedidoResponse> | undefined;
    if (!obs) {
      return;
    }

    obs.pipe(
      catchError((err) => {
        console.error('[getPedidoById] error', err);
        Swal.fire({
          text: 'No se pudo cargar el pedido.',
          icon: 'error',
          showCancelButton: false,
          customClass: { confirmButton: 'btn btn-danger' },
          buttonsStyling: false
        });
        return of(null);
      })
    ).subscribe((data) => {
      if (!data) {
        return;
      }

      const { pedido, eventos, items } = data;
      this.pedidoSubtotal = Number(pedido.subtotal ?? 0) || 0;
      this.pedidoIgv = Number(pedido.igv ?? 0) || 0;
      this.pedidoTotal = Number(pedido.total ?? 0) || 0;
      this.visualizarService.selectAgregarPedido.NombrePedido = pedido.nombrePedido ?? '';
      this.visualizarService.selectAgregarPedido.Observacion = pedido.observaciones ?? '';
      this.visualizarService.selectAgregarPedido.mensaje = pedido.mensaje ?? '';
      this.visualizarService.selectAgregarPedido.departamento = pedido.lugar ?? '';
      this.visualizarService.selectAgregarPedido.dias = pedido.dias ?? 1;
      this.visualizarService.selectAgregarPedido.horasEstimadas = pedido.horasEstimadas ?? null;
      this.visualizarService.selectAgregarPedido.fechaEvent = (pedido.fechaEvento ?? '').slice(0, 10);
      const viaticosClienteApi = typeof pedido.viaticosCliente === 'boolean'
        ? pedido.viaticosCliente
        : !(pedido.viaticosMonto && pedido.viaticosMonto > 0);
      this.visualizarService.selectAgregarPedido.viaticosCliente = viaticosClienteApi;
      this.visualizarService.selectAgregarPedido.viaticosMonto = pedido.viaticosMonto ?? null;
      this.CodigoEmpleado = pedido.empleadoId ?? this.CodigoEmpleado;
      this.eventoSeleccionado = pedido.idTipoEvento ?? this.eventoSeleccionado;
      const fechaCreacionParsed = parseDateInput(this.toDateInput(pedido.fechaCreacion)) ?? new Date();
      this.fechaCreate = fechaCreacionParsed;
      this.visualizarService.selectAgregarPedido.fechaCreate = formatDisplayDate(fechaCreacionParsed, '');

      // Cliente
      const cliente = pedido.cliente;
      this.infoCliente = {
        nombre: cliente.nombres ?? '-',
        apellido: cliente.apellidos ?? '-',
        celular: cliente.celular ?? '-',
        correo: cliente.correo ?? '-',
        documento: cliente.documento ?? '-',
        direccion: cliente.direccion ?? '-',
        idCliente: pedido.clienteId ?? 0,
        idUsuario: 0
      };
      this.dniCliente = this.infoCliente.documento || '';

      // Eventos
      this.ubicacion = eventos.map((item, idx) => ({
        ID: idx + 1,
        dbId: item.id ?? 0,
        Direccion: item.ubicacion ?? '',
        Fecha: (item.fecha ?? '').slice(0, 10),
        Hora: (item.hora ?? '').slice(0, 5),
        DireccionExacta: item.direccion ?? '',
        Notas: item.notas ?? ''
      }));
      this.dataSource.data = this.ubicacion;
      this.bindSorts();

      // Items/paquetes seleccionados (para mostrar tabla resumen)
      this.selectedPaquetes = items.map((it) => ({
        id: it.id ?? undefined,
        key: it.id ?? `${it.nombre}|${it.precioUnit}`,
        eventKey: it.eventoCodigo ?? null,
        idEventoServicio: it.idEventoServicio ?? null,
        eventoId: it.eventoId ?? null,
        ID: it.id ?? undefined,
        servicioId: it.servicioId ?? null,
        titulo: it.nombre ?? it.descripcion ?? '',
        descripcion: it.nombre ?? it.descripcion ?? '',
        precio: it.precioUnit ?? 0,
        precioOriginal: it.precioUnit ?? 0,
        cantidad: it.cantidad ?? 1,
        horas: it.horas ?? null,
        personal: it.personal ?? null,
        notas: it.notas ?? ''
      }));

      const servicioDesdeItems = this.selectedPaquetes.find(item => item.servicioId != null)?.servicioId ?? null;
      if (servicioDesdeItems != null) {
        this.servicioSeleccionado = servicioDesdeItems;
      }
    });
  }

  // ====== Helpers de plantilla (solo lectura) ======
  get totalSeleccion(): number {
    const subtotal = this.selectedPaquetes.reduce((sum, p) => {
      const precio = Number(p.precio) || 0;
      const cantidad = Number(p.cantidad ?? 1) || 1;
      return sum + (precio * cantidad);
    }, 0);
    return subtotal + this.getViaticosMontoTotal();
  }

  private getViaticosMontoTotal(): number {
    const departamento = (this.visualizarService.selectAgregarPedido?.departamento ?? '').toString().trim().toLowerCase();
    if (departamento === 'lima') {
      return 0;
    }
    const viaticosCliente = Boolean(this.visualizarService.selectAgregarPedido?.viaticosCliente);
    if (viaticosCliente) {
      return 0;
    }
    const monto = this.visualizarService.selectAgregarPedido?.viaticosMonto;
    return monto != null && monto > 0 ? monto : 0;
  }

  private toDateInput(value: unknown): DateInput {
    if (value instanceof Date) {
      return value;
    }
    if (typeof value === 'string' || typeof value === 'number') {
      return value;
    }
    return null;
  }

}
