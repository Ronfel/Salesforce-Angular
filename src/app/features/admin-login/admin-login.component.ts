import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { AdminAuthService } from '../../core/services/admin-auth.service';
import { AuthService } from '../../core/services/auth.service';

/**
 * Login da administração da plataforma (/admin/login).
 *
 * Autentica no Firebase Authentication (e-mail/senha, sem credenciais fixas no
 * frontend) e abre a sessão via `AuthService.openAdminSession`, reutilizando o
 * mesmo modelo de sessão da área comercial. Em sucesso, leva para /admin/empresas.
 */
@Component({
  selector: 'app-admin-login',
  styleUrl: './admin-login.component.scss',
  templateUrl: './admin-login.component.html',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    RouterLink,
  ],
})
export class AdminLoginComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly adminAuth = inject(AdminAuthService);
  private readonly auth = inject(AuthService);

  readonly loginBusy = signal(false);
  readonly loginError = signal('');
  readonly loginForm = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    senha: ['', Validators.required],
  });

  /** Autentica no Firebase e abre a sessão administrativa. */
  async login(): Promise<void> {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      this.loginError.set('Informe um e-mail válido e a senha.');
      return;
    }

    this.loginBusy.set(true);
    this.loginError.set('');
    try {
      const { email, senha } = this.loginForm.getRawValue();
      const identity = await this.adminAuth.signIn(email, senha);
      this.loginForm.controls.senha.setValue('');
      this.auth.openAdminSession(identity);
      await this.router.navigate(['/admin/empresas']);
    } catch (error) {
      this.loginError.set(
        error instanceof Error ? error.message : 'Não foi possível autenticar.',
      );
    } finally {
      this.loginBusy.set(false);
    }
  }
}
