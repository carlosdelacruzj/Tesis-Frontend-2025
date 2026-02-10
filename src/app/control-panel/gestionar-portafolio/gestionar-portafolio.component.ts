import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import {
  UntypedFormBuilder,
  UntypedFormGroup,
  Validators,
} from '@angular/forms';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { Subject, forkJoin, takeUntil } from 'rxjs';
import Swal from 'sweetalert2/dist/sweetalert2.esm.all.js';
import { TableColumn } from 'src/app/components/table-base/table-base.component';
import { environment } from 'src/environments/environment';
import { PortafolioEvento, PortafolioImagen } from './model/portafolio.model';
import { PortafolioService } from './service/portafolio.service';

interface PortafolioImagenRow extends PortafolioImagen {
  eventoNombre?: string;
  imagenUrl?: string;
}

interface ModalState {
  open: boolean;
  guardando: boolean;
  titulo: string;
  editId: number | null;
  files: File[];
  fileNames: string[];
}

@Component({
  selector: 'app-gestionar-portafolio',
  templateUrl: './gestionar-portafolio.component.html',
  styleUrls: ['./gestionar-portafolio.component.css'],
})
export class GestionarPortafolioComponent implements OnInit, OnDestroy {
  columnasEventos: TableColumn<PortafolioEvento>[] = [
    {
      key: 'iconUrl',
      header: 'Icono',
      sortable: false,
      filterable: false,
      width: '90px',
    },
    { key: 'nombre', header: 'Evento', sortable: true, width: '45%' },
    {
      key: 'mostrarPortafolio',
      header: 'Visible',
      sortable: false,
      filterable: false,
      width: '120px',
      class: 'text-center',
    },
  ];

  eventos: PortafolioEvento[] = [];
  imagenes: PortafolioImagenRow[] = [];
  private imagenesRaw: PortafolioImagen[] = [];

  loadingEventos = false;
  loadingImagenes = false;
  errorEventos: string | null = null;
  errorImagenes: string | null = null;

  filtroEventoId: number | null = null;
  searchTerm = '';
  filePreviews: { name: string; url: string }[] = [];
  galleryItems: PortafolioImagenRow[] = [];
  selectedIds = new Set<number>();
  bulkEventoId: number | null = null;
  soloSinTitulo = false;
  soloSinDescripcion = false;
  pendingOrderChanges = false;
  ordenSyncing = false;
  lightbox: { open: boolean; item: PortafolioImagenRow | null } = {
    open: false,
    item: null,
  };

  form: UntypedFormGroup;
  modal: ModalState = {
    open: false,
    guardando: false,
    titulo: '',
    editId: null,
    files: [],
    fileNames: [],
  };

  private readonly fb = inject(UntypedFormBuilder);
  private readonly portafolioService = inject(PortafolioService);
  private readonly destroy$ = new Subject<void>();
  private readonly assetBase = this.getAssetBase();

  constructor() {
    this.form = this.fb.group({
      eventoId: [null, Validators.required],
      titulo: [''],
      descripcion: [''],
      orden: [null],
    });
  }

  ngOnInit(): void {
    this.loadEventos();
    this.loadImagenes();
  }

  ngOnDestroy(): void {
    this.revokePreviews();
    this.destroy$.next();
    this.destroy$.complete();
  }

  get isUiLocked(): boolean {
    return (
      this.modal.open ||
      this.modal.guardando ||
      this.lightbox.open ||
      this.ordenSyncing
    );
  }

  onSearchChange(term: string): void {
    this.searchTerm = term;
    this.refreshGalleryItems();
  }

  onFiltroEventoChange(eventoId: number | null): void {
    this.filtroEventoId = eventoId;
    this.loadImagenes();
    this.clearSelection();
  }

  onFiltroOpcionalChange(): void {
    this.refreshGalleryItems();
    this.clearSelection();
  }

  abrirCrear(): void {
    this.form.reset({
      eventoId: null,
      titulo: '',
      descripcion: '',
      orden: null,
    });
    this.modal = {
      open: true,
      guardando: false,
      titulo: 'Nueva imagen de portafolio',
      editId: null,
      files: [],
      fileNames: [],
    };
  }

  abrirEditar(row: PortafolioImagenRow): void {
    this.form.reset({
      eventoId: row.eventoId ?? null,
      titulo: row.titulo ?? '',
      descripcion: row.descripcion ?? '',
      orden: row.orden ?? null,
    });
    this.modal = {
      open: true,
      guardando: false,
      titulo: 'Editar imagen de portafolio',
      editId: row.id,
      files: [],
      fileNames: [],
    };
  }

  cerrarModal(): void {
    if (this.modal.guardando) return;
    this.revokePreviews();
    this.modal = {
      ...this.modal,
      open: false,
      editId: null,
      files: [],
      fileNames: [],
    };
  }

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    if (!input?.files?.length) {
      this.modal.files = [];
      this.modal.fileNames = [];
      this.revokePreviews();
      return;
    }
    const archivos = Array.from(input.files);
    this.modal.files = archivos;
    this.modal.fileNames = archivos.map((file) => file.name);
    this.buildPreviews(archivos);
  }

  limpiarArchivo(): void {
    this.modal.files = [];
    this.modal.fileNames = [];
    this.revokePreviews();
  }

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    if (!this.modal.editId && this.modal.files.length === 0) {
      void Swal.fire({
        icon: 'warning',
        title: 'Falta la imagen',
        text: 'Adjunta un archivo antes de guardar.',
      });
      return;
    }

    const payload = this.form.value as {
      eventoId: number;
      titulo?: string;
      descripcion?: string;
      orden?: number;
    };
    this.modal = { ...this.modal, guardando: true };

    const request$ = this.modal.editId
      ? this.portafolioService.actualizarImagen(this.modal.editId, {
          eventoId: payload.eventoId,
          titulo: payload.titulo,
          descripcion: payload.descripcion,
          orden: payload.orden,
          file: this.modal.files[0] ?? null,
        })
      : this.portafolioService.crearImagen({
          eventoId: payload.eventoId,
          tituloBase: payload.titulo,
          descripcion: payload.descripcion,
          ordenBase: payload.orden,
          files: this.modal.files,
        });

    request$.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        void Swal.fire({
          icon: 'success',
          title: this.modal.editId ? 'Imagen actualizada' : 'Imagen registrada',
          confirmButtonText: 'Entendido',
        });
        this.modal = { ...this.modal, guardando: false };
        this.cerrarModal();
        this.loadImagenes();
      },
      error: (err) => {
        console.error('[portafolio] guardar', err);
        this.modal = { ...this.modal, guardando: false };
        void Swal.fire({
          icon: 'error',
          title: 'No se pudo guardar',
          text: 'Revisa los datos e intenta nuevamente.',
          confirmButtonText: 'Entendido',
        });
      },
    });
  }

  async eliminar(row: PortafolioImagenRow): Promise<void> {
    const confirm = await Swal.fire({
      icon: 'warning',
      title: 'Eliminar imagen',
      text: 'Esta accion no se puede deshacer.',
      showCancelButton: true,
      confirmButtonText: 'Si, eliminar',
      cancelButtonText: 'Cancelar',
    });

    if (!confirm.isConfirmed) return;

    this.portafolioService
      .eliminarImagen(row.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          void Swal.fire({
            icon: 'success',
            title: 'Imagen eliminada',
            confirmButtonText: 'Entendido',
          });
          this.loadImagenes();
        },
        error: (err) => {
          console.error('[portafolio] eliminar', err);
          void Swal.fire({
            icon: 'error',
            title: 'No se pudo eliminar',
            text: 'Intenta nuevamente en unos minutos.',
            confirmButtonText: 'Entendido',
          });
        },
      });
  }

  toggleEvento(evento: PortafolioEvento, mostrar: boolean): void {
    const nuevo = mostrar ? 1 : 0;
    this.portafolioService
      .actualizarVisibilidadEvento(evento.id, nuevo)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          evento.mostrarPortafolio = nuevo;
        },
        error: (err) => {
          console.error('[portafolio] visibilidad', err);
          void Swal.fire({
            icon: 'error',
            title: 'No se pudo actualizar',
            text: 'Intenta nuevamente.',
            confirmButtonText: 'Entendido',
          });
        },
      });
  }

  resolveImageUrl(path?: string | null): string {
    if (!path) return 'assets/images/default.jpg';
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    if (path.startsWith('assets/')) return path;
    const normalized = path.startsWith('/') ? path : `/${path}`;
    return `${this.assetBase}${normalized}`;
  }

  private loadEventos(): void {
    this.loadingEventos = true;
    this.errorEventos = null;
    this.portafolioService
      .getEventos()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (lista) => {
          this.eventos = Array.isArray(lista) ? lista : [];
          this.loadingEventos = false;
          this.imagenes = this.decorateImagenes(this.imagenesRaw);
          this.refreshGalleryItems();
        },
        error: (err) => {
          console.error('[portafolio] eventos', err);
          this.errorEventos = 'No pudimos cargar los eventos.';
          this.eventos = [];
          this.loadingEventos = false;
        },
      });
  }

  private loadImagenes(): void {
    this.loadingImagenes = true;
    this.errorImagenes = null;
    this.portafolioService
      .getImagenes(this.filtroEventoId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (lista) => {
          this.imagenesRaw = Array.isArray(lista) ? lista : [];
          this.imagenes = this.decorateImagenes(this.imagenesRaw);
          this.refreshGalleryItems();
          this.loadingImagenes = false;
        },
        error: (err) => {
          console.error('[portafolio] imagenes', err);
          this.errorImagenes = 'No pudimos cargar las imagenes.';
          this.imagenes = [];
          this.imagenesRaw = [];
          this.loadingImagenes = false;
        },
      });
  }

  private decorateImagenes(lista: PortafolioImagen[]): PortafolioImagenRow[] {
    return (lista ?? []).map((item) => ({
      ...item,
      imagenUrl: this.resolveImageUrl(item.url),
      eventoNombre: this.getEventoNombre(item.eventoId),
    }));
  }

  private refreshGalleryItems(): void {
    this.galleryItems = this.getImagenesFiltradasOrdenadas();
    this.pendingOrderChanges = false;
    this.normalizeOrdersIfNeeded();
  }

  private getImagenesFiltradasOrdenadas(): PortafolioImagenRow[] {
    let lista = this.getImagenesFiltradas();
    return lista.slice().sort((a, b) => {
      const ordenA = a.orden ?? 0;
      const ordenB = b.orden ?? 0;
      if (ordenA !== ordenB) return ordenA - ordenB;
      return a.id - b.id;
    });
  }

  private getImagenesFiltradasBase(): PortafolioImagenRow[] {
    let lista = this.imagenes;
    if (this.filtroEventoId != null) {
      lista = lista.filter((item) => item.eventoId === this.filtroEventoId);
    }
    if (this.soloSinTitulo) {
      lista = lista.filter((item) => !item.titulo);
    }
    if (this.soloSinDescripcion) {
      lista = lista.filter((item) => !item.descripcion);
    }
    return lista;
  }

  getImagenesFiltradas(): PortafolioImagenRow[] {
    const term = this.searchTerm.trim().toLowerCase();
    const lista = this.getImagenesFiltradasBase();
    if (!term) return lista;
    return lista.filter((item) => {
      const titulo = (item.titulo ?? '').toString().toLowerCase();
      const descripcion = (item.descripcion ?? '').toString().toLowerCase();
      const evento = (item.eventoNombre ?? '').toString().toLowerCase();
      return (
        titulo.includes(term) ||
        descripcion.includes(term) ||
        evento.includes(term)
      );
    });
  }

  onDrop(event: CdkDragDrop<PortafolioImagenRow[]>): void {
    if (!this.filtroEventoId) {
      void Swal.fire({
        icon: 'info',
        title: 'Selecciona un evento',
        text: 'Para reordenar primero filtra por un evento especifico.',
      });
      return;
    }
    if (!this.galleryItems.length) return;
    moveItemInArray(this.galleryItems, event.previousIndex, event.currentIndex);
    this.galleryItems.forEach((item, index) => {
      item.orden = index + 1;
    });
    this.pendingOrderChanges = true;
  }

  guardarOrden(): void {
    if (!this.pendingOrderChanges || !this.galleryItems.length) return;
    const updates = this.galleryItems.map((item) =>
      this.portafolioService.actualizarImagen(item.id, {
        orden: item.orden ?? null,
      }),
    );
    this.ordenSyncing = true;
    forkJoin(updates)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.pendingOrderChanges = false;
          this.ordenSyncing = false;
          void Swal.fire({ icon: 'success', title: 'Orden actualizado' });
          this.loadImagenes();
        },
        error: (err) => {
          console.error('[portafolio] orden', err);
          this.ordenSyncing = false;
          void Swal.fire({
            icon: 'error',
            title: 'No se pudo guardar el orden',
          });
        },
      });
  }

  toggleSeleccion(row: PortafolioImagenRow): void {
    if (this.selectedIds.has(row.id)) {
      this.selectedIds.delete(row.id);
    } else {
      this.selectedIds.add(row.id);
    }
  }

  isSeleccionada(row: PortafolioImagenRow): boolean {
    return this.selectedIds.has(row.id);
  }

  seleccionarTodo(): void {
    this.clearSelection();
    this.galleryItems.forEach((item) => this.selectedIds.add(item.id));
  }

  clearSelection(): void {
    this.selectedIds.clear();
    this.bulkEventoId = null;
  }

  getEventosParaMover(): PortafolioEvento[] {
    const selectedEventoId = this.getEventoIdSeleccionUnica();
    if (selectedEventoId == null) return this.eventos;
    return this.eventos.filter((evento) => evento.id !== selectedEventoId);
  }

  private getEventoIdSeleccionUnica(): number | null {
    if (this.selectedIds.size === 0) return null;
    let current: number | null = null;
    for (const id of this.selectedIds) {
      const item = this.imagenes.find((img) => img.id === id);
      if (!item) continue;
      if (current == null) {
        current = item.eventoId;
      } else if (current !== item.eventoId) {
        return null;
      }
    }
    return current;
  }

  async eliminarSeleccionadas(): Promise<void> {
    if (this.selectedIds.size === 0) return;
    const confirm = await Swal.fire({
      icon: 'warning',
      title: 'Eliminar seleccion',
      text: `Se eliminaran ${this.selectedIds.size} imágenes.`,
      showCancelButton: true,
      confirmButtonText: 'Si, eliminar',
      cancelButtonText: 'Cancelar',
    });
    if (!confirm.isConfirmed) return;
    const updates = Array.from(this.selectedIds).map((id) =>
      this.portafolioService.eliminarImagen(id),
    );
    forkJoin(updates)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          void Swal.fire({ icon: 'success', title: 'Imágenes eliminadas' });
          this.clearSelection();
          this.loadImagenes();
        },
        error: (err) => {
          console.error('[portafolio] eliminar seleccion', err);
          void Swal.fire({ icon: 'error', title: 'No se pudo eliminar' });
        },
      });
  }

  moverSeleccionadas(): void {
    if (this.selectedIds.size === 0) return;
    if (this.bulkEventoId == null) {
      void Swal.fire({ icon: 'info', title: 'Selecciona un evento destino' });
      return;
    }
    const updates = Array.from(this.selectedIds).map((id) =>
      this.portafolioService.actualizarImagen(id, {
        eventoId: this.bulkEventoId,
      }),
    );
    forkJoin(updates)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          void Swal.fire({ icon: 'success', title: 'Imágenes actualizadas' });
          this.clearSelection();
          this.loadImagenes();
        },
        error: (err) => {
          console.error('[portafolio] mover seleccion', err);
          void Swal.fire({ icon: 'error', title: 'No se pudo actualizar' });
        },
      });
  }

  abrirLightbox(row: PortafolioImagenRow): void {
    this.lightbox = { open: true, item: row };
  }

  cerrarLightbox(): void {
    this.lightbox = { open: false, item: null };
  }

  private getEventoNombre(eventoId: number): string {
    const found = this.eventos.find((evt) => evt.id === eventoId);
    return found?.nombre ?? `Evento ${eventoId}`;
  }

  private getAssetBase(): string {
    const raw = environment.baseUrl;
    const normalized =
      raw.startsWith('http://') || raw.startsWith('https://')
        ? raw
        : `http://${raw}`;
    try {
      return normalized.replace(/\/api\/v1\/?$/, '').replace(/\/$/, '');
    } catch (error) {
      console.warn('[portafolio] baseUrl invalida, usando fallback', error);
      return normalized.replace(/\/api\/v1\/?$/, '');
    }
  }

  private buildPreviews(files: File[]): void {
    this.revokePreviews();
    this.filePreviews = files.map((file) => ({
      name: file.name,
      url: URL.createObjectURL(file),
    }));
  }

  private revokePreviews(): void {
    this.filePreviews.forEach((preview) => URL.revokeObjectURL(preview.url));
    this.filePreviews = [];
  }

  onImagenError(row: PortafolioImagenRow): void {
    console.warn('[portafolio] imagen no carga', row.imagenUrl || row.url);
    row.imagenUrl = 'assets/images/default.jpg';
  }

  private normalizeOrdersIfNeeded(): void {
    if (
      !this.filtroEventoId ||
      this.ordenSyncing ||
      this.galleryItems.length === 0
    )
      return;
    const changes: { id: number; orden: number }[] = [];
    this.galleryItems.forEach((item, index) => {
      const nuevoOrden = index + 1;
      if (item.orden !== nuevoOrden) {
        item.orden = nuevoOrden;
        changes.push({ id: item.id, orden: nuevoOrden });
      }
    });
    if (changes.length === 0) return;
    this.ordenSyncing = true;
    const updates = changes.map((item) =>
      this.portafolioService.actualizarImagen(item.id, { orden: item.orden }),
    );
    forkJoin(updates)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.ordenSyncing = false;
          this.pendingOrderChanges = false;
        },
        error: (err) => {
          console.error('[portafolio] normalizar orden', err);
          this.ordenSyncing = false;
          this.pendingOrderChanges = true;
        },
      });
  }

  onEventoIconError(evento: PortafolioEvento): void {
    console.warn('[portafolio] icono evento no carga', evento.iconUrl);
    evento.iconUrl = 'assets/images/default.jpg';
  }
}
