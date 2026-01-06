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
  ID?: number;
  descripcion: string;
  precio: number;
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

  // ====== Pedido actual ======
  private pedidoId!: number;
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
      this.servicios = this.toRecordArray(res);
    });
  }

  getEventos() {
    const obs = this.pedidoService.getEventos?.() as Observable<unknown> | undefined;
    if (!obs) {
      this.evento = [];
      return;
    }
    obs.pipe(catchError(() => of([]))).subscribe((res) => {
      this.evento = this.toRecordArray(res);
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
      this.dataSource1.data = this.toRecordArray(res);
      this.bindSorts();
    });
  }

  // ====== Carga del pedido existente (solo mapeo) ======
  private loadPedido(id: number) {
    const obs = this.visualizarService.getPedidoById?.(id) as Observable<unknown> | undefined;
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

      const payload = this.asRecord(data);
      const cab = this.asRecord(payload['pedido'] ?? payload);
      this.visualizarService.selectAgregarPedido.NombrePedido =
        this.toOptionalString(cab['nombrePedido'] ?? cab['nombre']) ?? '';
      this.visualizarService.selectAgregarPedido.Observacion =
        this.toOptionalString(cab['observaciones']) ?? '';
      this.CodigoEmpleado = this.toNumber(cab['empleadoId']) ?? this.CodigoEmpleado;
      const fechaCreacionParsed = parseDateInput(this.toDateInput(cab['fechaCreacion'])) ?? new Date();
      this.fechaCreate = fechaCreacionParsed;
      this.visualizarService.selectAgregarPedido.fechaCreate = formatDisplayDate(fechaCreacionParsed, '');

      // Cliente
      const cliente = this.asRecord(cab['cliente']);
      this.infoCliente = {
        nombre: this.toOptionalString(cliente['nombres']) ?? '-',
        apellido: this.toOptionalString(cliente['apellidos']) ?? '-',
        celular: this.toOptionalString(cliente['celular']) ?? '-',
        correo: this.toOptionalString(cliente['correo']) ?? '-',
        documento: this.toOptionalString(cliente['documento']) ?? '-',
        direccion: this.toOptionalString(cliente['direccion']) ?? '-',
        idCliente: this.toNumber(cab['clienteId']) ?? this.toNumber(cliente['id']) ?? 0,
        idUsuario: 0
      };
      this.dniCliente = this.infoCliente.documento || '';

      // Eventos
      const eventos = this.toRecordArray(payload['eventos']);
      this.ubicacion = eventos.map((item, idx) => {
        const e = this.asRecord(item);
        return {
          ID: idx + 1,
          dbId: Number(e['id'] ?? e['dbId'] ?? 0) || 0,
          Direccion: String(e['ubicacion'] ?? ''),
          Fecha: String(e['fecha'] ?? '').slice(0, 10),
          Hora: String(e['hora'] ?? '').slice(0, 5),
          DireccionExacta: String(e['direccion'] ?? ''),
          Notas: String(e['notas'] ?? '')
        };
      });
      this.dataSource.data = this.ubicacion;
      this.bindSorts();

      // Items/paquetes seleccionados (para mostrar tabla resumen)
      const items = this.toRecordArray(payload['items']);
      this.selectedPaquetes = items.map((item) => {
        const it = this.asRecord(item);
        const key =
          (it['exsId'] as string | number | undefined) ??
          (it['id'] as string | number | undefined) ??
          `${this.toOptionalString(it['nombre'] ?? it['descripcion']) ?? ''}|${it['precioUnit'] ?? it['precio'] ?? 0}`;
        const eventKey =
          (it['eventoCodigo'] as string | number | undefined) ??
          (it['evento_codigo'] as string | number | undefined) ??
          null;
        return {
          id: this.toNumber(it['id']),
          key,
          eventKey,
          ID: (it['exsId'] as number | undefined) ?? this.toNumber(it['id']) ?? undefined,
          descripcion: String(it['nombre'] ?? it['descripcion'] ?? ''),
          precio: Number(it['precioUnit'] ?? it['precio'] ?? 0),
          notas: String(it['notas'] ?? '')
        };
      });
    });
  }

  // ====== Helpers de plantilla (solo lectura) ======
  get totalSeleccion(): number {
    return this.selectedPaquetes.reduce((sum, p) => sum + (+p.precio || 0), 0);
  }

  private asRecord(value: unknown): AnyRecord {
    return value && typeof value === 'object' ? (value as AnyRecord) : {};
  }

  private toRecordArray(value: unknown): AnyRecord[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.filter(Boolean).map(item => this.asRecord(item));
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

  private toNumber(value: unknown): number | undefined {
    if (value === null || value === undefined) {
      return undefined;
    }
    const num = Number(value);
    return Number.isFinite(num) ? num : undefined;
  }
}
