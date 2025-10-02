import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject, of } from 'rxjs';
import { catchError, switchMap, take, takeUntil, tap } from 'rxjs/operators';

import { PedidoService } from 'src/app/control-panel/gestionar-pedido/service/pedido.service';
import { VisualizarService } from 'src/app/control-panel/gestionar-pedido/service/visualizar.service';
import { ClienteService } from 'src/app/control-panel/gestionar-cliente/service/cliente.service';
import { Cliente } from 'src/app/control-panel/gestionar-cliente/model/cliente.model';

@Component({
  selector: 'app-quote-request',
  templateUrl: './quote-request.component.html',
  styleUrls: ['./quote-request.component.css']
})
export class QuoteRequestComponent implements OnInit, OnDestroy {

  sending = false;
  success = false;

  eventos: any[] = [];

  clienteEncontrado: Cliente | null = null;

  readonly quoteForm = this.fb.group({
    nombre: ['', [Validators.required, Validators.minLength(2)]],
    contacto: ['', [Validators.required, Validators.pattern(/^[0-9+()\s-]{6,}$/)]],
    eventoId: [null, Validators.required],
    eventoOtro: [''],
    lugar: ['', Validators.required],
    duracion: ['', Validators.required]
  });

  readonly OTROS_EVENTO_ID = 'otros';
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly fb: FormBuilder,
    private readonly pedidoService: PedidoService,
    private readonly visualizarService: VisualizarService,
    private readonly clienteService: ClienteService,
    private readonly snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.cargarEventos();
    this.setupEventoOtroWatcher();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  submit(): void {
    if (this.quoteForm.invalid) {
      this.quoteForm.markAllAsTouched();
      this.snackBar.open('Por favor completa los campos obligatorios.', 'Cerrar', { duration: 4000 });
      return;
    }

    this.sending = true;
    this.success = false;

    this.ensureCliente()
      .pipe(
        switchMap((clienteId) => this.enviarCotizacion(clienteId)),
        take(1),
        catchError(err => {
          console.error('[cotizacion] error', err);
          this.snackBar.open('No pudimos registrar tu solicitud. Intenta nuevamente.', 'Cerrar', { duration: 5000 });
          return of(null);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe((res) => {
        this.sending = false;
        if (!res) return;
        this.success = true;
        this.quoteForm.reset();
        this.snackBar.open('¡Gracias! Recibimos tu solicitud y te contactaremos pronto.', 'Cerrar', { duration: 5000 });
      });
  }

  hasError(path: string, error: string): boolean {
    const control = this.quoteForm.get(path);
    return !!control && control.touched && control.hasError(error);
  }

  private cargarEventos(): void {
    this.pedidoService.getEventos()
      .pipe(
        takeUntil(this.destroy$),
        catchError(err => {
          console.error('[cotizacion] getEventos', err);
          return of([]);
        })
      )
      .subscribe(res => {
        const normalizados = Array.isArray(res) ? res.map(ev => ({
          id: ev?.id ?? ev?.PK_E_Cod ?? ev?.pk ?? ev?.codigo ?? null,
          nombre: ev?.nombre ?? ev?.E_Nombre ?? ev?.descripcion ?? 'Evento'
        })).filter(ev => ev.id != null) : [];
        this.eventos = [...normalizados, { id: this.OTROS_EVENTO_ID, nombre: 'Otros' }];
        console.log('[cotizacion] eventos recibidos', this.eventos);
      });
  }

  private setupEventoOtroWatcher(): void {
    const eventoControl = this.quoteForm.get('eventoId');
    const otroControl = this.quoteForm.get('eventoOtro');
    if (!eventoControl || !otroControl) return;

    eventoControl.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(value => {
        if (value === this.OTROS_EVENTO_ID) {
          otroControl.addValidators([Validators.required, Validators.minLength(3)]);
        } else {
          otroControl.clearValidators();
          otroControl.reset('', { emitEvent: false });
        }
        otroControl.updateValueAndValidity({ emitEvent: false });
      });
  }

  private ensureCliente() {
    const formValue = this.quoteForm.getRawValue();

    const payload = {
      nombre: formValue.nombre,
      apellido: '',
      correo: '',
      numDoc: '',
      celular: formValue.contacto,
      direccion: ''
    };

    return this.clienteService.addCliente(payload).pipe(
      take(1),
      tap(res => {
        const id = res?.id || res?.idCliente || res?.ID;
        this.clienteEncontrado = {
          idCliente: id ?? 0,
          codigoCliente: res?.codigoCliente ?? '',
          nombre: payload.nombre,
          apellido: payload.apellido,
          correo: '',
          celular: payload.celular,
          doc: '',
          direccion: payload.direccion,
          estado: 'Pendiente',
          ECli_Nombre: ''
        } as Cliente;
      }),
      switchMap(res => {
        const id = res?.id || res?.idCliente || res?.ID || this.clienteEncontrado?.idCliente;
        if (!id) {
          throw new Error('No se pudo registrar el cliente.');
        }
        return of(id);
      })
    );
  }

  private enviarCotizacion(clienteId: number) {
    const { nombre, contacto, eventoId, eventoOtro, lugar, duracion } = this.quoteForm.getRawValue();
    const eventoNombre = this.resolveEventoNombre(eventoId, eventoOtro);

    const eventos = [{
      fecha: new Date().toISOString().slice(0, 10),
      hora: '00:00:00',
      ubicacion: lugar,
      direccion: lugar,
      notas: `Duración estimada: ${duracion}`
    }];

    const observaciones = [
      `Tipo de evento: ${eventoNombre}`,
      `Duración: ${duracion}`,
      `Contacto: ${contacto}`
    ].join(' | ');

    const payload = {
      pedido: {
        clienteId,
        empleadoId: 1,
        fechaCreacion: new Date().toISOString().slice(0, 10),
        observaciones,
        estadoPedidoId: 1,
        estadoPagoId: 1,
        nombrePedido: `Cotización de ${nombre}`
      },
      eventos,
      items: []
    };

    return this.visualizarService.postPedidos(payload);
  }

  private resolveEventoNombre(eventoId: any, eventoOtro: string): string {
    if (eventoId === this.OTROS_EVENTO_ID) {
      return eventoOtro?.trim() || 'Otro evento';
    }

    const encontrado = this.eventos.find(ev => ev.id === eventoId);
    return encontrado?.nombre || 'Evento sin especificar';
  }

}
