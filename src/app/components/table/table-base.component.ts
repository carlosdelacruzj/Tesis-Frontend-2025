import {
    Component,
    Input,
    Output,
    EventEmitter,
    TemplateRef,
    ContentChildren,
    QueryList,
    Directive,
    InputSignal,
    signal,
    computed,
    effect
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

/** Dirección de ordenamiento */
export type SortDirection = 'asc' | 'desc' | '';

/** Definición de columna */
export interface TableColumn<T = any> {
    /** Clave del campo en el objeto (permite notación 'cliente.nombre' usando getByPath) */
    key: string;
    /** Encabezado a mostrar */
    header: string;
    /** Columna ordenable */
    sortable?: boolean;
    /** Columna filtrable (si omites, se asume true) */
    filterable?: boolean;
    /** Ancho opcional (ej. '120px', '20%') */
    width?: string;
    /** Clases CSS para <th>/<td> */
    class?: string;
}

/**
 * Directiva para inyectar una plantilla de celda personalizada.
 * Uso:
 * <ng-template appCell="acciones" let-row>
 *   <button (click)="editar(row)">Editar</button>
 * </ng-template>
 */
@Directive({
    selector: 'ng-template[appCell]',
    standalone: true
})
export class CellTemplateDirective {
    @Input('appCell') columnKey!: string;
    constructor(public template: TemplateRef<any>) { }
}

/** Utilidad: obtener valor por path 'a.b.c' desde un objeto */
function getByPath(obj: any, path: string): any {
    return path.split('.').reduce((acc, part) => (acc ? acc[part] : undefined), obj);
}

@Component({
    selector: 'app-table-base',
    standalone: true,
    imports: [CommonModule, FormsModule, CellTemplateDirective],
    templateUrl: './table-base.component.html',
    styleUrls: ['./table-base.component.css']
})
export class TableBaseComponent<T = any> {
    /** Datos completos (cliente-side pagination/filter/sort) */
    @Input({ required: true }) data: T[] = [];
    /** Columnas a mostrar */
    @Input({ required: true }) columns: TableColumn<T>[] = [];
    /** Tamaños de página disponibles */
    @Input() pageSizeOptions: number[] = [5, 10, 20, 50];
    /** Tamaño de página inicial */
    @Input() pageSize = 10;
    /** Página inicial (1-based) */
    @Input() page = 1;
    /** Placeholder del buscador */
    @Input() searchPlaceholder = 'Buscar…';
    /** Texto del footer cuando no hay datos */
    @Input() emptyText = 'Sin resultados';
    /** Sort inicial */
    @Input() initialSort?: { key: string; direction: Exclude<SortDirection, ''> };

    /** Eventos */
    @Output() sortChange = new EventEmitter<{ key: string; direction: SortDirection }>();
    @Output() pageChange = new EventEmitter<{ page: number; pageSize: number }>();
    @Output() rowClick = new EventEmitter<T>();
    // NUEVO: props para el botón de crear/registrar
    @Input() showCreateButton = true;
    @Input() createButtonLabel = 'Registrar';
    @Input() createButtonDisabled = false;
    @Output() createClick = new EventEmitter<void>();

    /** Plantillas proyectadas */
    @ContentChildren(CellTemplateDirective) cellTpls!: QueryList<CellTemplateDirective>;

    /** Estado reactivo */
    searchTerm = signal<string>('');
    sortKey = signal<string>('');
    sortDirection = signal<SortDirection>('');
    currentPage = signal<number>(this.page);
    currentPageSize = signal<number>(this.pageSize);

    /** Mapa de plantillas por columnKey */
    cellTemplateMap = new Map<string, TemplateRef<any>>();

    ngAfterContentInit(): void {
        // Construye el mapa de plantillas
        this.cellTemplateMap.clear();
        this.cellTpls?.forEach(t => this.cellTemplateMap.set(t.columnKey, t.template));

        // Aplica sort inicial si viene configurado
        if (this.initialSort) {
            this.sortKey.set(this.initialSort.key);
            this.sortDirection.set(this.initialSort.direction);
        }
    }

    ngOnChanges(): void {
        // Asegura que las páginas sigan siendo válidas si cambian inputs
        const totalPages = Math.max(1, Math.ceil(this.filteredAndSorted().length / this.currentPageSize()));
        if (this.currentPage() > totalPages) this.currentPage.set(totalPages);
    }

    /** Filtra globalmente (sólo columnas filterable !== false) */
    filtered = computed<T[]>(() => {
        const term = this.searchTerm().trim().toLowerCase();
        if (!term) return this.data ?? [];
        const keys = this.columns
            .filter(c => c.filterable !== false)
            .map(c => c.key);
        return (this.data ?? []).filter(row =>
            keys.some(k => {
                const v = getByPath(row, k);
                return (v ?? '').toString().toLowerCase().includes(term);
            })
        );
    });

    /** Ordena según sortKey/sortDirection */
    filteredAndSorted = computed<T[]>(() => {
        const key = this.sortKey();
        const dir = this.sortDirection();
        const base = this.filtered().slice();
        if (!key || !dir) return base;

        return base.sort((a: any, b: any) => {
            const va = getByPath(a, key);
            const vb = getByPath(b, key);
            if (va == null && vb == null) return 0;
            if (va == null) return dir === 'asc' ? -1 : 1;
            if (vb == null) return dir === 'asc' ? 1 : -1;

            if (typeof va === 'number' && typeof vb === 'number') {
                return dir === 'asc' ? va - vb : vb - va;
            }
            const sa = String(va).toLocaleLowerCase();
            const sb = String(vb).toLocaleLowerCase();
            return dir === 'asc' ? sa.localeCompare(sb) : sb.localeCompare(sa);
        });
    });

    get pageStart(): number {
        const total = this.totalItems();
        if (total === 0) return 0;
        return (this.currentPage() - 1) * this.currentPageSize() + 1;
    }

    get pageEnd(): number {
        return Math.min(this.currentPage() * this.currentPageSize(), this.totalItems());
    }

    /** Página actual */
    paged = computed<T[]>(() => {
        const size = this.currentPageSize();
        const page = this.currentPage();
        const start = (page - 1) * size;
        return this.filteredAndSorted().slice(start, start + size);
    });

    /** Totales */
    totalItems = computed(() => this.filteredAndSorted().length);
    totalPages = computed(() => Math.max(1, Math.ceil(this.totalItems() / this.currentPageSize())));

    /** UI handlers */
    toggleSort(col: TableColumn) {
        if (!col.sortable) return;
        const currentKey = this.sortKey();
        const currentDir = this.sortDirection();
        let nextDir: SortDirection = 'asc';

        if (currentKey === col.key) {
            nextDir = currentDir === 'asc' ? 'desc' : (currentDir === 'desc' ? '' : 'asc');
        }
        this.sortKey.set(nextDir ? col.key : '');
        this.sortDirection.set(nextDir);
        this.currentPage.set(1);
        this.sortChange.emit({ key: this.sortKey(), direction: this.sortDirection() });
    }

    changePage(p: number) {
        const clamped = Math.min(Math.max(1, p), this.totalPages());
        this.currentPage.set(clamped);
        this.pageChange.emit({ page: this.currentPage(), pageSize: this.currentPageSize() });
    }

    changePageSize(size: number | string) {
        const n = Number(size) || this.pageSizeOptions[0];
        this.currentPageSize.set(n);
        this.currentPage.set(1);
        this.pageChange.emit({ page: this.currentPage(), pageSize: n });
    }

    clearSearch() {
        this.searchTerm.set('');
        this.currentPage.set(1);
    }

    onRowClick(row: T) {
        this.rowClick.emit(row);
    }

    /** Helpers expuestos a la plantilla */
    hasTemplateFor(colKey: string) {
        return this.cellTemplateMap.has(colKey);
    }

    getTemplate(colKey: string) {
        return this.cellTemplateMap.get(colKey)!;
    }

    getValue(row: T, key: string) {
        return getByPath(row, key);
    }

    trackByIndex = (_: number, __: any) => _;
}
