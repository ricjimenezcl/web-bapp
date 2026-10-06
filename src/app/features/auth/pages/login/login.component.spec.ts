import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { SocialAuthService } from '@abacritt/angularx-social-login';

import { LoginComponent } from './login.component';
import { AuthService } from '../../../../core/services/auth.service';
import { CategoryService } from '../../../../core/services/category.service';
import { ContentFilterService } from '../../../../shared/services/content-filter.service';
import { ModalService } from '../../../../core/services/modal.service';

describe('LoginComponent', () => {
  let fixture: ComponentFixture<LoginComponent>;
  let component: LoginComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginComponent, HttpClientTestingModule],
      providers: [
        {
          provide: AuthService,
          useValue: {
            login: jasmine.createSpy('login').and.returnValue(of({ role: 'CLIENT', status: 'ACTIVE' })),
            getLoginRoles: jasmine.createSpy('getLoginRoles').and.returnValue(of({ roles: ['CLIENT'] })),
            registerClient: jasmine.createSpy('registerClient').and.returnValue(of({})),
            registerProvider: jasmine.createSpy('registerProvider').and.returnValue(of({})),
            navigateAfterLogin: jasmine.createSpy('navigateAfterLogin'),
            logout: jasmine.createSpy('logout'),
            sendVerificationEmail: jasmine.createSpy('sendVerificationEmail').and.returnValue(of({}))
          }
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: {
                get: jasmine.createSpy('get').and.returnValue(null)
              }
            }
          }
        },
        {
          provide: SocialAuthService,
          useValue: {
            authState: of(null),
            signIn: jasmine.createSpy('signIn')
          }
        },
        {
          provide: CategoryService,
          useValue: {
            getMainCategories: jasmine.createSpy('getMainCategories').and.returnValue(of({ categories: [] })),
            getServicesByCategory: jasmine.createSpy('getServicesByCategory').and.returnValue(of({ services: [] }))
          }
        },
        {
          provide: ContentFilterService,
          useValue: {
            checkContent: jasmine.createSpy('checkContent').and.returnValue(of({ allowed: true }))
          }
        },
        {
          provide: ModalService,
          useValue: {
            success: jasmine.createSpy('success').and.resolveTo(true),
            warning: jasmine.createSpy('warning').and.resolveTo(true),
            error: jasmine.createSpy('error').and.resolveTo(true)
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('debe pedir elegir el perfil antes de mostrar el formulario de registro', () => {
    component.showAuthModal('register');

    expect(component.activeTab()).toBe('register');
    expect(component.showRegisterProfileChoice()).toBeTrue();

    component.selectRegisterProfile('provider');

    expect(component.registerRole()).toBe('provider');
    expect(component.showRegisterProfileChoice()).toBeFalse();
  });
});
