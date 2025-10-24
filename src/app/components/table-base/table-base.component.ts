import {
    Component,
    Input,
    Output,
    EventEmitter,
    TemplateRef,
    ContentChildren,
    QueryList,
    Directive,
    signal,
    computed,
    AfterContentInit,
    OnChanges,
    OnDestroy,
    SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Subscription } from 'rxjs';

/** Dirección de ordenamiento */
export type SortDirection = 'asc' | 'desc' | '';

/** Definición de columna base */
export interface TableColumn<T = any> {
    key: string;
    header: string;
    sortable?: boolean;
    filterable?: boolean;
    width?: string;
    class?: string;
    minWidth?: string;
    maxWidth?: string;
}

/**
 * Directiva para inyectar plantillas personalizadas por columna.
 * Uso:
 * <ng-template appCell="acciones" let-row>...</ng-template>
 */
@Directive({
    selector: 'ng-template[appCell]',
    standalone: true
})
export class CellTemplateDirective {
    @Input('appCell') columnKey!: string;
    constructor(public readonly template: TemplateRef<any>) { }
}

/** Utilidad: obtener valor por path 'a.b.c' desde un objeto */
function getByPath(obj: any, path: string): any {
    return path.split('.').reduce((acc, part) => (acc ? acc[part] : undefined), obj);
}

@Component({
    selector: 'app-table-base',
    standalone: true,
    imports: [CommonModule, FormsModule, MatIconModule, CellTemplateDirective],
    templateUrl: './table-base.component.html',
    styleUrls: ['./table-base.component.css']
})
export class TableBaseComponent<T = any> implements AfterContentInit, OnChanges, OnDestroy {
    /** Datos completos (cliente-side pagination/filter/sort) */
    @Input({ required: true }) data: T[] = [];
    /** Columnas a mostrar (extendidas con min/max opcionales) */
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
    /** Eventos */
    @Output() sortChange = new EventEmitter<{ key: string; direction: SortDirection }>();
    @Output() pageChange = new EventEmitter<{ page: number; pageSize: number }>();
    @Output() rowClick = new EventEmitter<T>();
    // NUEVO: props para el botón de crear/registrar
    @Input() showCreateButton = true;
    @Input() createButtonLabel = 'Registrar';
    @Input() createButtonDisabled = false;
    @Input() showSearch = true;
    @Input() showFooterInfo = true;
    @Input() showPagination = true;
    @Input() showPageSizeSelector = true;
    @Output() createClick = new EventEmitter<void>();

    /** Plantillas proyectadas */
    @ContentChildren(CellTemplateDirective) cellTpls!: QueryList<CellTemplateDirective>;

    /** Estado reactivo */
    private dataSignal = signal<T[]>([]);
    searchTerm = signal<string>('');
    sortKey = signal<string>('');
    sortDirection = signal<SortDirection>('');
    currentPage = signal<number>(this.page);
    currentPageSize = signal<number>(this.pageSize);

    /** Mapa de plantillas por columnKey */
    cellTemplateMap = new Map<string, TemplateRef<any>>();
    private cellTplsChangesSub?: Subscription;

    ngAfterContentInit(): void {
        this.rebuildCellTemplateMap();
        if (this.cellTpls) {
            this.cellTplsChangesSub = this.cellTpls.changes.subscribe(() => this.rebuildCellTemplateMap());
        }
        this.dataSignal.set(this.data ?? []);
        this.syncPageSizeFromInput();
        this.syncPageFromInput();
        this.ensureCurrentPageInRange();
    }

    ngOnChanges(changes: SimpleChanges): void {
        if ('pageSize' in changes) {
            this.syncPageSizeFromInput();
        }

        if ('page' in changes) {
            this.syncPageFromInput();
        }

        if ('data' in changes) {
            this.dataSignal.set(this.data ?? []);
        }

        if ('data' in changes || 'columns' in changes || 'pageSize' in changes || 'page' in changes) {
            this.ensureCurrentPageInRange();
        }
    }

    ngOnDestroy(): void {
        this.cellTplsChangesSub?.unsubscribe();
    }

    /** Filtra globalmente (sólo columnas filterable !== false) */
    filtered = computed<T[]>(() => {
        const term = this.searchTerm().trim().toLowerCase();
        const source = this.dataSignal();
        if (!term) return source ?? [];
        const keys = this.columns
            .filter(c => (c as any).filterable !== false)
            .map(c => c.key);
        return (source ?? []).filter(row =>
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
    toggleSort(col: TableColumn<T>) {
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

    private rebuildCellTemplateMap(): void {
        this.cellTemplateMap.clear();
        this.cellTpls?.forEach(t => this.cellTemplateMap.set(t.columnKey, t.template));
    }

    private syncPageSizeFromInput(): void {
        const candidate = Number(this.pageSize);
        const fallback = this.pageSizeOptions?.[0] ?? 10;
        const next = Number.isFinite(candidate) && candidate > 0 ? Math.floor(candidate) : fallback;
        this.currentPageSize.set(next);
    }

    private syncPageFromInput(): void {
        const candidate = Number(this.page);
        const next = Number.isFinite(candidate) && candidate > 0 ? Math.floor(candidate) : 1;
        this.currentPage.set(next);
    }

    private ensureCurrentPageInRange(): void {
        const totalPages = this.totalPages();
        const clamped = Math.min(Math.max(1, this.currentPage()), totalPages);
        if (clamped !== this.currentPage()) {
            this.currentPage.set(clamped);
        }
    }
}
