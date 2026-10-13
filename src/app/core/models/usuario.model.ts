import { UserRole } from './empresa.model';

/**
 * Usuário de acesso à plataforma (entidade distinta do vendedor
 * comercial do ERP). Cada usuário fica vinculado a uma empresa (`empresaId`)
 * e recebe um papel de acesso (`role`) — este é o vínculo "usuário ↔ empresa"
 * da Fase 1.
 *
 * Este registro NÃO guarda senha: a autenticação de vendedores acontece no Web
 * Service (RF001) e a da área administrativa no Firebase Authentication
 * (`AdminAuthService`). Aqui fica apenas o cadastro/ vínculo de identidades.
 */
export interface UsuarioAcesso {
  id: string;
  login: string;
  nome: string;
  /** Papel de acesso do usuário (admin-plataforma / admin-empresa / vendedor). */
  role: UserRole;
  /**
   * Empresa dona do usuário. `null` = plataforma toda (apenas `admin-plataforma`).
   */
  empresaId: string | null;
  /**
   * Presente quando o usuário é também um vendedor externo do ERP: nesses casos
   * a autenticação acontece pela tabela de vendedores (RF001) e este campo apenas
   * mantém o vínculo de identidades.
   */
  sellerId?: string;
  /** Usuários inativos não autenticam nem aparecem para gestão. */
  ativo: boolean;
  createdAt: string;
}
