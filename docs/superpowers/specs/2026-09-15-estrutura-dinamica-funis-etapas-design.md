# Estrutura dinâmica de Funis e Etapas

Data: 2026-09-15
Projeto: OMNI Flow Lab
Status: desenho aprovado para revisão final

## 1. Objetivo

Transformar os cinco funis e suas etapas, hoje definidos de forma fixa no código, em uma estrutura administrável no banco de dados, sem alterar os IDs técnicos já usados pelas vendas e históricos.

A mudança deve permitir que Administrador e BKO:

- ativem ou desativem um funil inteiro;
- ativem ou desativem etapas individualmente;
- editem o nome exibido das etapas;
- reativem futuramente funis ou etapas sem recriá-los.

A configuração ativa deve controlar a exibição do Pipeline, a criação de novas vendas e todas as transições automáticas ou manuais.

## 2. Escopo funcional

Os cinco funis existentes permanecem tecnicamente os mesmos:

1. `prospeccao` — Prospecção
2. `followup` — Follow Up
3. `processos_bko` — Processos BKO
4. `assinatura` — Assinatura
5. `suporte` — Suporte

Os IDs técnicos dos funis e das etapas são imutáveis. Apenas o nome exibido das etapas poderá ser editado nesta versão.

Não faz parte deste escopo criar, excluir ou reordenar funis e etapas. O objetivo é ativar/desativar e renomear etapas preservando a estrutura técnica existente.

## 3. Permissões

Somente usuários com perfil `admin` ou `bko` podem alterar a estrutura.

Administrador e BKO podem:

- ativar/desativar funis;
- ativar/desativar etapas;
- editar nomes de etapas.

Gestor, Consultor e demais perfis apenas consomem a estrutura ativa no Pipeline e nas demais telas. Eles não recebem controles de edição.

As permissões devem existir tanto na interface quanto no banco, via RLS e/ou funções protegidas. Ocultar botões no frontend não é considerado proteção suficiente.

## 4. Modelo de dados

A fonte de verdade passa a ser o Supabase externo.

### 4.1. Catálogo de funis

Tabela sugerida: `pipeline_funis`

Campos mínimos:

- `id text primary key` — ID técnico imutável;
- `nome text not null` — nome exibido do funil, inicialmente igual ao atual;
- `ordem integer not null` — ordem fixa da estrutura;
- `ativo boolean not null default true`;
- `participa_fluxo_comercial boolean not null` — `true` para Prospecção, Follow Up, Processos BKO e Assinatura; `false` para Suporte;
- `created_at`;
- `updated_at`;
- `updated_by`.

Nesta versão, o nome dos funis não será editável pela interface, embora fique persistido no catálogo para eliminar dependência de nomes hardcoded.

### 4.2. Catálogo de etapas

Tabela sugerida: `pipeline_etapas`

Campos mínimos:

- `id text primary key` — ID técnico atual e imutável;
- `funil_id text not null` — FK para `pipeline_funis.id`;
- `nome text not null` — nome exibido e editável;
- `cor text not null` — preserva a identidade visual atual;
- `ordem integer not null` — ordem atual da etapa;
- `ativo boolean not null default true`;
- `created_at`;
- `updated_at`;
- `updated_by`.

A migração deve semear os cinco funis e todas as etapas atuais usando exatamente os IDs existentes no código.

## 5. Regras de integridade

### 5.0. Definição de venda ativa para bloqueios

Para as validações desta funcionalidade, uma venda é considerada ativa quando ainda pertence ao Pipeline operacional atual.

A contagem deve seguir a mesma regra usada por `vendasPipeline`:

- ignora vendas com `deleted_at` preenchido;
- ignora vendas com `is_deleted = true`;
- ignora vendas com `status_pedido = cancelado`;
- ignora vendas com `status_pedido = reprovado`;
- ignora vendas na etapa final de Suporte `s-concluido`;
- todas as demais vendas contam como ativas, inclusive vendas já marcadas como ativadas comercialmente enquanto ainda permanecem no Pipeline.

A validação no banco deve usar essa mesma definição, independentemente do filtro de ambiente ou mês da interface.

### 5.1. Bloqueio por vendas ativas

Antes de desativar um funil, o sistema deve contar vendas ativas naquele funil.

Se houver uma ou mais vendas, a operação é bloqueada. A mensagem deve informar a quantidade e orientar o usuário a mover as vendas antes de continuar.

Exemplo:

> Não é possível desativar este funil. Existem 7 vendas ativas nele. Mova essas vendas para outro funil antes de continuar.

Antes de desativar uma etapa, o sistema faz a mesma validação limitada àquela etapa.

Antes de editar o nome de uma etapa, a mesma validação é aplicada. Se houver vendas ativas naquela etapa, a edição é bloqueada até que ela fique vazia.

Não existe opção de “continuar mesmo assim”.

### 5.2. Funil ativo exige etapa ativa

Um funil ativo precisa possuir pelo menos uma etapa ativa.

Se o usuário tentar desativar a última etapa ativa de um funil ainda ativo, a ação é bloqueada.

Mensagem sugerida:

> Este funil precisa ter pelo menos uma etapa ativa. Desative o funil inteiro ou mantenha uma etapa disponível.

Um funil inativo pode manter etapas ativas ou inativas internamente para permitir preparação antes de uma futura reativação.

Ao reativar um funil, o sistema exige que exista pelo menos uma etapa ativa nele.

### 5.3. Destinos válidos

Nenhuma criação ou movimentação pode gravar uma venda em:

- funil inativo;
- etapa inativa;
- etapa pertencente a outro funil;
- funil ativo sem etapa válida.

Essa regra deve ser validada também no banco para impedir gravações inválidas por chamadas diretas ao Supabase.

## 6. Entrada automática de novas vendas

A sequência comercial fixa é:

`Prospecção → Follow Up → Processos BKO → Assinatura`

Suporte fica fora da sequência automática.

Ao criar uma nova venda, o sistema deve:

1. ler os funis comerciais por ordem;
2. ignorar qualquer funil inativo;
3. escolher o primeiro funil comercial ativo;
4. dentro dele, escolher a primeira etapa ativa por ordem;
5. criar a venda nesse destino.

Exemplo aprovado:

- Prospecção inativo;
- Follow Up inativo;
- Processos BKO ativo;
- `Pendente Consultor` ativo.

Resultado: nova venda nasce em `Processos BKO → Pendente Consultor`.

Se `Pendente Consultor` também estiver inativo, a venda nasce na próxima etapa ativa de Processos BKO.

Se nenhum dos quatro funis comerciais possuir um destino válido, a criação é bloqueada com uma mensagem clara para Admin/BKO corrigirem a estrutura. O sistema nunca deve usar Suporte como fallback de nova venda.

## 7. Transições entre funis e etapas

A mesma lógica da criação vale para movimentações automáticas.

Quando uma automação precisar enviar a venda para o próximo funil comercial:

1. percorre a sequência comercial após o funil atual;
2. ignora funis inativos;
3. seleciona o próximo funil ativo;
4. seleciona a primeira etapa ativa desse funil.

Exemplo:

- venda está em Prospecção;
- Follow Up está inativo;
- Processos BKO está ativo.

Ao executar a ação que normalmente levaria ao Follow Up, a venda deve ir diretamente para a primeira etapa ativa de Processos BKO.

Movimentações manuais também só podem oferecer etapas ativas pertencentes a funis ativos.

As automações atuais baseadas em IDs específicos devem ser adaptadas para consultar o resolvedor de destino ativo, em vez de assumir que o funil/etapa seguinte está disponível.

## 8. Suporte

Suporte é administrável exatamente como os demais funis:

- pode ser ativado/desativado;
- suas etapas podem ser ativadas/desativadas;
- seus nomes de etapa podem ser editados;
- todas as mesmas proteções de vendas ativas e última etapa válida se aplicam.

A única diferença é que Suporte não participa da sequência automática de entrada ou avanço comercial.

Se Suporte estiver inativo, ações como “Enviar para Suporte” ficam indisponíveis e devem exibir mensagem explicando que o funil está desativado.

## 9. Pipeline

O Pipeline deve consumir a configuração do banco.

Para usuários operacionais:

- funil inativo não aparece como aba;
- etapa inativa não aparece como coluna;
- contagens consideram apenas a estrutura ativa;
- destinos de drag-and-drop ou ações rápidas nunca incluem etapas inativas.

Se o funil selecionado na interface for desativado enquanto a tela estiver aberta, o frontend deve redirecionar a visualização para o primeiro funil ativo disponível.

A tela de Configurações é a exceção: nela, todos os cinco funis e todas as etapas continuam visíveis, inclusive os inativos, para permitir reativação.

## 10. Tela Configurações → Estrutura

Cada funil permanece em um card próprio.

O card mostra:

- nome do funil;
- total de etapas;
- total de etapas ativas;
- estado do funil;
- controle de ativar/desativar para Admin/BKO.

Estado visual:

- ativo: verde;
- inativo: vermelho, com aparência esmaecida.

Cada etapa mostra:

- nome atual;
- estado ativo/inativo;
- indicador verde ou vermelho;
- ação para editar nome;
- controle de ativar/desativar.

Ao tentar uma operação bloqueada, a interface deve mostrar um diálogo explicando o motivo e a quantidade de vendas encontradas, quando aplicável.

Não haverá exclusão física de funis ou etapas nesta versão.

## 11. Auditoria e histórico

Toda alteração de estrutura feita por Admin/BKO deve gerar registro de auditoria contendo:

- usuário;
- perfil;
- data e hora;
- entidade (`funil` ou `etapa`);
- ID técnico;
- operação (`ativacao`, `desativacao`, `renomeacao`);
- valor anterior;
- valor novo.

Renomear uma etapa não altera IDs técnicos nem reescreve históricos antigos.

Registros históricos que já armazenam texto ou snapshot permanecem com o valor original. A auditoria da renomeação registra explicitamente nome anterior e nome novo.

## 12. Compatibilidade com o código atual

Atualmente, `FUNIS` e `ETAPAS` em `src/lib/mock-data.ts` são a fonte fixa usada em Configurações, Pipeline e automações. A Nova Venda também grava diretamente `prospeccao / p-aguardando`.

Após a implementação:

- o banco passa a ser a fonte de verdade para nome e estado ativo/inativo;
- IDs técnicos e tipos existentes são preservados;
- constantes legadas podem permanecer temporariamente apenas para compatibilidade, mapeamentos e migração, mas não podem continuar decidindo disponibilidade ou nome exibido em fluxos principais;
- a criação de venda deixa de hardcodar `prospeccao / p-aguardando`;
- `moveVenda` e ações rápidas deixam de assumir destinos fixos sem verificar disponibilidade.

## 13. Segurança no banco

O banco deve garantir:

- leitura da estrutura para usuários autenticados que precisam operar o sistema;
- escrita apenas por `admin` e `bko`;
- bloqueio de desativação/renomeação quando houver vendas ativas no escopo;
- bloqueio de funil ativo sem etapa ativa;
- bloqueio de venda apontando para funil ou etapa inativos;
- consistência entre `vendas.funil` e `vendas.etapa_id`.

As validações críticas devem ser transacionais para evitar corrida entre a contagem de vendas e a alteração da configuração.

## 14. Estratégia de implementação

A implementação deverá ser feita em branch própria, com migração aditiva e sem apagar dados existentes.

Ordem recomendada:

1. criar catálogos e semear estrutura atual;
2. implementar políticas e funções/validações de banco;
3. criar camada única de leitura/resolução da estrutura no frontend;
4. migrar Configurações → Estrutura;
5. migrar Nova Venda;
6. migrar Pipeline e movimentações;
7. adaptar ações automáticas e Suporte;
8. adicionar auditoria;
9. validar build, permissões e cenários de transição;
10. integrar na `main` somente após CI verde.

## 15. Critérios de aceitação

A funcionalidade só é considerada concluída quando todos os cenários abaixo passarem:

- Admin consegue desativar e reativar funil vazio.
- BKO consegue desativar e reativar funil vazio.
- Consultor não consegue alterar estrutura, inclusive por chamada direta ao banco.
- Funil com venda ativa não pode ser desativado.
- Etapa com venda ativa não pode ser desativada.
- Etapa com venda ativa não pode ser renomeada.
- Última etapa ativa de um funil ativo não pode ser desativada.
- Funil sem etapa ativa não pode ser reativado.
- Funis inativos desaparecem do Pipeline operacional.
- Etapas inativas desaparecem das colunas e destinos manuais.
- Nova venda entra no primeiro funil comercial ativo e na primeira etapa ativa.
- Com Prospecção e Follow Up inativos, nova venda entra em Processos BKO.
- Se a primeira etapa de Processos BKO estiver inativa, a nova venda entra na próxima etapa ativa.
- Suporte nunca é escolhido como destino automático de nova venda.
- Transição automática pula funis inativos.
- Transição automática pula etapas indisponíveis e usa a primeira etapa ativa do destino.
- Envio para Suporte é bloqueado quando Suporte está inativo.
- Renomear etapa altera o nome exibido sem alterar seu ID técnico.
- Histórico anterior não é reescrito após renomeação.
- Cada alteração estrutural gera auditoria com antes/depois.
- Build de produção passa sem erro.

## 16. Fora de escopo

Não será implementado nesta entrega:

- criação de novos funis;
- criação de novas etapas;
- exclusão física de funis ou etapas;
- edição do ID técnico;
- edição do nome dos funis;
- reordenação por drag-and-drop;
- uso de Suporte como parte do fluxo comercial automático.
