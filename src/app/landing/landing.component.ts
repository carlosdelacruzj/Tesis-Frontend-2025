import { Component } from '@angular/core';

@Component({
  selector: 'app-landing',
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.css'],
})
export class LandingComponent {
  public currentYear = new Date().getFullYear();

  public testimonials = [
    {
      name: 'María & José',
      role: 'Boda en Cusco',
      quote:
        'Capturaron cada momento mágico con una calidad impresionante. ¡Revivo mi boda cada vez que veo el video!',
    },
    {
      name: 'Grupo Andante',
      role: 'Sesión corporativa',
      quote:
        'El equipo logró transmitir la esencia de nuestra marca. Fotografías impecables y un servicio muy profesional.',
    },
    {
      name: 'Lucía Torres',
      role: 'Cumpleaños de 15',
      quote:
        'El video resumen fue emocionante y auténtico. Nos guiaron con creatividad en cada toma.',
    },
  ];

  public packages = [
    {
      name: 'Recuerdos Esenciales',
      description: 'Cobertura fotográfica de hasta 4 horas, entrega digital y galería privada.',
      price: 'S/ 890',
    },
    {
      name: 'Historia Completa',
      description:
        'Cobertura de foto y video durante todo el evento, video highlight de 3 minutos y álbum profesional.',
      price: 'S/ 1,690',
      featured: true,
    },
    {
      name: 'Experiencia Premium',
      description:
        'Equipo de dos fotógrafos y un videógrafo, drone, entrega express y libro fotográfico de lujo.',
      price: 'S/ 2,450',
    },
  ];
}
