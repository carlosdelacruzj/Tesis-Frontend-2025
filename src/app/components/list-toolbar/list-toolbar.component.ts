import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-list-toolbar',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './list-toolbar.component.html',
  styleUrls: ['./list-toolbar.component.css']
})
export class ListToolbarComponent {
  @Input() title = '';
  @Input() description = '';
  @Input() showSearch = true;
  @Input() searchPlaceholder = 'Buscar…';
  @Input() showCreateButton = true;
  @Input() createButtonLabel = 'Nuevo';
  @Input() createButtonIcon = 'add';
  @Input() searchValue = '';
  @Input() disableCreate = false;

  @Output() searchChange = new EventEmitter<string>();
  @Output() createClick = new EventEmitter<void>();

  onSearchChange(value: string): void {
    this.searchValue = value;
    this.searchChange.emit(value);
  }

  clearSearch(): void {
    this.searchValue = '';
    this.searchChange.emit('');
  }

  onCreate(): void {
    this.createClick.emit();
  }
}
