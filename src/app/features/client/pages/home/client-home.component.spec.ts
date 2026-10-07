import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { ClientHomeComponent } from './client-home.component';
import { environment } from '../../../../../environments/environment';

describe('ClientHomeComponent', () => {
  let fixture: ComponentFixture<ClientHomeComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClientHomeComponent, HttpClientTestingModule],
      providers: [provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(ClientHomeComponent);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('debe cargar el dashboard usando la base de la API configurada', () => {
    fixture.detectChanges();

    const userReq = httpMock.expectOne(`${environment.apiUrl}/users/me`);
    expect(userReq.request.method).toBe('GET');
    userReq.flush({ has_premium: false });

    const bookingsReq = httpMock.expectOne(`${environment.apiUrl}/bookings?limit=3`);
    expect(bookingsReq.request.method).toBe('GET');
    bookingsReq.flush([]);

    const messagesReq = httpMock.expectOne(`${environment.apiUrl}/notifications?limit=3`);
    expect(messagesReq.request.method).toBe('GET');
    messagesReq.flush([]);

    const planReq = httpMock.expectOne(`${environment.apiUrl}/transactions/me`);
    expect(planReq.request.method).toBe('GET');
    planReq.flush([]);
  });

  it('debe soportar respuestas con la lista de notificaciones dentro de un objeto', () => {
    fixture.detectChanges();

    httpMock.expectOne(`${environment.apiUrl}/users/me`).flush({ has_premium: false });
    httpMock.expectOne(`${environment.apiUrl}/bookings?limit=3`).flush([]);

    const messagesReq = httpMock.expectOne(`${environment.apiUrl}/notifications?limit=3`);
    expect(() => {
      messagesReq.flush({
        notifications: [{
          sender_name: 'Ana',
          content: 'Hola',
          created_at: new Date().toISOString(),
          is_read: false,
        }],
        total: 1,
        unread_count: 1,
      });
    }).not.toThrow();

    httpMock.expectOne(`${environment.apiUrl}/transactions/me`).flush([]);
    expect(fixture.componentInstance.messages().length).toBe(1);
  });
});
