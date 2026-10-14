import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { AuthService } from '../../core/services/auth.service';

/**
 * Tela de Login (RF001): Usuário e Senha validados no Web
 * Service (RNF006). A sessão permanece até o logout (RNF007).
 */
@Component({
  selector: 'app-login',
  styleUrl: './login.component.scss',
  templateUrl: './login.component.html',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
  ],
})
export class LoginComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);

  readonly loginBusy = signal(false);
  readonly loginError = signal('');
  readonly resetBusy = signal(false);
  readonly resetEnviado = signal(false);
  readonly loginForm = this.formBuilder.nonNullable.group({
    login: ['', Validators.required],
    senha: ['', Validators.required],
  });

  /** RF001 - valida os campos e autentica no Web Service. */
  async login(): Promise<void> {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      this.loginError.set('Informe Usuário e Senha.');
      return;
    }

    this.loginBusy.set(true);
    this.loginError.set('');
    this.resetEnviado.set(false);
    try {
      await this.auth.login(this.loginForm.getRawValue());
      this.loginForm.controls.senha.setValue('');
      await this.router.navigate(['/']);
    } catch (error) {
      this.loginError.set(
        error instanceof Error ? error.message : 'Não foi possível efetuar o login.',
      );
    } finally {
      this.loginBusy.set(false);
    }
  }

  /** Envia o e-mail OFICIAL do Firebase para definir/redefinir a senha. */
  async esqueciSenha(): Promise<void> {
    const login = this.loginForm.controls.login.value.trim();
    if (!login) {
      this.loginForm.controls.login.markAsTouched();
      this.loginError.set('Informe o e-mail (login) para receber o link de definição de senha.');
      return;
    }
    this.resetBusy.set(true);
    this.loginError.set('');
    try {
      await this.auth.sendPasswordReset(login);
      this.resetEnviado.set(true);
    } catch (error) {
      this.loginError.set(
        error instanceof Error ? error.message : 'Não foi possível enviar o e-mail.',
      );
    } finally {
      this.resetBusy.set(false);
    }
  }
}
