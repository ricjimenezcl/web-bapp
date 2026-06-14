import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type ReportType =
  | 'INAPPROPRIATE_CONTENT'
  | 'FAKE_PROFILE'
  | 'HARASSMENT'
  | 'SPAM'
  | 'FRAUD'
  | 'HATE_SPEECH'
  | 'OTHER';

export type ReportedEntityType = 'USER' | 'REVIEW' | 'SERVICE' | 'CHAT_MESSAGE';

export interface CreateReportPayload {
  report_type: ReportType;
  reported_entity_type: ReportedEntityType;
  reported_entity_id: number;
  reported_user_id?: number;
  description?: string;
}

export interface ReportResponse {
  id: number;
  report_type: ReportType;
  reported_entity_type: ReportedEntityType;
  reported_entity_id: number;
  reporter_id: number;
  status: string;
  created_at: string;
}

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  INAPPROPRIATE_CONTENT: 'Contenido inapropiado',
  FAKE_PROFILE:          'Perfil falso',
  HARASSMENT:            'Acoso',
  SPAM:                  'Spam',
  FRAUD:                 'Fraude o estafa',
  HATE_SPEECH:           'Discurso de odio',
  OTHER:                 'Otro motivo',
};

@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/reports`;

  /** Crea un nuevo reporte en el backend */
  createReport(payload: CreateReportPayload): Observable<ReportResponse> {
    return this.http.post<ReportResponse>(this.apiUrl + '/', payload);
  }
}
