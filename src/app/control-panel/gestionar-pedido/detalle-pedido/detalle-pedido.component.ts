import { Component, OnInit, ViewChild, AfterViewInit } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { PedidoService } from '../service/pedido.service';
import { VisualizarService } from '../service/visualizar.service';
import Swal from 'sweetalert2/dist/sweetalert2.esm.all.js';
import { MatSort } from '@angular/material/sort';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ActivatedRoute, Router } from '@angular/router';
import { formatDisplayDate, parseDateInput } from '../../../shared/utils/date-utils';

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
  Direccion: string = '';
  DireccionExacta: string = '';
  NotasEvento: string = '';
  // ====== Catálogos (solo para mostrar combos deshabilitados) ======
  servicios: any[] = [];
  evento: any[] = [];
  servicioSeleccionado = 1;
  eventoSeleccionado = 1;

  dataSource: MatTableDataSource<any> = new MatTableDataSource<any>([]);
  dataSource1: MatTableDataSource<any> = new MatTableDataSource<any>([]);

  @ViewChild('sortUbic') sortUbic!: MatSort;
  @ViewChild('sortPaq') sortPaq!: MatSort;

  private bindSorts() {
    if (this.sortUbic) this.dataSource.sort = this.sortUbic;
    if (this.sortPaq) this.dataSource1.sort = this.sortPaq;
  }

  // ====== Estado general ======
  CodigoEmpleado: number = 1;
  infoCliente = { nombre: '-', apellido: '-', celular: '-', correo: '-', documento: '-', direccion: '-', idCliente: 0, idUsuario: 0 };
  dniCliente: any;

  // ====== Fechas visibles ======
  fechaCreate: Date = new Date();
  minimo = '';
  maximo = '';

  // ====== Ubicaciones ======
  ubicacion: Array<{ ID: number; dbId: number; Direccion: string; Fecha: string; Hora: string; DireccionExacta: string; Notas: string; }> = [];

  // ====== Paquetes seleccionados (solo para mostrar) ======
  selectedPaquetes: Array<{
    id?: number;
    key: string | number;
    eventKey: string | number | null;
    ID?: number;
    descripcion: string;
    precio: number;
    notas: string;
  }> = [];

  // ====== Pedido actual ======
  private pedidoId!: number;

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

  constructor(
    public pedidoService: PedidoService,
    public visualizarService: VisualizarService,
    private route: ActivatedRoute,
    private router: Router,
  ) { }

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
    const obs: any = this.pedidoService.getServicios?.();
    if (!obs || typeof obs.subscribe !== 'function') { this.servicios = []; return; }
    obs.pipe(catchError(() => of([]))).subscribe((res: any) => { this.servicios = res ?? []; });
  }

  getEventos() {
    const obs: any = this.pedidoService.getEventos?.();
    if (!obs || typeof obs.subscribe !== 'function') { this.evento = []; return; }
    obs.pipe(catchError(() => of([]))).subscribe((res: any) => { this.evento = res ?? []; });
  }

  getEventoxServicio() {
    const obs: any = this.visualizarService?.getEventosServicio?.(this.eventoSeleccionado, this.servicioSeleccionado);
    if (!obs || typeof obs.subscribe !== 'function') { this.dataSource1.data = []; this.bindSorts(); return; }
    obs.pipe(catchError(() => of([]))).subscribe((res: any) => {
      this.dataSource1.data = res ?? [];
      this.bindSorts();
    });
  }

  // ====== Carga del pedido existente (solo mapeo) ======
  private loadPedido(id: number) {
    const obs: any = this.visualizarService.getPedidoById?.(id);
    if (!obs || typeof obs.subscribe !== 'function') return;

    obs.pipe(
      catchError((err: any) => {
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
    ).subscribe((data: any) => {
      if (!data) return;

      const cab = data.pedido || data;
      this.visualizarService.selectAgregarPedido.NombrePedido = cab?.nombrePedido ?? cab?.nombre ?? '';
      this.visualizarService.selectAgregarPedido.Observacion = cab?.observaciones ?? '';
      this.CodigoEmpleado = cab?.empleadoId ?? this.CodigoEmpleado;
      const fechaCreacionParsed = parseDateInput(cab?.fechaCreacion) ?? new Date();
      this.fechaCreate = fechaCreacionParsed;
      this.visualizarService.selectAgregarPedido.fechaCreate = formatDisplayDate(fechaCreacionParsed, '');

      // Cliente
      this.infoCliente = {
        nombre: cab?.cliente?.nombres ?? '-',
        apellido: cab?.cliente?.apellidos ?? '-',
        celular: cab?.cliente?.celular ?? '-',
        correo: cab?.cliente?.correo ?? '-',
        documento: cab?.cliente?.documento ?? '-',
        direccion: cab?.cliente?.direccion ?? '-',
        idCliente: cab?.clienteId ?? cab?.cliente?.id ?? 0,
        idUsuario: 0
      };
      this.dniCliente = this.infoCliente.documento || '';

      // Eventos
      this.ubicacion = (data.eventos || []).map((e: any, idx: number) => ({
        ID: idx + 1,
        dbId: e.id ?? e.dbId ?? 0,
        Direccion: e.ubicacion ?? '',
        Fecha: String(e.fecha).slice(0, 10),
        Hora: String(e.hora).slice(0, 5),
        DireccionExacta: e.direccion ?? '',
        Notas: e.notas ?? ''
      }));
      this.dataSource.data = this.ubicacion;
      this.bindSorts();

      // Items/paquetes seleccionados (para mostrar tabla resumen)
      this.selectedPaquetes = (data.items || []).map((it: any) => ({
        id: it.id,
        key: it.exsId ?? it.id ?? `${it.nombre ?? it.descripcion}|${it.precioUnit ?? it.precio ?? 0}`,
        eventKey: it.eventoCodigo ?? null,
        ID: it.exsId ?? it.id ?? null,
        descripcion: it.nombre ?? it.descripcion ?? '',
        precio: Number(it.precioUnit ?? it.precio ?? 0),
        notas: it.notas ?? ''
      }));
    });
  }

  // ====== Helpers de plantilla (solo lectura) ======
  get totalSeleccion(): number {
    return this.selectedPaquetes.reduce((sum, p) => sum + (+p.precio || 0), 0);
  }
}
