import { Component, OnInit } from '@angular/core';
import { NgForm } from '@angular/forms';
import { DateAdapter } from '@angular/material/core';
import { HttpClient } from '@angular/common/http';

import { PedidoService } from '../service/pedido.service';
import { formatDisplayDate } from '../../../shared/utils/date-utils';

@Component({
  selector: 'app-contrato',
  templateUrl: './contrato.component.html',
  styleUrls: ['./contrato.component.css']
})
export class ContratoComponent implements OnInit {

  file: Blob | null = null;

  constructor(
    public service2: PedidoService,
    private dateAdapter: DateAdapter<Date>,
    public http: HttpClient
  ) {
    this.dateAdapter.setLocale('es');
  }

  ngOnInit(): void {}

  /**
   * Formatea una fecha (string o Date) al estilo del texto original.
   * Usa dd-MM-yyyy como formato de salida.
   */
  private formatearFechaContrato(fecha: string | Date): string {
    const display = formatDisplayDate(fecha, '');
    if (!display) {
      return '.....__.....de.....__.....del.....____.....';
    }
    const [dd, mm, yyyy] = display.split('-');
    return `.....${dd}.....de.....${mm}.....del.....${yyyy}.....`;
  }

  /**
   * Genera y abre el PDF; luego envía el archivo a los endpoints indicados.
   * Se carga pdfmake de forma perezosa para evitar errores de vfs.
   */
  async createPdf(ContratoForm: NgForm): Promise<void> {
    // Carga perezosa de pdfmake y fuentes
    const pdfMakeModule = await import('pdfmake/build/pdfmake');
    const pdfFonts = await import('pdfmake/build/vfs_fonts');

    // Compatibilidad con distintos exports
    const pdfMake: any = (pdfMakeModule as any).default || pdfMakeModule;
    const vfs = (pdfFonts as any).pdfMake ? (pdfFonts as any).pdfMake.vfs : (pdfFonts as any).vfs;
    (pdfMake as any).vfs = vfs;

    // Datos del formulario
    const pedido_ID = ContratoForm.value.ID;
    const pedido_cliente = ContratoForm.value.Cliente;
    const pedido_servicio = ContratoForm.value.Servicio;
    const pedido_evento = ContratoForm.value.Evento;
    const pedido_fecha = ContratoForm.value.F_Evento;
    const pedido_hora = ContratoForm.value.Hora_Evento;
    const pedido_ubicacion = ContratoForm.value.Direccion;
    const pedido_descripcion = ContratoForm.value.Descripcion;
    const pedido_costoTotal = Number(ContratoForm.value.Costo_Total || 0);
    const pedido_Acuenta = Number(ContratoForm.value.Acuenta || 0);
    const pedido_costoRestante = pedido_costoTotal - pedido_Acuenta;
    const pedido_Email = this.service2?.selectPedido2?.correo || '';

    const hoy = new Date();
    const fechaEventoTexto = this.formatearFechaContrato(pedido_fecha);

    const pdfDefinition: any = {
      content: [
        'Edwin De La Cruz',

        { text: 'CONTRATO DE VIDEO', style: 'header' },

        {
          text:
            "Conste por el presente documento, contrato de video que se celebran de una parte Foto Video D' la Cruz representado por el Sr. EDWIN DE LA CRUZ quien en adelante se denominará EL CONTRATADO y de la otra parte " +
            (pedido_cliente || '________') +
            " quien se denominará EL O LA CONTRATANTE en los términos siguientes:",
          marginBottom: 8
        },

        { text: `1.  Foto Video D' la Cruz brindará el servicio de ${pedido_servicio || '________'} en los días, direcciones y horas que se detallan.` },
        { text: `Fecha del ${pedido_evento || 'evento'} : ${fechaEventoTexto}`, marginTop: 10 },
        { text: `Hora:.....${pedido_hora || '__:__'}.....Lugar:.....${pedido_ubicacion || '________'}.....`, marginTop: 10, marginBottom: 10 },

        { text: '2.  Foto Video D\' la Cruz utilizará su equipo y personal, siendo protestad del mismo el de dejar el lugar de trabajo, en caso sucedieran hechos que atenten contra el normal desenvolvimiento de su trabajo, o cuando consideren innecesaria su presencia en el lugar de trabajo.' },
        { text: '3.  El plazo de entrega del trabajo final será 20 días aproximadamente después de realizado el trabajo.' },
        { text: '4.  Foto Video D\' la Cruz se compromete a realizar su trabajo de filmación en función a la muestra que previamente ha sido visualizada por el contratante, respetando las pautas que, con anterioridad, sean sugeridas.' },
        { text: '5.  EL CONTRATANTE se compromete a facilitar a todo el personal de Foto Video D\' la Cruz el ingreso, ubicación y desplazamiento con absoluta libertad donde se realice el evento.' },
        { text: '6.  Foto Video D\' la Cruz tendrá especial cuidado para realizar el trabajo, sin embargo, si falláramos en el cumplimiento de los términos de este contrato por eventos o actos ajenos a su control la responsabilidad presente o futura limitada a la devolución del depósito como total y única compensación, sin ninguna otra responsabilidad presente o futura.' },

        {
          text: [
            { text: 'Nota:   ', bold: true },
            'Queda expresamente acordado en la eventualidad de posponer o cancelar el trabajo cualquiera sea la causa que lo motive Foto Video D\' la Cruz retendrá el total de los depósitos pagados en compensación por los daños y perjuicios ocasionados'
          ],
          marginTop: 10,
          marginBottom: 10
        },

        { text: `Detalles: ${pedido_descripcion || ''}` },
        { text: `Costo total del servicio: ........${pedido_costoTotal.toFixed(2)}.....US$.....` },
        {
          text:
            `El contratante deja la suma de......${pedido_Acuenta.toFixed(2)}......la misma que será entregada tras la firma de este contrato, ` +
            `quedando un saldo de US$......${pedido_costoRestante.toFixed(2)}......que se cancelará días antes de realizar el trabajo.`,
          marginBottom: 10,
          marginTop: 10
        },
        { text: 'Estos precios son expresados en dólares y no incluyen I.G.V', bold: true },
        { text: 'Forma de pago: 60% al firmar el contrato el saldo días antes de realizar el trabajo.' },

        {
          text:
            `Lima...${String(hoy.getDate()).padStart(2, '0')}...de...${String(hoy.getMonth() + 1).padStart(2, '0')}...del...${hoy.getFullYear()}...`,
          marginTop: 30,
          marginBottom: 30,
          alignment: 'right'
        },

        {
          columns: [
            { marginRight: 10, marginLeft: 20, width: '50%', text: '__________________' },
            { marginRight: 20, marginLeft: 10, width: '50%', text: '__________________' }
          ],
          alignment: 'center'
        },
        {
          columns: [
            { marginRight: 10, marginLeft: 20, width: '50%', text: 'Edwin De la Cruz' },
            { marginRight: 20, marginLeft: 10, width: '50%', text: pedido_cliente || '________' }
          ],
          alignment: 'center'
        }
      ],

      styles: {
        header: {
          fontSize: 15,
          alignment: 'center',
          bold: true,
          margin: 16
        },
        anotherStyle: {
          italics: true,
          alignment: 'right'
        }
      }
    };

    // Crear y abrir el PDF
    const pdf = (pdfMake as any).createPdf(pdfDefinition);
    pdf.open();

    // Obtener blob y disparar envíos
    pdf.getBlob(async (blob: Blob) => {
      try {
        this.file = new Blob([blob]);

        // Envío 1: email
        if (pedido_Email) {
          const fd = new FormData();
          fd.append('file', this.file, 'Contrato.pdf');
          fd.append('subject', 'Generación de contrato');
          fd.append('email', pedido_Email);
          fd.append('message', 'message');
          await this.http.post('https://tp2021database.herokuapp.com/send-email', fd).toPromise();
        }

        // Envío 2: guardar contrato
        const fd2 = new FormData();
        fd2.append('file', this.file, 'Contrato.pdf');
        fd2.append('pedido', String(pedido_ID ?? ''));
        fd2.append('fecha', String(pedido_fecha ?? ''));
        await this.http.post('https://tp2021database.herokuapp.com/postContrato', fd2).toPromise();
      } catch (e) {
        console.error('Error enviando contrato:', e);
      }
    });
  }
}
