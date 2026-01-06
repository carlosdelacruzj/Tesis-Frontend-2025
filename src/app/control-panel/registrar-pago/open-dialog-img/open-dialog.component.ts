import { Component, OnInit, inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';

interface OpenDialogData {
  img?: string;
}

@Component({
  selector: 'app-open-dialog-img',
  templateUrl: 'open-dialog.img.html',
})
export class OpenDialogComponent implements OnInit {
  readonly data = inject<OpenDialogData>(MAT_DIALOG_DATA);

  ngOnInit(): void {
    this.logAge();
  }

  logAge(): void {
    console.log(this.data.img);
  }
}
