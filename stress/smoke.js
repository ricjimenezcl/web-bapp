/**
 * SMOKE TEST
 * Objetivo: Verificar que todos los endpoints responden correctamente.
 * Carga: 1 VU durante 1 minuto.
 * Uso: k6 run stress/smoke.js
 */
import { check, sleep } from 'k6';
import http from 'k6/http';
import { getAuthToken } from './utils/helpers.js';
import { authScenario } from './scenarios/auth.js';
import { searchScenario } from './scenarios/search.js';
import { bookingScenario } from './scenarios/bookings.js';
import { chatScenario } from './scenarios/chat.js';

// Solo contar errores 5xx como fallos HTTP reales (4xx son respuestas esperadas)
http.setResponseCallback(http.expectedStatuses({ min: 200, max: 499 }));

export const options = {
  vus: 1,
  duration: '1m',
  thresholds: {
    http_req_failed: ['rate<0.01'],       // < 1% errores
    http_req_duration: ['p(95)<5000'],    // 95% < 5s (Render free tier cold starts)
  },
};

let token;

export function setup() {
  const email = __ENV.TEST_CLIENT_EMAIL;
  const password = __ENV.TEST_CLIENT_PASSWORD;
  if (!email || !password) {
    console.warn('TEST_CLIENT_EMAIL / TEST_CLIENT_PASSWORD no definidas, algunas pruebas se saltarán');
    return { token: null };
  }
  return { token: getAuthToken(email, password) };
}

export default function (data) {
  const { token } = data;
  authScenario(token);
  searchScenario(token);
  bookingScenario(token);
  chatScenario(token);
  sleep(1);
}
