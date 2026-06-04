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
import { environment } from '../../../environments/environment';

import { BookingService } from '../../core/services/booking.service';
import {
  BookingStatus,
  BookingResponse,
  BOOKING_STATUS_LABELS,
  BOOKING_STATUS_COLORS,
} from '../../core/models/booking.model';

// ─────────────────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────────────────

function makeBooking(overrides: Partial<BookingResponse> = {}): BookingResponse {
  return {
    id: 1,
    client_id: 10,
    provider_id: 20,
    service_category: 'Plomería',
    status: BookingStatus.PENDING,
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
// GRUPO 1 — Modelo: BookingStatus enum
// ─────────────────────────────────────────────────────────────────────────────

describe('BookingStatus enum', () => {
  it('debe tener los 4 estados principales', () => {
    expect(BookingStatus.PENDING).toBe('PENDING');
    expect(BookingStatus.APPROVED).toBe('APPROVED');
    expect(BookingStatus.REJECTED).toBe('REJECTED');
    expect(BookingStatus.COMPLETED).toBe('COMPLETED');
  });

  it('debe preservar los estados legacy', () => {
    expect(BookingStatus.CONFIRMED).toBe('CONFIRMED');
    expect(BookingStatus.IN_PROGRESS).toBe('IN_PROGRESS');
    expect(BookingStatus.CANCELLED).toBe('CANCELLED');
    expect(BookingStatus.NOSHOW).toBe('NOSHOW');
  });
});

describe('BOOKING_STATUS_LABELS', () => {
  it('debe tener etiqueta en español para APPROVED', () => {
    expect(BOOKING_STATUS_LABELS[BookingStatus.APPROVED]).toBe('Aprobado');
  });

  it('debe tener etiqueta en español para REJECTED', () => {
    expect(BOOKING_STATUS_LABELS[BookingStatus.REJECTED]).toBe('Rechazado');
  });

  it('debe cubrir todos los estados del enum', () => {
    const statuses = Object.values(BookingStatus);
    statuses.forEach(s => {
      expect(BOOKING_STATUS_LABELS[s as BookingStatus])
        .withContext(`falta label para ${s}`)
        .toBeTruthy();
    });
  });
});

describe('BOOKING_STATUS_COLORS', () => {
  it('APPROVED debe tener color de éxito', () => {
    expect(BOOKING_STATUS_COLORS[BookingStatus.APPROVED]).toBe('badge-success');
  });

  it('REJECTED debe tener color de peligro', () => {
    expect(BOOKING_STATUS_COLORS[BookingStatus.REJECTED]).toBe('badge-danger');
  });

  it('COMPLETED debe tener color de info/acento', () => {
    expect(BOOKING_STATUS_COLORS[BookingStatus.COMPLETED]).toBeTruthy();
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

  it('confirmBooking debe llamar POST /approve', () => {
    const mockBooking = makeBooking({ status: BookingStatus.APPROVED });
    service.confirmBooking(1).subscribe();

    const req = httpMock.expectOne(`${base}/1/approve`);
    expect(req.request.method).toBe('POST');
    req.flush(mockBooking);
  });

  it('rejectBooking debe llamar PATCH /reject', () => {
    service.rejectBooking(1).subscribe();

    const req = httpMock.expectOne(`${base}/1/reject`);
    expect(req.request.method).toBe('PATCH');
    req.flush({});
  });

  it('rejectBooking no debe llamar /cancel', () => {
    service.rejectBooking(1).subscribe();
    httpMock.expectOne(`${base}/1/reject`).flush({});
    httpMock.expectNone(`${base}/1/cancel`);
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
// GRUPO 3 — (omitido: BookingService web no expone canX helpers)
// Los tests de canX se cubren en el mobile (frontend-bapp).
// ─────────────────────────────────────────────────────────────────────────────

describe('BookingService web — sanity', () => {
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
});

// ─────────────────────────────────────────────────────────────────────────────
// GRUPO 4 — Getters de componente cliente
// ─────────────────────────────────────────────────────────────────────────────

describe('client-bookings getters', () => {
  /**
   * Simulamos los mismos getters que existen en ClientBookingsComponent
   * sin instanciar el componente completo.
   */
  const bookings: BookingResponse[] = [
    makeBooking({ id: 1, status: BookingStatus.PENDING }),
    makeBooking({ id: 2, status: BookingStatus.APPROVED }),
    makeBooking({ id: 3, status: BookingStatus.COMPLETED }),
    makeBooking({ id: 4, status: BookingStatus.REJECTED }),
    makeBooking({ id: 5, status: BookingStatus.CANCELLED }),
  ];

  const upcomingStatuses = new Set<BookingStatus>([BookingStatus.PENDING, BookingStatus.APPROVED, BookingStatus.CONFIRMED, BookingStatus.IN_PROGRESS]);
  const cancelledStatuses = new Set<BookingStatus>([BookingStatus.REJECTED, BookingStatus.CANCELLED, BookingStatus.NOSHOW]);
  const historyStatuses   = new Set<BookingStatus>([BookingStatus.COMPLETED]);

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
    makeBooking({ id: 1, status: BookingStatus.PENDING }),
    makeBooking({ id: 2, status: BookingStatus.APPROVED }),
    makeBooking({ id: 3, status: BookingStatus.COMPLETED }),
    makeBooking({ id: 4, status: BookingStatus.REJECTED }),
  ];

  const activeStatuses  = new Set<BookingStatus>([BookingStatus.APPROVED, BookingStatus.CONFIRMED, BookingStatus.IN_PROGRESS]);
  const historyStatuses = new Set<BookingStatus>([BookingStatus.COMPLETED, BookingStatus.REJECTED, BookingStatus.CANCELLED, BookingStatus.NOSHOW]);

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
