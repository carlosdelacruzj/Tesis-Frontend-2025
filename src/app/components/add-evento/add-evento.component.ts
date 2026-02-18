import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { FormBuilder, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { EventoServicioDataService } from 'src/app/control-panel/administrar-paquete-servicio/service/evento-servicio-data.service';
import { Evento, EventoCreatePayload, EventoFormSchemaField, EventoUpdatePayload } from 'src/app/control-panel/administrar-paquete-servicio/model/evento-servicio.model';

interface AddEventoDialogData {
  mode?: 'create' | 'edit';
  evento?: Evento | null;
}

@Component({
  selector: 'app-add-evento',
  templateUrl: './add-evento.component.html',
  styleUrls: ['./add-evento.component.css']
})
export class AddEventoComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly snack = inject(MatSnackBar);
  private readonly svc = inject(EventoServicioDataService);
  private readonly dialogRef = inject(MatDialogRef<AddEventoComponent>);
  private readonly dialogData = inject<AddEventoDialogData | null>(MAT_DIALOG_DATA, { optional: true });

  loading = false;
  error: string | null = null;
  iconFile: File | null = null;
  iconPreviewUrl: string | null = null;
  schemaFields: EventoFormSchemaField[] = [];
  editingSchemaIndex: number | null = null;

  readonly mode: 'create' | 'edit' = this.dialogData?.mode === 'edit' ? 'edit' : 'create';
  private readonly editingEventoId: number | null = this.dialogData?.evento?.id ?? null;

  form = this.fb.group({
    nombre: ['', [Validators.required, Validators.minLength(3)]],
  });

  schemaDraft = this.fb.group({
    key: [''],
    label: ['', [Validators.required, Validators.minLength(2)]],
    type: ['text', Validators.required],
    required: [true],
    active: [true],
    optionsText: ['']
  });

  readonly fieldTypes = [
    { value: 'text', label: 'Texto' },
    { value: 'textarea', label: 'Párrafo' },
    { value: 'number', label: 'Número' },
    { value: 'date', label: 'Fecha' },
    { value: 'select', label: 'Selección' },
    { value: 'checkbox', label: 'Casilla de verificación' }
  ];
  private readonly allowedFieldTypes = new Set(['text', 'textarea', 'number', 'date', 'select', 'checkbox']);
  private readonly snakeCaseKeyPattern = /^[a-z][a-z0-9_]*$/;

  get isEditMode(): boolean {
    return this.mode === 'edit';
  }

  get schemaTypeValue(): string {
    return String(this.schemaDraft.get('type')?.value ?? 'text');
  }

  get requiresOptions(): boolean {
    return this.schemaTypeValue === 'select';
  }

  get dialogTitle(): string {
    return this.isEditMode ? 'Editar evento' : 'Registrar evento';
  }

  get submitLabel(): string {
    if (this.loading) return 'Guardando...';
    return this.isEditMode ? 'Guardar cambios' : 'Guardar evento';
  }

  get schemaDraftActionLabel(): string {
    return this.editingSchemaIndex !== null ? 'Guardar cambios del campo' : 'Agregar campo';
  }

  get schemaDraftActionIcon(): string {
    return this.editingSchemaIndex !== null ? 'save' : 'add';
  }

  ngOnInit(): void {
    this.setActiveControlMode(false);
    if (this.isEditMode) {
      this.precargarEvento();
    }
  }

  ngOnDestroy(): void {
    this.revokePreview();
  }

  cancel(): void {
    this.dialogRef.close(false);
  }

  onIconSelected(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0] ?? null;
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.error = 'El icono debe ser un archivo de imagen.';
      this.clearIcon();
      return;
    }

    this.error = null;
    this.iconFile = file;
    this.revokePreview();
    this.iconPreviewUrl = URL.createObjectURL(file);
  }

  clearIcon(): void {
    this.iconFile = null;
    this.revokePreview();
  }

  syncKeyFromLabel(): void {
    const labelControl = this.schemaDraft.get('label');
    const keyControl = this.schemaDraft.get('key');
    const normalizedLabel = this.normalizeLabelCase(this.schemaDraft.get('label')?.value);
    labelControl?.setValue(normalizedLabel);
    keyControl?.setValue(normalizedLabel ? this.slugify(normalizedLabel).replace(/-/g, '_') : '');
  }

  addOrUpdateSchemaField(): void {
    this.error = null;
    if (this.schemaDraft.invalid) {
      this.schemaDraft.markAllAsTouched();
      return;
    }

    const raw = this.schemaDraft.getRawValue();
    const label = this.normalizeLabelCase(raw.label);
    const key = this.normalizeKey(label);
    const type = String(raw.type ?? 'text').trim();

    if (!key || !label || !type) {
      this.error = 'Completa la etiqueta y el tipo del campo.';
      return;
    }
    if (!this.snakeCaseKeyPattern.test(key)) {
      this.error = 'La clave autogenerada debe estar en snake_case y empezar con letra. Ejemplo: novio_nombre';
      return;
    }
    if (!this.allowedFieldTypes.has(type)) {
      this.error = 'Tipo de campo no permitido por el backend.';
      return;
    }

    if (this.schemaFields.some((item, idx) => item.key.toLowerCase() === key.toLowerCase() && idx !== this.editingSchemaIndex)) {
      this.error = `Ya existe un campo con la key "${key}".`;
      return;
    }

    const options = this.parseOptions(raw.optionsText);
    if (type === 'select' && !options.length) {
      this.error = 'Los campos de tipo selección requieren al menos una opción.';
      return;
    }

    const next: EventoFormSchemaField = {
      key,
      label,
      type,
      required: !!raw.required,
      active: this.editingSchemaIndex !== null ? !!raw.active : true,
      order: this.editingSchemaIndex !== null
        ? (this.schemaFields[this.editingSchemaIndex]?.order ?? this.editingSchemaIndex + 1)
        : this.schemaFields.length + 1,
      options
    };
    const validationError = this.validateSchemaField(next);
    if (validationError) {
      this.error = validationError;
      return;
    }

    if (this.editingSchemaIndex !== null) {
      this.schemaFields = this.schemaFields.map((item, idx) =>
        idx === this.editingSchemaIndex ? next : item
      );
    } else {
      this.schemaFields = [...this.schemaFields, next];
    }
    this.cancelSchemaEdit();
  }

  removeSchemaField(index: number): void {
    if (this.editingSchemaIndex === index) {
      this.cancelSchemaEdit();
    }
    this.schemaFields = this.schemaFields
      .filter((_, idx) => idx !== index)
      .map((item, idx) => ({ ...item, order: idx + 1 }));
  }

  onSchemaDrop(event: CdkDragDrop<EventoFormSchemaField[]>): void {
    if (event.previousIndex === event.currentIndex) return;
    const copy = [...this.schemaFields];
    moveItemInArray(copy, event.previousIndex, event.currentIndex);
    this.schemaFields = copy.map((item, idx) => ({ ...item, order: idx + 1 }));

    if (this.editingSchemaIndex !== null) {
      const editingField = this.schemaFields[this.editingSchemaIndex];
      const editingKey = editingField?.key;
      const nextEditingIndex = editingKey
        ? this.schemaFields.findIndex(item => item.key === editingKey)
        : -1;
      this.editingSchemaIndex = nextEditingIndex >= 0 ? nextEditingIndex : null;
    }
  }

  toggleSchemaFlag(index: number, field: 'required' | 'active'): void {
    this.schemaFields = this.schemaFields.map((item, idx) =>
      idx === index ? { ...item, [field]: !item[field] } : item
    );
  }

  editSchemaField(index: number): void {
    const field = this.schemaFields[index];
    if (!field) return;

    this.error = null;
    this.editingSchemaIndex = index;
    this.schemaDraft.reset({
      key: field.key,
      label: field.label,
      type: field.type,
      required: !!field.required,
      active: !!field.active,
      optionsText: Array.isArray(field.options) ? field.options.join(', ') : ''
    });
    this.setActiveControlMode(true);
  }

  cancelSchemaEdit(): void {
    this.editingSchemaIndex = null;
    this.resetSchemaDraft();
  }

  createNewSchemaField(): void {
    this.cancelSchemaEdit();
  }

  isEditingField(index: number): boolean {
    return this.editingSchemaIndex === index;
  }

  getSchemaTypeLabel(type: string): string {
    const match = this.fieldTypes.find(item => item.value === type);
    return match?.label ?? type;
  }

  save(): void {
    if (this.form.invalid || this.loading) return;

    this.loading = true;
    this.error = null;

    const nombre = (this.form.value.nombre || '').trim();
    const schemaValidationError = this.validateSchemaCollection(this.schemaFields);
    if (schemaValidationError) {
      this.loading = false;
      this.error = schemaValidationError;
      return;
    }

    const normalizedSchema = this.schemaFields.map((item, idx) => ({
      key: item.key,
      label: item.label,
      type: item.type,
      required: !!item.required,
      active: !!item.active,
      order: idx + 1,
      options: Array.isArray(item.options) ? item.options : []
    }));
    const payloadBase = {
      nombre,
      icon: this.iconFile,
      formSchema: normalizedSchema
    };

    const request$ = this.isEditMode && this.editingEventoId != null
      ? this.svc.actualizarEvento(this.editingEventoId, payloadBase as EventoUpdatePayload)
      : this.svc.crearEvento(payloadBase as EventoCreatePayload);

    request$.subscribe({
      next: () => {
        this.snack.open(this.isEditMode ? 'Evento actualizado correctamente' : 'Evento creado correctamente', 'OK', {
          duration: 2500
        });
        this.dialogRef.close(true);
      },
      error: (err: unknown) => {
        this.loading = false;

        const errorResponse = err as { status?: number; error?: { message?: string } | string };
        const message = typeof errorResponse?.error === 'string'
          ? errorResponse.error
          : (errorResponse?.error?.message || '');

        if (errorResponse?.status === 409 || /existe/i.test(message)) {
          this.form.get('nombre')?.setErrors({ duplicado: true });
          this.error = 'Ya existe un evento con ese nombre.';
          return;
        }

        this.error = message || 'No pudimos guardar el evento. Intenta nuevamente.';
      },
    });
  }

  private precargarEvento(): void {
    const evento = this.dialogData?.evento;
    if (!evento) return;

    this.form.patchValue({ nombre: evento.nombre ?? '' });

    if (Array.isArray(evento.formSchema)) {
      this.schemaFields = this.normalizeSchema(evento.formSchema);
      return;
    }

    if (this.editingEventoId == null) return;

    this.loading = true;
    this.svc.getEventoSchema(this.editingEventoId).subscribe({
      next: (response) => {
        this.schemaFields = this.normalizeSchema(response?.formSchema ?? []);
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  private normalizeSchema(fields: EventoFormSchemaField[]): EventoFormSchemaField[] {
    return [...(fields ?? [])]
      .map((field, idx) => ({
        key: String(field?.key ?? '').trim(),
        label: String(field?.label ?? '').trim(),
        type: String(field?.type ?? 'text').trim(),
        required: !!field?.required,
        active: typeof field?.active === 'boolean' ? field.active : true,
        order: Number.isInteger(field?.order) && Number(field.order) > 0 ? Number(field.order) : idx + 1,
        options: Array.isArray(field?.options)
          ? field.options.map(opt => String(opt).trim()).filter(Boolean)
          : []
      }))
      .sort((a, b) => a.order - b.order)
      .map((field, idx) => ({ ...field, order: idx + 1 }));
  }

  private slugify(v: string): string {
    return (v || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }

  private resetSchemaDraft(): void {
    this.schemaDraft.reset({
      key: '',
      label: '',
      type: 'text',
      required: true,
      active: true,
      optionsText: ''
    });
    this.setActiveControlMode(false);
  }

  private setActiveControlMode(editing: boolean): void {
    const activeControl = this.schemaDraft.get('active');
    if (!activeControl) return;
    if (editing) {
      activeControl.enable({ emitEvent: false });
      return;
    }
    activeControl.setValue(true, { emitEvent: false });
    activeControl.disable({ emitEvent: false });
  }

  private normalizeKey(value: string): string {
    return this.slugify(String(value || '')).replace(/-/g, '_');
  }

  private normalizeLabelCase(value: unknown): string {
    const text = String(value ?? '').trim().replace(/\s+/g, ' ');
    if (!text) return '';
    const lower = text.toLocaleLowerCase('es');
    return lower.charAt(0).toLocaleUpperCase('es') + lower.slice(1);
  }

  private parseOptions(value: string | null | undefined): string[] {
    return String(value ?? '')
      .split(/[\n,]/g)
      .map(item => item.trim())
      .filter(Boolean);
  }

  private validateSchemaCollection(fields: EventoFormSchemaField[]): string | null {
    const keys = new Set<string>();
    for (let i = 0; i < fields.length; i++) {
      const field = fields[i];
      const err = this.validateSchemaField(field);
      if (err) return err;

      const normalizedKey = String(field.key || '').toLowerCase();
      if (keys.has(normalizedKey)) {
        return `La clave "${field.key}" está repetida en el esquema.`;
      }
      keys.add(normalizedKey);

      if (field.order !== i + 1) {
        return 'El orden de campos no es válido. Reordena y vuelve a intentar.';
      }
    }
    return null;
  }

  private validateSchemaField(field: EventoFormSchemaField): string | null {
    if (!field || typeof field !== 'object') {
      return 'Campo dinámico inválido.';
    }
    const key = String(field.key ?? '').trim();
    const label = String(field.label ?? '').trim();
    const type = String(field.type ?? '').trim();

    if (!key) return 'Cada campo debe tener una clave.';
    if (!this.snakeCaseKeyPattern.test(key)) {
      return `La clave "${key}" no cumple el formato snake_case.`;
    }
    if (!label) return `El campo "${key}" debe tener una etiqueta.`;
    if (!this.allowedFieldTypes.has(type)) {
      return `El tipo "${type}" no está permitido.`;
    }
    if (!Number.isInteger(field.order) || field.order <= 0) {
      return `El campo "${key}" debe tener un orden entero mayor a 0.`;
    }
    if (typeof field.required !== 'boolean') {
      return `El campo "${key}" debe definir si es obligatorio (boolean).`;
    }
    if (typeof field.active !== 'boolean') {
      return `El campo "${key}" debe definir si está activo (boolean).`;
    }
    const options = Array.isArray(field.options) ? field.options : [];
    if (type === 'select' && options.length === 0) {
      return `El campo "${key}" de tipo selección debe tener opciones.`;
    }
    return null;
  }

  private revokePreview(): void {
    if (this.iconPreviewUrl) {
      URL.revokeObjectURL(this.iconPreviewUrl);
      this.iconPreviewUrl = null;
    }
  }
}


