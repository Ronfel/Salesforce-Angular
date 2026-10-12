import { TestBed } from '@angular/core/testing';
import { ConnectionsComponent } from './connections.component';
import { ConnectionService } from '../../core/services/connection.service';
import { NotificationService } from '../../core/services/notification.service';

describe('ConnectionsComponent', () => {
  let service: ConnectionService;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [ConnectionsComponent],
      providers: [ConnectionService, NotificationService],
    }).compileComponents();

    service = TestBed.inject(ConnectionService);
  });

  it('deve criar o componente', () => {
    const fixture = TestBed.createComponent(ConnectionsComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('adicionar() cadastra a conexão e limpa o formulário', () => {
    const fixture = TestBed.createComponent(ConnectionsComponent);
    const cmp = fixture.componentInstance;

    cmp.nome.set('API Canônica');
    cmp.url.set('https://api.exemplo.com');
    cmp.adicionar();

    expect(service.conexoes().length).toBe(1);
    expect(service.conexoes()[0].nome).toBe('API Canônica');
    expect(cmp.nome()).toBe('');
    expect(cmp.url()).toBe('');
  });

  it('não adiciona quando nome ou URL estão vazios', () => {
    const fixture = TestBed.createComponent(ConnectionsComponent);

    fixture.componentInstance.adicionar();
    expect(service.conexoes().length).toBe(0);
  });

  it('a primeira conexão cadastrada já entra ativa', () => {
    const fixture = TestBed.createComponent(ConnectionsComponent);
    fixture.componentInstance.nome.set('A');
    fixture.componentInstance.url.set('https://a.com');
    fixture.componentInstance.adicionar();

    expect(service.hasActive()).toBe(true);
    expect(service.ativa()?.nome).toBe('A');
  });

  it('ativar() marca a conexão escolhida como ativa', () => {
    service.add('A', 'https://a.com');
    service.add('B', 'https://b.com');
    const segunda = service.conexoes()[1];

    const fixture = TestBed.createComponent(ConnectionsComponent);
    fixture.componentInstance.ativar(segunda.id);

    expect(service.ativa()?.id).toBe(segunda.id);
  });

  it('remover() apaga a conexão do serviço', () => {
    service.add('A', 'https://a.com');
    const alvo = service.conexoes()[0];
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const fixture = TestBed.createComponent(ConnectionsComponent);
    fixture.componentInstance.remover(alvo.id);

    expect(service.conexoes().length).toBe(0);
  });
});
