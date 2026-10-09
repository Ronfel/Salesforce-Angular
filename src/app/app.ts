import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

registerLocaleData(localePt);

/**
 * Raiz da aplicação: apenas despacha para o router (MVC - o router atua como
 * controlador de rotas). O layout (ShellComponent) e as telas ficam nas rotas
 * definidas em `app.routes.ts`.
 */
@Component({
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
  imports: [RouterOutlet],
})
export class App {}
