import { Component, OnInit, OnDestroy, ElementRef, PLATFORM_ID, Inject, Input } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-device-3d-login',
  standalone: true,
  templateUrl: './device-3d-login.component.html',
  styleUrls: ['./device-3d-login.component.scss']
})
export class Device3dLoginComponent implements OnInit, OnDestroy {
  @Input() variant: 'provider-register' | 'login' | 'categories' | 'map' | 'providers' | 'booking' = 'login';
  
  constructor(
    private readonly elementRef: ElementRef,
    @Inject(PLATFORM_ID) private readonly platformId: Object
  ) {}

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.init3DEffect();
    }
  }

  ngOnDestroy(): void {
    if (isPlatformBrowser(this.platformId)) {
      document.removeEventListener('mousemove', this.handleMouseMove);
      document.removeEventListener('mouseleave', this.handleMouseLeave);
    }
  }

  private init3DEffect(): void {
    // Solo activar en desktop para evitar problemas de scroll en móviles
    if (globalThis.matchMedia("(min-width: 768px)").matches) {
      document.addEventListener('mousemove', this.handleMouseMove);
      document.addEventListener('mouseleave', this.handleMouseLeave);
    }
  }

  private readonly handleMouseMove = (e: MouseEvent): void => {
    const scene = this.elementRef.nativeElement.querySelector('.scene');
    if (!scene) return;

    const centerX = globalThis.innerWidth / 2;
    const centerY = globalThis.innerHeight / 2;
    const mouseX = (e.clientX - centerX) / centerX;
    const mouseY = (e.clientY - centerY) / centerY;
    
    // Rotación máxima de 12 grados para que se vea sutil y profesional
    const maxRotation = 12; 
    const rotateX = mouseY * -maxRotation; 
    const rotateY = mouseX * maxRotation;
    
    scene.style.setProperty('--rot-x', `${rotateX}deg`);
    scene.style.setProperty('--rot-y', `${rotateY}deg`);
  }

  private readonly handleMouseLeave = (): void => {
    const scene = this.elementRef.nativeElement.querySelector('.scene');
    if (!scene) return;

    scene.style.setProperty('--rot-x', `0deg`);
    scene.style.setProperty('--rot-y', `0deg`);
    scene.style.transition = 'transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)';
    
    setTimeout(() => {
      scene.style.transition = 'transform 0.1s ease-out';
    }, 500);
  }
}
