/**
 * LOAD TEST (Carga promedio)
 * Objetivo: Simular carga normal sostenida.
 * Escenarios:
 *   - 10 VUs de búsqueda anónima (principal tráfico)
 *   - 5 VUs de clientes autenticados (reservas + chat)
 *   - 2 VUs de auth (registro / login)
 * Duración: 5 minutos con rampa de 1 min.
 * Uso: k6 run stress/load.js -e TEST_CLIENT_EMAIL=x -e TEST_CLIENT_PASSWORD=y
 */
import { sleep } from 'k6';
import { getAuthToken } from './utils/helpers.js';
import { authScenario } from './scenarios/auth.js';
import { searchScenario } from './scenarios/search.js';
import { bookingScenario } from './scenarios/bookings.js';
import { chatScenario } from './scenarios/chat.js';

export const options = {
  scenarios: {
    busqueda_anonima: {
      executor: 'ramping-vus',
      stages: [
        { duration: '1m', target: 10 },
        { duration: '3m', target: 10 },
        { duration: '1m', target: 0 },
      ],
      exec: 'scenarioBusqueda',
    },
    clientes_autenticados: {
      executor: 'ramping-vus',
      stages: [
        { duration: '1m', target: 5 },
        { duration: '3m', target: 5 },
        { duration: '1m', target: 0 },
      ],
      exec: 'scenarioCliente',
    },
    flujo_auth: {
      executor: 'ramping-vus',
      stages: [
        { duration: '1m', target: 2 },
        { duration: '3m', target: 2 },
        { duration: '1m', target: 0 },
      ],
      exec: 'scenarioAuth',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.05'],        // < 5% errores
    http_req_duration: ['p(90)<3000', 'p(95)<5000'],
    'http_req_duration{scenario:busqueda_anonima}': ['p(95)<4000'],
    'http_req_duration{scenario:clientes_autenticados}': ['p(95)<5000'],
  },
};

let _token = null;

export function setup() {
  const email = __ENV.TEST_CLIENT_EMAIL;
  const password = __ENV.TEST_CLIENT_PASSWORD;
  if (email && password) {
    _token = getAuthToken(email, password);
  }
  return { token: _token };
}

export function scenarioBusqueda() {
  searchScenario(null);
  sleep(1);
}

export function scenarioCliente(data) {
  const token = data?.token;
  searchScenario(token);
  bookingScenario(token);
  chatScenario(token);
  sleep(1);
}

export function scenarioAuth() {
  authScenario(null);
  sleep(2);
}
