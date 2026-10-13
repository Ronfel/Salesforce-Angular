# Documento de Visão do Produto
## Evolução do Salesforce para uma plataforma multiempresa integrada a diferentes ERPs

**Versão:** 2.0  
**Status:** Documento de referência para desenvolvimento  
**Objetivo:** orientar a evolução da aplicação existente para uma plataforma multiempresa, configurável e compatível com diferentes APIs de ERP, preservando as funcionalidades atuais.

---

## 1. Visão geral

A aplicação atual é um Salesforce funcional, com interface comercial, autenticação de demonstração, criação de pedidos, sincronização manual e armazenamento local dos dados sincronizados.

O projeto possui um backend próprio responsável pelas integrações. A implementação original foi desenvolvida para um ERP específico, utilizando endpoints fixos e estruturas de dados vinculadas à API desse sistema.

Atualmente, os dados de demonstração são obtidos do Firebase/Firestore. Os dados sincronizados são armazenados no `localStorage` do navegador e, a cada sincronização, os pedidos locais são limpos e recarregados a partir da base oficial do cliente.

O objetivo é transformar a aplicação em uma plataforma multiempresa, permitindo que diferentes empresas utilizem o Salesforce com suas próprias APIs, credenciais e estruturas de dados, sem exigir alterações no código principal a cada nova integração.

A evolução deverá preservar o frontend e o backend existentes sempre que possível, evitando reescritas desnecessárias.

## 2. Objetivos do produto

1. Permitir o cadastro e gerenciamento de empresas clientes.
2. Permitir que cada empresa possua seus próprios usuários e vendedores.
3. Implementar autenticação individual para todos os usuários autorizados.
4. Eliminar dependências de endpoints e credenciais fixos.
5. Permitir a configuração das APIs de diferentes ERPs.
6. Implementar mapeamento configurável entre os campos externos e os modelos internos.
7. Centralizar as integrações e as regras de segurança no backend existente.
8. Preservar a sincronização manual.
9. Manter o ERP como fonte oficial dos dados comerciais e dos pedidos efetivados.
10. Preservar o uso atual do `localStorage` para os dados operacionais sincronizados.
11. Garantir o isolamento dos dados e das operações entre empresas.
12. Permitir adicionar novas integrações sem reescrever a interface comercial.

## 3. Premissas e decisões arquiteturais

### 3.1. O ERP é a fonte oficial

O ERP de cada empresa é a autoridade sobre os dados comerciais oficiais, especialmente pedidos efetivados.

O Salesforce poderá manter dados locais necessários para a experiência do usuário, mas esses dados não serão considerados a fonte oficial.

Um pedido criado no aplicativo e ainda não confirmado pelo ERP deverá ser identificado como local ou pendente de sincronização.

O pedido somente será considerado efetivado após uma confirmação válida do ERP, conforme o contrato da integração.

### 3.2. Sincronização exclusivamente manual

A sincronização continuará sendo iniciada por uma ação explícita do usuário.

Não implementar sincronização automática, agendada ou em tempo real nesta etapa do projeto.

O backend será responsável por consultar a API, normalizar os dados, validar as respostas e disponibilizar os resultados ao frontend.

### 3.3. Persistência dos dados

Os dados comerciais sincronizados não deverão ser copiados permanentemente para o Firestore como uma nova fonte operacional.

A estratégia atual de armazenamento local no `localStorage` deverá ser preservada inicialmente.

O Firestore poderá continuar sendo utilizado para dados de demonstração e para informações de configuração, conforme a arquitetura existente e as decisões de implementação.

As informações de configuração da plataforma poderão incluir:

- Empresas cadastradas.
- Usuários e vínculos com empresas.
- Perfis e permissões.
- Configurações das integrações.
- Mapeamentos de campos.
- Metadados operacionais necessários à administração.

O local exato de persistência dessas informações deverá ser definido após a auditoria do backend e da infraestrutura existente.

### 3.4. Isolamento por empresa

Cada usuário deverá estar associado a uma ou mais empresas autorizadas, conforme as regras de negócio.

Todas as operações protegidas deverão validar a identidade, a empresa e as permissões do usuário no backend.

O frontend não poderá determinar sozinho a autorização de acesso.

### 3.5. Compatibilidade com o projeto atual

- Preservar funcionalidades que já funcionam.
- Reutilizar serviços e componentes existentes.
- Manter o ambiente de demonstração durante a transição.
- Evitar reescritas gerais sem justificativa.
- Não modificar o fluxo de pedidos sem mapear suas dependências.
- Não introduzir uma nova infraestrutura sem necessidade comprovada.

## 4. Arquitetura desejada

A arquitetura deverá separar as seguintes responsabilidades.

### 4.1. Frontend

Responsável por:

- Login e navegação.
- Interface comercial.
- Cadastro e administração das empresas, conforme o perfil.
- Gerenciamento dos usuários.
- Configuração das integrações, conforme as permissões.
- Configuração do mapeamento de campos.
- Solicitação manual de sincronização.
- Exibição dos dados normalizados.
- Exibição de erros e resultados.
- Armazenamento local dos dados operacionais sincronizados.

O frontend não deverá conter regras específicas de cada ERP nem credenciais privadas.

### 4.2. Backend existente

Responsável por:

- Validar a autenticação e a autorização.
- Identificar a empresa do usuário.
- Selecionar a integração correta.
- Gerenciar as configurações de integração.
- Consultar as APIs externas.
- Aplicar os adaptadores e mapeamentos.
- Validar e normalizar os dados.
- Executar o envio de pedidos.
- Interpretar as respostas dos ERPs.
- Registrar logs e resultados das operações.
- Proteger as credenciais das integrações.

O backend deverá ser a camada central de comunicação entre o Salesforce e os sistemas externos.

### 4.3. Camada de integração

Cada integração deverá encapsular as particularidades de uma API.

Deverá definir como:

- Autenticar.
- Consultar os recursos necessários.
- Tratar paginação e limites.
- Interpretar a estrutura das respostas.
- Converter os dados para os modelos internos.
- Enviar pedidos.
- Interpretar confirmações e erros.

A primeira versão deverá priorizar APIs REST/JSON. Outros protocolos poderão ser adicionados conforme os requisitos reais.

### 4.4. Modelo canônico

O Salesforce deverá utilizar modelos internos padronizados, independentes dos nomes dos campos de cada ERP.

Os modelos iniciais deverão contemplar:

- Vendedores.
- Clientes.
- Produtos.
- Pedidos.
- Itens de pedidos.

Os campos definitivos deverão ser derivados da análise do projeto existente, das telas e das regras de negócio.

## 5. Cadastro e gerenciamento de empresas

Criar um módulo administrativo para gerenciar as empresas que utilizam a plataforma.

### Funcionalidades

- Cadastrar empresa.
- Consultar empresas.
- Editar dados cadastrais.
- Ativar e desativar empresa.
- Consultar o status da integração.
- Consultar os usuários vinculados.
- Configurar integrações.
- Consultar o histórico de sincronizações.

O cadastro da empresa deverá ser independente da configuração da API.

A criação de uma empresa não deverá disparar automaticamente uma consulta ao ERP. A conexão deverá ocorrer após a configuração da integração e mediante uma ação explícita de teste ou sincronização.

### Fluxo de ativação

1. Cadastrar a empresa.
2. Criar ou convidar seu administrador.
3. Configurar a integração com o ERP.
4. Testar a conexão.
5. Configurar e validar os mapeamentos.
6. Executar a primeira sincronização manual.
7. Validar os resultados.
8. Liberar o uso operacional conforme as permissões definidas.

## 6. Usuários, administradores e vendedores

Usuários de acesso e vendedores comerciais deverão ser entidades distintas.

### 6.1. Usuários

Cada pessoa que utilizar o Salesforce deverá possuir uma conta individual.

A conta deverá ter:

- Identificador de autenticação.
- Nome e dados de perfil.
- Empresa ou empresas autorizadas.
- Função e permissões.
- Status da conta.
- Vínculo opcional com um vendedor comercial.

O mecanismo de autenticação deverá ser definido após a auditoria do projeto. O Firebase Authentication poderá ser mantido se for compatível com a implementação atual.

### 6.2. Vendedores comerciais

Os vendedores representam os registros comerciais retornados pelo ERP.

A sincronização deverá obter esses registros por meio da API configurada, aplicar o mapeamento e disponibilizá-los no Salesforce.

Um vendedor poderá estar associado a uma conta de usuário, mas essa associação não deverá ser presumida automaticamente apenas pelo nome ou e-mail.

### 6.3. Perfis de acesso

A plataforma deverá prever inicialmente:

**Administrador da plataforma**
- Gerencia as empresas clientes.
- Controla a ativação das empresas.
- Administra configurações globais.
- Não deve depender do perfil de vendedor.

**Administrador da empresa**
- Gerencia os usuários da própria empresa.
- Configura a integração e os mapeamentos, quando autorizado.
- Consulta os resultados das sincronizações.
- Não pode administrar outras empresas.

**Vendedor**
- Possui login individual.
- Acessa as funcionalidades comerciais autorizadas.
- Utiliza os dados sincronizados da empresa.
- Pode criar e enviar pedidos conforme as permissões.

A matriz definitiva de permissões deverá ser documentada e testada antes da disponibilização comercial.

## 7. Gerenciamento das integrações

Criar um módulo para cadastrar e configurar as APIs utilizadas por cada empresa.

Cada integração deverá possuir, conforme aplicável:

- Identificador interno.
- Empresa associada.
- Nome e tipo de ERP.
- Endereço-base da API.
- Método de autenticação.
- Referência segura às credenciais.
- Endpoints ou recursos suportados.
- Configurações de paginação.
- Status da configuração.
- Data do último teste de conexão.
- Data da última sincronização.
- Mensagens de erro relevantes.

### Requisitos

- Permitir configurar uma API sem alterar o frontend comercial.
- Validar as credenciais por meio do backend.
- Permitir testar a conexão antes da primeira sincronização.
- Não armazenar segredos em documentos acessíveis pelo frontend.
- Não expor tokens ou senhas nos logs.
- Permitir que cada empresa utilize sua própria configuração.
- Suportar diferentes métodos de autenticação quando necessários.

A integração deverá estar vinculada à empresa e ser selecionada pelo backend com base na identidade e nas permissões do usuário.

## 8. Mapeamento configurável de campos

Criar um mecanismo de de-para que converta os campos externos para os modelos internos do Salesforce.

### Exemplo

| Campo interno | ERP A | ERP B |
|---|---|---|
| `erpId` | `COD_REP` | `seller_code` |
| `nome` | `NOME_VEND` | `fullName` |
| `email` | `EMAIL_REP` | `contact_email` |
| `ativo` | `SITUACAO` | `isActive` |

O sistema deverá trabalhar com o modelo interno, independentemente dos nomes externos.

### Funcionalidades

- Identificar os campos retornados pela API.
- Associar campos externos aos campos internos.
- Definir campos obrigatórios e opcionais.
- Converter tipos de dados.
- Tratar campos ausentes e valores nulos.
- Interpretar datas e números.
- Transformar códigos de status.
- Percorrer propriedades aninhadas.
- Visualizar uma amostra dos dados transformados.
- Validar o resultado antes de disponibilizá-lo ao frontend.
- Salvar e editar o mapeamento.
- Identificar campos obrigatórios não mapeados.

O mapeamento deverá ser específico para cada integração e entidade.

O mecanismo não deverá executar código arbitrário fornecido pelo usuário. As transformações deverão utilizar operações previamente definidas e validadas.

### Critérios de aceite

- Duas APIs com nomes de campos diferentes deverão produzir o mesmo modelo interno.
- Alterar um mapeamento não deverá exigir alterações na interface comercial.
- Campos obrigatórios ausentes deverão produzir erros compreensíveis.
- Respostas inválidas não deverão ser tratadas como sincronizações bem-sucedidas.

## 9. Sincronização manual dos dados

O processo deverá preservar a estratégia atual de atualização dos dados locais, com controles adicionais para evitar perda de dados válidos.

### Fluxo esperado

1. O usuário solicita a sincronização.
2. O backend valida a identidade, as permissões e a integração.
3. A API do ERP é consultada.
4. Os resultados são processados, paginados e validados.
5. O mapeamento converte os dados para os modelos internos.
6. O backend retorna o resultado ao frontend.
7. O frontend atualiza o armazenamento local.
8. A interface apresenta o resultado da operação.

### Regras importantes

- A sincronização deverá ser iniciada manualmente.
- O frontend não deverá consultar diretamente APIs privadas dos ERPs.
- A substituição dos dados locais deverá ocorrer somente após validar que a resposta está completa e utilizável.
- Uma falha parcial não deverá apagar os últimos dados válidos sem uma regra explícita.
- A aplicação deverá informar erros e permitir uma nova tentativa.
- Sincronizações repetidas deverão manter a consistência dos identificadores e dos relacionamentos.

O comportamento específico de substituição deverá ser definido por entidade. Por exemplo, a atualização de pedidos locais pendentes não deverá ser confundida com a substituição dos pedidos oficiais retornados pelo ERP.

### Limites do armazenamento local

O `localStorage` continuará sendo utilizado inicialmente, conforme a implementação existente.

Entretanto, ele deverá ser tratado como armazenamento local de conveniência, não como fonte oficial ou mecanismo de segurança.

Dados locais podem ser apagados pelo usuário, estar desatualizados ou não existir em outro dispositivo. A aplicação deverá considerar essas limitações sem comprometer o estado oficial mantido pelo ERP.

## 10. Ciclo de vida e sincronização dos pedidos

O fluxo atual de pedidos deverá ser auditado antes de qualquer alteração.

### Estados conceituais

- **Local:** pedido criado no Salesforce, ainda não confirmado pelo ERP.
- **Pendente de envio:** pedido pronto para ser enviado.
- **Em processamento:** operação de envio iniciada.
- **Confirmado:** ERP confirmou o registro.
- **Falha:** ocorreu um erro conhecido que impediu a confirmação.
- **Resultado incerto:** a comunicação falhou e não foi possível determinar se o ERP registrou o pedido.

Esses estados deverão ser adaptados ao modelo existente, evitando alterações incompatíveis sem necessidade.

### Regras obrigatórias

- Um pedido local não será considerado efetivado.
- A confirmação deverá ser baseada em uma resposta válida do ERP.
- O identificador do pedido no ERP deverá ser armazenado no contexto local, quando disponível.
- Erros não poderão ser apresentados como sucesso.
- Um timeout não deverá provocar automaticamente o reenvio cego de um pedido.
- Antes de reenviar uma operação de resultado incerto, o backend deverá verificar se o pedido foi registrado no ERP, quando a API permitir.
- Se o ERP oferecer suporte, utilizar chave de idempotência ou mecanismo equivalente.
- O estado local deverá ser reconciliado com o estado oficial retornado pelo ERP.

O ERP continuará sendo a autoridade sobre a existência e a efetivação dos pedidos.

## 11. Segurança e isolamento

A segurança deverá acompanhar todas as fases de implementação.

### Requisitos

- Autenticação individual dos usuários.
- Validação de permissões no backend.
- Associação explícita entre usuário e empresa.
- Isolamento dos dados e operações entre empresas.
- Proteção das credenciais dos ERPs.
- Validação das entradas recebidas.
- Logs sem exposição de segredos.
- Regras de acesso adequadas ao Firestore, quando utilizado.
- Testes de acesso autorizado e não autorizado.

Se o backend utilizar o SDK administrativo do Firebase, deverá implementar a autorização no próprio backend. As regras de segurança do Firestore não substituem essa validação para operações executadas por bibliotecas administrativas.

A autorização deverá ser validada em todas as operações relevantes, inclusive cadastro de usuários, configuração de integrações, sincronização e envio de pedidos.

## 12. Estratégia de implementação por fases

### Fase 0 — Auditoria técnica

Antes de alterar o código:

- Identificar a estrutura do frontend e do backend.
- Mapear os endpoints fixos.
- Identificar os modelos e serviços existentes.
- Documentar o fluxo de sincronização.
- Documentar o fluxo de criação e envio de pedidos.
- Identificar como o `localStorage` é atualizado.
- Identificar as coleções do Firestore.
- Analisar a autenticação atual.
- Identificar as regras de segurança existentes.
- Mapear as dependências específicas do ERP original.

**Entrega:** diagnóstico técnico e plano incremental de evolução.

### Fase 1 — Fundação multiempresa

- Criar o modelo de empresa.
- Implementar o vínculo entre usuários e empresas.
- Definir funções e permissões.
- Implementar o isolamento no backend.
- Preparar a administração das empresas.
- Preservar o ambiente de demonstração.

**Critério de conclusão:** duas empresas de teste utilizam o sistema sem acesso cruzado a dados ou operações.

### Fase 2 — Modelos canônicos

- Definir os modelos internos.
- Criar um adaptador para os dados fictícios existentes.
- Separar a interface das estruturas específicas do ERP original.
- Padronizar os serviços consumidos pelas telas.
- Preservar o comportamento atual da sincronização.

**Critério de conclusão:** a interface operacional utiliza modelos internos independentes dos nomes de campos do ERP.

### Fase 3 — Configuração de integrações

- Criar o cadastro das integrações.
- Implementar o armazenamento seguro das credenciais.
- Implementar o teste de conexão.
- Configurar endpoints e recursos.
- Criar o mapeamento de campos.
- Implementar validação e prévia dos dados.

**Critério de conclusão:** uma integração pode ser configurada sem modificar a interface comercial.

### Fase 4 — Importação e sincronização

- Implementar a importação de vendedores.
- Implementar a importação de clientes.
- Implementar a importação de produtos.
- Validar os modelos normalizados.
- Atualizar o armazenamento local de forma controlada.
- Tratar paginação, falhas e respostas inválidas.
- Registrar o resultado das operações.

**Critério de conclusão:** duas APIs com estruturas diferentes conseguem alimentar os mesmos modelos internos.

### Fase 5 — Adaptação do fluxo de pedidos

- Revisar o ciclo de vida atual.
- Adaptar o envio ao mecanismo de integração.
- Implementar os estados necessários.
- Tratar idempotência e resultado incerto.
- Preservar os identificadores externos.
- Evitar reenvios indevidos.
- Validar a confirmação do ERP.

**Critério de conclusão:** pedidos só são considerados efetivados após confirmação válida do ERP.

### Fase 6 — Validação para produção

- Testar o isolamento entre empresas.
- Testar autenticação e permissões.
- Testar respostas inválidas.
- Testar falhas de conexão.
- Testar sincronizações repetidas.
- Testar pedidos com resultado incerto.
- Revisar o armazenamento de segredos.
- Validar logs e tratamento de erros.
- Documentar a configuração de novas integrações.

**Critério de conclusão:** o sistema atende aos requisitos de segurança, consistência e operação definidos para a primeira versão comercial.

## 13. Orientações obrigatórias para as IAs de desenvolvimento

Todas as IAs que trabalharem no projeto deverão seguir estas instruções:

1. Analisar o código existente antes de propor alterações.
2. Identificar arquivos, serviços, modelos e endpoints envolvidos.
3. Não presumir estruturas ou comportamentos sem verificar o projeto.
4. Não reescrever módulos funcionais sem justificativa.
5. Propor um plano antes de mudanças estruturais relevantes.
6. Não implementar endpoints fixos de ERP no frontend.
7. Não incluir credenciais privadas no frontend ou no repositório.
8. Não misturar a identidade do usuário com o registro comercial do vendedor.
9. Não considerar pedidos efetivados antes da confirmação do ERP.
10. Não usar o Firestore como repositório operacional permanente dos dados comerciais sincronizados.
11. Preservar o `localStorage` como estratégia inicial de armazenamento local.
12. Não apagar dados locais válidos antes de validar a nova resposta da sincronização.
13. Implementar testes para alterações relevantes.
14. Não alterar dados de produção durante testes ou migrações sem autorização explícita.
15. Documentar mudanças nos modelos, endpoints e contratos.
16. Preservar o ambiente de demonstração durante a transição.
17. Apresentar conflitos entre o documento e o código atual antes de realizar alterações invasivas.

### Formato esperado para cada feature

Cada solicitação de desenvolvimento deverá especificar:

- Objetivo.
- Contexto atual.
- Requisitos funcionais.
- Requisitos técnicos.
- Segurança e permissões.
- Critérios de aceite.
- Testes positivos, negativos e de falha.
- Arquivos e componentes afetados.
- Dependências e riscos.
- Documentação a atualizar.

## 14. Primeira tarefa recomendada

A primeira tarefa deverá ser exclusivamente uma auditoria técnica.

A IA deverá analisar o frontend, o backend, o Firebase, o Firestore, o armazenamento local, as integrações com o ERP e o ciclo de vida dos pedidos.

Deverá identificar as dependências fixas, documentar os fluxos atuais, avaliar os riscos de introduzir multiempresa e propor uma sequência mínima de alterações.

A entrega deverá conter:

- Diagnóstico do estado atual.
- Arquivos e serviços relevantes.
- Dependências específicas do ERP original.
- Fluxo atual de sincronização.
- Fluxo atual de envio de pedidos.
- Modelo atual de autenticação.
- Estratégia atual de armazenamento.
- Lacunas de segurança.
- Plano incremental de migração.
- Decisões que precisam ser tomadas antes da implementação.

Nenhum código deverá ser alterado durante essa primeira tarefa.

## 15. Fora do escopo inicial

Não priorizar nesta etapa:

- Sincronização automática ou em tempo real.
- Suporte universal a qualquer ERP.
- Execução de scripts arbitrários de transformação.
- Migração geral para microsserviços.
- Banco de dados operacional separado por empresa.
- Persistência permanente no Firestore de cópias dos dados comerciais.
- Marketplace de integrações.
- Cobrança automatizada e planos comerciais complexos.

Esses itens poderão ser reavaliados após validar a arquitetura multiempresa e a primeira integração externa.

## 16. Definição de sucesso

A evolução será considerada bem-sucedida quando:

- O sistema permitir cadastrar e administrar múltiplas empresas.
- Cada vendedor possuir uma conta individual.
- O isolamento entre empresas estiver validado.
- O backend selecionar a integração correta conforme a empresa.
- Os modelos internos forem independentes dos formatos externos.
- Os campos puderem ser mapeados por configuração.
- Duas APIs diferentes conseguirem alimentar os mesmos modelos.
- A sincronização continuar sendo manual.
- Os dados comerciais sincronizados permanecerem no armazenamento local previsto, sem criar uma cópia operacional permanente no Firestore.
- A atualização local for protegida contra falhas de sincronização.
- Os pedidos só forem considerados efetivados após confirmação do ERP.
- Os reenvios forem tratados sem duplicidade indevida.
- O ambiente de demonstração continuar funcionando.
- O projeto possuir testes e documentação suficientes para permitir evolução incremental.

---

## Princípio arquitetural final

O Salesforce deve ser independente do ERP; o backend deve centralizar as integrações e as regras de segurança; os modelos canônicos devem padronizar os dados; o armazenamento local deve atender às necessidades de uso do vendedor; e o ERP deve permanecer como fonte oficial dos dados comerciais e dos pedidos efetivados.
