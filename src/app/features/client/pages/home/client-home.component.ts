import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

interface HomeCard {
  label: string;
  value: string;
  detail: string;
  tone: 'primary' | 'accent' | 'neutral';
}

@Component({
  selector: 'app-client-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="client-home">
      <header class="hero">
        <div class="brand">
          <div class="brand__mark">B</div>
          <div class="brand__copy">
            <span class="eyebrow">BappSearch</span>
            <h1>Encuentra soluciones cerca de ti</h1>
          </div>
        </div>

        <button class="hero__cta" type="button" routerLink="/client/categories">
          Comenzar a buscar
        </button>
      </header>

      <section class="summary">
        <div class="summary__content">
          <p class="summary__kicker">Todo en un solo lugar</p>
          <h2>Resuelve problemas cotidianos en tu zona sin perder tiempo.</h2>
          <p>
            BappSearch conecta a personas con servicios confiables y cercanos para
            hogar, mantenimiento, belleza, apoyo técnico y más.
          </p>
        </div>

        <div class="summary__badge">
          <span class="summary__badge-label">Servicio más solicitado</span>
          <strong>Plomería</strong>
          <small>Respuestas rápidas en menos de 30 min</small>
        </div>
      </section>

      <section class="stats" aria-label="Resumen del servicio">
        <article class="stat stat--primary" *ngFor="let card of cards">
          <span class="stat__label">{{ card.label }}</span>
          <strong class="stat__value">{{ card.value }}</strong>
          <small class="stat__detail">{{ card.detail }}</small>
        </article>
      </section>

      <section class="quick-search">
        <div class="section-head">
          <h3>Busca por necesidad</h3>
          <a routerLink="/client/categories">Ver todas</a>
        </div>

        <div class="category-grid">
          <button type="button" class="category" routerLink="/client/categories">
            <span class="category__icon">🔧</span>
            <span>Plomería</span>
          </button>
          <button type="button" class="category" routerLink="/client/categories">
            <span class="category__icon">⚡</span>
            <span>Electricidad</span>
          </button>
          <button type="button" class="category" routerLink="/client/categories">
            <span class="category__icon">🧼</span>
            <span>Limpieza</span>
          </button>
          <button type="button" class="category" routerLink="/client/categories">
            <span class="category__icon">💇</span>
            <span>Belleza</span>
          </button>
          <button type="button" class="category" routerLink="/client/categories">
            <span class="category__icon">🛠️</span>
            <span>Reparaciones</span>
          </button>
          <button type="button" class="category" routerLink="/client/categories">
            <span class="category__icon">🏠</span>
            <span>Hogar</span>
          </button>
        </div>
      </section>

      <section class="dashboard">
        <div class="dashboard__header">
          <h3>Tu dashboard rápido</h3>
          <span>Hoy</span>
        </div>

        <div class="dashboard__grid">
          <article class="mini-panel">
            <span class="mini-panel__label">Tu zona</span>
            <strong>Centro</strong>
            <small>12 servicios activos</small>
          </article>

          <article class="mini-panel">
            <span class="mini-panel__label">Solicitudes</span>
            <strong>3</strong>
            <small>En revisión</small>
          </article>

          <article class="mini-panel mini-panel--highlight">
            <span class="mini-panel__label">Mejor opción</span>
            <strong>Disponibles ahora</strong>
            <small>Respuesta en 15 minutos</small>
          </article>
        </div>
      </section>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
      }

      .client-home {
        display: grid;
        gap: 1.25rem;
        padding: 1.25rem 0 2rem;
        color: #f3f7ff;
      }

      .hero,
      .summary,
      .stats,
      .quick-search,
      .dashboard {
        width: min(100%, 1200px);
        margin: 0 auto;
      }

      .hero {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        padding: 0.25rem 0.25rem 0;
      }

      .brand {
        display: flex;
        align-items: center;
        gap: 0.9rem;
      }

      .brand__mark {
        display: grid;
        place-items: center;
        width: 44px;
        height: 44px;
        border-radius: 14px;
        background: linear-gradient(135deg, #d9c58c, #af8c3d);
        color: #111827;
        font-weight: 900;
        font-size: 1.4rem;
        box-shadow: 0 10px 24px rgba(183, 148, 73, 0.35);
      }

      .brand__copy {
        display: grid;
        gap: 0.15rem;
      }

      .eyebrow {
        margin: 0;
        color: #d7b76e;
        font-size: 0.72rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      h1 {
        margin: 0;
        font-size: clamp(2rem, 4vw, 3.4rem);
        line-height: 1.02;
        letter-spacing: -0.06em;
      }

      .hero__cta {
        border: 0;
        border-radius: 999px;
        padding: 0.9rem 1.35rem;
        background: linear-gradient(135deg, #d7c785, #b19052);
        color: #181511;
        font-weight: 800;
        cursor: pointer;
        box-shadow: 0 14px 28px rgba(180, 140, 79, 0.28);
      }

      .summary {
        display: grid;
        grid-template-columns: minmax(0, 1.6fr) minmax(220px, 0.8fr);
        gap: 1rem;
        align-items: stretch;
        background: rgba(12, 17, 26, 0.82);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 28px;
        padding: 1.25rem;
      }

      .summary__content {
        display: grid;
        gap: 0.75rem;
      }

      .summary__kicker {
        margin: 0;
        color: #d7b76e;
        font-size: 0.74rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      h2 {
        margin: 0;
        font-size: clamp(1.3rem, 2.2vw, 2.1rem);
        line-height: 1.12;
      }

      .summary__content p:last-child {
        margin: 0;
        color: rgba(227, 235, 255, 0.8);
        line-height: 1.65;
      }

      .summary__badge {
        display: grid;
        gap: 0.3rem;
        padding: 1rem 1.15rem;
        border-radius: 20px;
        background: linear-gradient(135deg, rgba(186, 148, 84, 0.18), rgba(92, 123, 255, 0.14));
        border: 1px solid rgba(215, 183, 110, 0.35);
      }

      .summary__badge-label {
        color: #d7b76e;
        font-size: 0.7rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      .summary__badge strong {
        font-size: 1.7rem;
      }

      .summary__badge small {
        color: rgba(239, 244, 255, 0.82);
      }

      .stats {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 1rem;
      }

      .stat {
        display: grid;
        gap: 0.4rem;
        padding: 1.1rem 1rem;
        border-radius: 20px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: rgba(12, 17, 26, 0.74);
      }

      .stat--primary {
        background: linear-gradient(135deg, rgba(32, 50, 80, 0.8), rgba(13, 17, 26, 0.8));
      }

      .stat__label {
        color: rgba(223, 231, 247, 0.78);
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      .stat__value {
        font-size: clamp(1.5rem, 3vw, 2.1rem);
        letter-spacing: -0.04em;
      }

      .stat__detail {
        color: rgba(223, 231, 247, 0.72);
        font-size: 0.78rem;
      }

      .quick-search,
      .dashboard {
        background: rgba(12, 17, 26, 0.78);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 28px;
        padding: 1.2rem;
      }

      .section-head,
      .dashboard__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        margin-bottom: 1rem;
      }

      h3 {
        margin: 0;
        font-size: clamp(1.15rem, 2vw, 1.7rem);
      }

      .section-head a,
      .dashboard__header span {
        text-decoration: none;
        color: #d7b76e;
        font-weight: 700;
      }

      .category-grid {
        display: grid;
        grid-template-columns: repeat(6, minmax(0, 1fr));
        gap: 0.8rem;
      }

      .category {
        display: grid;
        place-items: center;
        gap: 0.55rem;
        min-height: 104px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 20px;
        background: rgba(255, 255, 255, 0.02);
        color: #edf3ff;
        cursor: pointer;
        padding: 0.75rem 0.4rem;
      }

      .category__icon {
        display: grid;
        place-items: center;
        width: 46px;
        height: 46px;
        border-radius: 14px;
        background: rgba(255, 255, 255, 0.04);
        font-size: 1.5rem;
      }

      .category span:last-child {
        font-weight: 700;
        font-size: 0.78rem;
      }

      .dashboard__grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 0.9rem;
      }

      .mini-panel {
        display: grid;
        gap: 0.25rem;
        padding: 1rem;
        border-radius: 18px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: rgba(255, 255, 255, 0.02);
      }

      .mini-panel--highlight {
        background: linear-gradient(135deg, rgba(183, 148, 74, 0.18), rgba(62, 90, 207, 0.14));
        border-color: rgba(215, 183, 110, 0.38);
      }

      .mini-panel__label {
        color: rgba(223, 231, 247, 0.74);
        font-size: 0.7rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .mini-panel strong {
        font-size: 1.05rem;
      }

      .mini-panel small {
        color: rgba(223, 231, 247, 0.7);
      }

      @media (max-width: 980px) {
        .category-grid {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
      }

      @media (max-width: 760px) {
        .hero,
        .summary,
        .dashboard__grid {
          grid-template-columns: 1fr;
          display: grid;
        }

        .hero {
          gap: 0.8rem;
        }

        .hero__cta {
          width: 100%;
        }

        .summary,
        .stats,
        .dashboard__grid,
        .category-grid {
          grid-template-columns: 1fr 1fr;
        }
      }

      @media (max-width: 520px) {
        .client-home {
          padding-top: 0.75rem;
        }

        .summary,
        .stats,
        .dashboard__grid,
        .category-grid {
          grid-template-columns: 1fr;
        }

        .hero {
          padding: 0 0.2rem;
        }
      }
    `
  ]
})
export class ClientHomeComponent {
  readonly cards: HomeCard[] = [
    { label: 'Servicios activos', value: '240+', detail: 'Profesionales cerca de ti', tone: 'primary' },
    { label: 'Tiempo promedio', value: '15 min', detail: 'Respuesta rápida', tone: 'accent' },
    { label: 'Categorías', value: '18', detail: 'Necesidades resueltas', tone: 'neutral' },
  ];
}
