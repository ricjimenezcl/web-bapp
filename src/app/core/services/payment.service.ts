import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type ProductType =
  | 'CLIENT_UNLOCK_7'
  | 'CLIENT_UNLOCK_30'
  | 'PROVIDER_SERVICE_30'
  | 'PROVIDER_SERVICE_YEAR'
  | 'PROVIDER_LEADS_7'
  | 'PROVIDER_LEADS_30'
  | 'PROVIDER_PREMIUM_MONTHLY'
  | 'PROVIDER_PREMIUM_ANNUAL';

export interface CreateTransactionRequest {
  product_type: ProductType;
  amount: number;
  return_url?: string;
}

export interface CreateTransactionResponse {
  success: boolean;
  token: string;
  url: string;
  buy_order: string;
  session_id: string;
  amount: number;
  product_type: ProductType;
}

export interface CommitTransactionResponse {
  success: boolean;
  status: string;
  buy_order?: string;
  authorization_code?: string;
  amount?: number;
  transaction_id?: number;
  expires_at?: string;
  error?: string;
}

export interface TransactionStatusResponse {
  success: boolean;
  buy_order: string;
  local_status: string;
  product_type?: string;
  amount: number;
  token?: string;
  transbank?: Record<string, unknown>;
}

@Injectable({ providedIn: 'root' })
export class PaymentService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  createTransaction(payload: CreateTransactionRequest): Observable<CreateTransactionResponse> {
    return this.http.post<CreateTransactionResponse>(`${this.api}/payments/transbank/create`, payload);
  }

  commitTransaction(params: { token?: string; buy_order?: string }): Observable<CommitTransactionResponse> {
    return this.http.post<CommitTransactionResponse>(`${this.api}/payments/transbank/commit`, params);
  }

  getTransactionStatus(buyOrder: string): Observable<TransactionStatusResponse> {
    return this.http.get<TransactionStatusResponse>(`${this.api}/payments/transbank/status/${buyOrder}`);
  }
}
