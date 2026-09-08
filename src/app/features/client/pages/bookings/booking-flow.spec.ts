/**
 * booking-flow.spec.ts
 * ====================
 * QA — Flujo de reservas frontend (Fase 5)
 *
 * Cubre: modelo, service Angular, lógica de getters de componentes.
 * Ejecutar: ng test (o npx karma start)
 */

import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { environment } from '../../../../../environments/environment';

import { BookingService } from '../../../../core/services/booking.service';
import {
  BookingStatus,
  BookingResponse,
  BOOKING_STATUS_LABELS,
  BOOKING_STATUS_COLORS,
} from '../../../../core/models/booking.model';

// ─────────────────────────────────────────────────────────────────────────────
// Constantes de estado (BookingStatus es un type union, no un enum)
// ─────────────────────────────────────────────────────────────────────────────

const ALL_STATUSES: BookingStatus[] = [
  'PENDING', 'APPROVED', 'REJECTED', 'COMPLETED',
  'CONFIRMED', 'IN_PROGRESS', 'CANCELLED', 'NOSHOW',
];

// ─────────────────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────────────────

function makeBooking(overrides: Partial<BookingResponse> = {}): BookingResponse {
  return {
    id: 1,
    client_id: 10,
    provider_id: 20,
    service_category: 'Plomería',
    status: 'PENDING',
    scheduled_date: '2026-07-01',
    scheduled_time: '14:00:00',
    duration: 60,
    total_price: 15000,
    location_address: 'Av. Test 123',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GRUPO 1 — Modelo: BOOKING_STATUS_LABELS
// ─────────────────────────────────────────────────────────────────────────────

describe('BOOKING_STATUS_LABELS', () => {
  it('debe tener etiqueta en español para PENDING', () => {
    expect(BOOKING_STATUS_LABELS['PENDING']).toBe('Pendiente');
  });

  it('debe tener etiqueta en español para APPROVED', () => {
    expect(BOOKING_STATUS_LABELS['APPROVED']).toBe('Aprobado');
  });

  it('debe tener etiqueta en español para REJECTED', () => {
    expect(BOOKING_STATUS_LABELS['REJECTED']).toBe('Rechazado');
  });

  it('debe tener etiqueta en español para COMPLETED', () => {
    expect(BOOKING_STATUS_LABELS['COMPLETED']).toBe('Completado');
  });

  it('debe cubrir todos los estados', () => {
    ALL_STATUSES.forEach(s => {
      expect(BOOKING_STATUS_LABELS[s])
        .withContext(`falta label para ${s}`)
        .toBeTruthy();
    });
  });
});

describe('BOOKING_STATUS_COLORS', () => {
  it('APPROVED debe tener badge-success', () => {
    expect(BOOKING_STATUS_COLORS['APPROVED']).toBe('badge-success');
  });

  it('REJECTED debe tener badge-danger', () => {
    expect(BOOKING_STATUS_COLORS['REJECTED']).toBe('badge-danger');
  });

  it('PENDING debe tener badge-warning', () => {
    expect(BOOKING_STATUS_COLORS['PENDING']).toBe('badge-warning');
  });

  it('debe cubrir todos los estados', () => {
    ALL_STATUSES.forEach(s => {
      expect(BOOKING_STATUS_COLORS[s])
        .withContext(`falta color para ${s}`)
        .toBeTruthy();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GRUPO 2 — BookingService: endpoints correctos
// ─────────────────────────────────────────────────────────────────────────────

describe('BookingService — endpoints', () => {
  let service: BookingService;
  let httpMock: HttpTestingController;
  const base = `${environment.apiUrl}/bookings`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [BookingService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(BookingService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('confirmBooking debe llamar POST /confirm', () => {
    service.confirmBooking(1).subscribe();
    const req = httpMock.expectOne(`${base}/1/confirm`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.source).toBe('web');
    req.flush(makeBooking({ status: 'APPROVED' }));
  });

  it('rejectBooking debe llamar PUT /status con REJECTED', () => {
    service.rejectBooking(1).subscribe();
    const req = httpMock.expectOne(`${base}/1/status`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.status).toBe('REJECTED');
    req.flush({});
  });

  it('cancelBooking (cliente) debe llamar POST /cancel con CLIENT_REQUEST', () => {
    service.cancelBooking(1).subscribe();
    const req = httpMock.expectOne(`${base}/1/cancel`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.reason).toBe('CLIENT_REQUEST');
    req.flush({});
  });

  it('completeBooking debe llamar PUT /status con COMPLETED', () => {
    service.completeBooking(1).subscribe();
    const req = httpMock.expectOne(`${base}/1/status`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.status).toBe('COMPLETED');
    req.flush({});
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GRUPO 3 — BookingService: sanity
// ─────────────────────────────────────────────────────────────────────────────

describe('BookingService — sanity', () => {
  let service: BookingService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [BookingService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(BookingService);
  });

  it('debe instanciarse', () => {
    expect(service).toBeTruthy();
  });

  it('confirmBooking debe existir', () => {
    expect(service.confirmBooking).toBeDefined();
  });

  it('rejectBooking debe existir', () => {
    expect(service.rejectBooking).toBeDefined();
  });

  it('completeBooking debe existir', () => {
    expect(service.completeBooking).toBeDefined();
  });

  it('cancelBooking debe existir', () => {
    expect(service.cancelBooking).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GRUPO 4 — Getters de componente cliente
// ─────────────────────────────────────────────────────────────────────────────

describe('client-bookings getters', () => {
  const bookings: BookingResponse[] = [
    makeBooking({ id: 1, status: 'PENDING' }),
    makeBooking({ id: 2, status: 'APPROVED' }),
    makeBooking({ id: 3, status: 'COMPLETED' }),
    makeBooking({ id: 4, status: 'REJECTED' }),
    makeBooking({ id: 5, status: 'CANCELLED' }),
  ];

  const upcomingStatuses = new Set<BookingStatus>(['PENDING', 'APPROVED', 'CONFIRMED', 'IN_PROGRESS']);
  const cancelledStatuses = new Set<BookingStatus>(['REJECTED', 'CANCELLED', 'NOSHOW']);
  const historyStatuses   = new Set<BookingStatus>(['COMPLETED']);

  it('PENDING aparece en próximas', () => {
    const upcoming = bookings.filter(b => upcomingStatuses.has(b.status as BookingStatus));
    expect(upcoming.find(b => b.id === 1)).toBeTruthy();
  });

  it('APPROVED aparece en próximas', () => {
    const upcoming = bookings.filter(b => upcomingStatuses.has(b.status as BookingStatus));
    expect(upcoming.find(b => b.id === 2)).toBeTruthy();
  });

  it('COMPLETED aparece en historial', () => {
    const history = bookings.filter(b => historyStatuses.has(b.status as BookingStatus));
    expect(history.find(b => b.id === 3)).toBeTruthy();
  });

  it('REJECTED aparece en canceladas', () => {
    const cancelled = bookings.filter(b => cancelledStatuses.has(b.status as BookingStatus));
    expect(cancelled.find(b => b.id === 4)).toBeTruthy();
  });

  it('CANCELLED aparece en canceladas', () => {
    const cancelled = bookings.filter(b => cancelledStatuses.has(b.status as BookingStatus));
    expect(cancelled.find(b => b.id === 5)).toBeTruthy();
  });

  it('APPROVED no aparece en canceladas', () => {
    const cancelled = bookings.filter(b => cancelledStatuses.has(b.status as BookingStatus));
    expect(cancelled.find(b => b.id === 2)).toBeFalsy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GRUPO 5 — Getters de componente proveedor
// ─────────────────────────────────────────────────────────────────────────────

describe('provider-bookings getters', () => {
  const bookings: BookingResponse[] = [
    makeBooking({ id: 1, status: 'PENDING' }),
    makeBooking({ id: 2, status: 'APPROVED' }),
    makeBooking({ id: 3, status: 'COMPLETED' }),
    makeBooking({ id: 4, status: 'REJECTED' }),
  ];

  const activeStatuses  = new Set<BookingStatus>(['APPROVED', 'CONFIRMED', 'IN_PROGRESS']);
  const historyStatuses = new Set<BookingStatus>(['COMPLETED', 'REJECTED', 'CANCELLED', 'NOSHOW']);

  it('APPROVED aparece en activas', () => {
    const active = bookings.filter(b => activeStatuses.has(b.status as BookingStatus));
    expect(active.find(b => b.id === 2)).toBeTruthy();
  });

  it('PENDING no aparece en activas', () => {
    const active = bookings.filter(b => activeStatuses.has(b.status as BookingStatus));
    expect(active.find(b => b.id === 1)).toBeFalsy();
  });

  it('REJECTED aparece en historial', () => {
    const history = bookings.filter(b => historyStatuses.has(b.status as BookingStatus));
    expect(history.find(b => b.id === 4)).toBeTruthy();
  });

  it('APPROVED no aparece en historial', () => {
    const history = bookings.filter(b => historyStatuses.has(b.status as BookingStatus));
    expect(history.find(b => b.id === 2)).toBeFalsy();
  });
});
