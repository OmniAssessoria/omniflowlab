# Acompanhamento da Gestão — Design

**Data:** 26/09/2026  
**Projeto:** OMNI Flow Lab  
**Status:** especificação para revisão antes da implementação  
**Acesso:** somente `admin` e `gestor`

## 1. Objetivo

Criar uma página própria de **Acompanhamento da Gestão** que substitua a dependência da planilha operacional atual por uma experiência visual, configurável e auditável dentro do OMNI Flow Lab.

A página não deve duplicar a Dashboard. A Dashboard continua sendo a visão executiva de resultados; o Acompanhamento será a visão de operação, metas, residual, ritmo semanal, acompanhamento por consultor e concentração de pedidos em situações/status que exigem atenção da gestão.

Nesta primeira entrega, a página deve ficar **estruturalmente pronta**, com configurações, metas e estados vazios, mas **sem calcular valores reais de vendas** até que as regras comerciais sejam validadas com a gestora.

## 2. Fonte de referência

A estrutura visual e os nomes dos blocos partem de:
- conversas de definição do fluxo com Pablo;
- planilha "SIMULADOR VENDAS MÊS";
- planilha "2SIMULADOR VENDAS MÊS".

Os valores existentes nas planilhas são apenas exemplos históricos e **não devem ser importados nem usados como dados iniciais**.

## 3. Princípios

1. **Configuração antes de cálculo.** Nenhum número comercial será inferido sem uma regra configurada.
2. **Sem venda silenciosamente fora da classificação.** Novo tipo de pedido criado pelo BKO deve aparecer como pendência para Gestor/Admin.
3. **Cada quadro tem configuração própria.** Alterar a regra de um quadro não altera outro.
4. **Status manual e robô são fontes diferentes, mas podem representar o mesmo status lógico.**
5. **Nada de fuzzy matching sem aprovação.** A normalização serve apenas para caixa, acento, espaços e prefixos técnicos conhecidos.
6. **Histórico e auditoria.** Mudanças de meta, classificação ou configuração devem registrar usuário e data.
7. **Consultores vêm do sistema.** A lista de consultores não é digitada manualmente.
8. **Sem números de venda nesta fase.** A UI deverá exibir estado "Aguardando configuração" / zero controlado até a fase de cálculo real.

## 4. Navegação e permissão

Adicionar item no menu lateral:

- **Acompanhamento**
- rota sugerida: `/acompanhamento`
- perfis: `admin` e `gestor`

Adicionar a mesma regra em `ROUTE_ROLES` para impedir acesso por URL para Consultor, BKO e Closer.

O seletor global de ambiente da OMNI não deve determinar silenciosamente os cálculos dessa página. A página terá seus próprios filtros de operadora quando necessário.

## 5. Estrutura da página

### 5.1 Cabeçalho

Exibir:
- título "Acompanhamento da Gestão";
- mês e ano selecionados;
- indicador de configuração pendente;
- botão "Configurações do acompanhamento";
- resumo de quantos tipos de pedido aguardam classificação;
- nenhuma receita/venda real nesta fase.

### 5.2 Meta mensal

Estrutura configurável do mês:

- **NP e Fixa**
- **Outros**
- **Meta total do mês** = NP e Fixa + Outros

Os valores são definidos manualmente por Gestor/Admin.

A nomenclatura poderá ser refinada posteriormente com a gestora, sem exigir alteração do modelo de dados.

### 5.3 Vendas em Processo — Claro

Categorias visuais:
- Portado
- Novo
- Fixa / Banda Larga / TV
- Outros
- Total

Cada categoria terá espaços para:
- Receita
- Quantidade

Na primeira fase, sem fonte de venda conectada, os campos de resultado mostram estado vazio.

### 5.4 Vendas em Processo — Vivo

Categorias visuais:
- Portado
- Novo
- Fixa / Banda Larga / TV / SIP
- Outros
- Total

Cada categoria terá:
- Receita
- Quantidade

### 5.5 Total Geral

Resumo consolidado com filtro local:

- Tudo
- Claro
- Vivo

Linhas:
- Portabilidade
- Novo e Fixa
- Total NP e Fixa
- Total Outros
- Total Geral

Regras conceituais:
- Portabilidade consolida os grupos classificados como Portado.
- Novo e Fixa consolida Novo + grupo de Fixa da operadora.
- Total NP e Fixa = Portabilidade + Novo e Fixa.
- Total Geral = Total NP e Fixa + Total Outros.

Sem cálculo real nesta primeira fase.

### 5.6 Residual do mês

Linhas:
- Residual NP e Fixa
- Residual Outros
- Residual Geral

Colunas:
- Receita residual
- Por semana

O residual futuro será a diferença entre meta e resultado válido do período.

O valor "Por semana" será inicialmente sugerido pelo sistema, mas poderá ser editado pela gestão.

## 6. Classificação de tipos de pedido

### 6.1 Fonte

A fonte do catálogo será `tipos_pedido_catalogo`, hoje já separado por operadora.

### 6.2 Regra obrigatória

Todo tipo de pedido ativo deve possuir classificação para os contextos em que o acompanhamento exigir agrupamento.

Quando o BKO inserir um novo tipo:
- ele aparece automaticamente na central de classificação como **Não classificado**;
- a página mostra alerta visível para Gestor/Admin;
- o tipo não será silenciosamente jogado em "Outros";
- o gestor deverá vinculá-lo manualmente.

### 6.3 Contextos de classificação

Não hardcodar uma única classificação universal. O mesmo tipo pode precisar de classificação diferente em blocos diferentes.

Criar conceito de **contexto de agrupamento**, por exemplo:
- `processo_claro`
- `processo_vivo`
- `total_geral`
- `meta_semanal`

Os grupos visuais são cadastrados por contexto.

### 6.4 Auditoria

Cada vínculo registra:
- tipo de pedido;
- operadora;
- contexto;
- grupo;
- usuário que classificou;
- criado em;
- atualizado em.

## 7. Meta semanal do mês

A meta mensal gera uma sugestão de divisão automática pelas semanas do mês.

A gestão pode editar livremente a distribuição.

Bloco visual:
- Novo / Importado
- Renovação
- Total

Observação: a planilha usa em alguns pontos "Novo e Portado", enquanto a definição verbal atual usa "Novo / Importado". Nesta primeira fase o rótulo deve seguir a definição verbal e permanecer configurável para revisão posterior com a gestora. Nenhum cálculo será conectado antes dessa validação.

A página deve suportar meses com 4 ou 5 semanas operacionais, sem fixar o layout em exatamente quatro colunas.

## 8. Quadros semanais de resultado

### 8.1 Contratos Gerados Semana / Data de Recebimento

Linhas:
- Cancelados
- Novo / Importado
- Renovação
- Total

O quadro tem **configuração própria**.

Futuramente sua fonte poderá ser:
- etapa do pipeline;
- status manual;
- status do robô;
- outro marco suportado.

A regra configurada deve registrar a ocorrência histórica do marco, não depender apenas do estado atual do pedido.

### 8.2 Contratos Assinados Semana / Data de Aceite

Mesma estrutura:
- Cancelados
- Novo / Importado
- Renovação
- Total

Também possui configuração independente.

### 8.3 Visual de desempenho

Quando os cálculos forem ativados:
- atingiu ou superou meta: destaque azul;
- abaixo da meta: destaque vermelho;
- total sempre visível.

Nesta primeira entrega, usar estado neutro até existir fonte de cálculo validada.

## 9. Acompanhamento semanal por consultor

Dois quadros separados:

### 9.1 Enviados / Data de Recebimento

Colunas:
- Consultor
- Meta Semana
- Semana 1
- Semana 2
- Semana 3
- Semana 4
- Semana 5 quando aplicável
- Resultado Ideal
- Resultado Atual
- Diferença
- Cancelados

### 9.2 Assinados / Data de Aceite

Mesmas colunas.

### 9.3 Fonte dos consultores

Buscar automaticamente usuários ativos que possuam papel de Consultor no sistema.

Nunca exigir cadastro manual de nome na página.

Consultor inativado deve continuar visível em histórico de períodos anteriores, mas não deve ser oferecido para novas metas.

### 9.4 Meta individual

A meta de cada consultor é definida manualmente pela gestão.

Não dividir a meta igualmente entre consultores.

A sugestão de meta da equipe pode existir, mas a distribuição individual é livre.

Resultado Ideal futuro:
`meta semanal do consultor × quantidade de semanas consideradas`.

Resultado Atual, Diferença e Cancelados permanecem sem cálculo real na primeira fase.

Cada quadro de consultor terá configuração própria de fonte/marco.

## 10. Quadros operacionais por status

Todos os quadros exibem:

| Operadora | Portabilidade | Novo/Fixa | Outros |
|---|---:|---:|---:|
| Vivo | — | — | — |
| Claro | — | — | — |
| Total | — | — | — |

Os valores permanecem vazios nesta fase.

### 10.1 Quadro — Aguardando Aceite

Pré-configuração inicial:
- Claro: Aguardando Aceite
- Vivo: Aguardando Aceite

### 10.2 Quadro — Troca de Carteira / Caso

Pré-configuração inicial:
- Claro:
  - Troca de Carteira
  - Abrir Troca de Carteira
- Vivo:
  - Aguardando Caso

### 10.3 Quadro — Confecção / Correções

Pré-configuração inicial Claro:
- Aguardando Correção Cadastral
- Aguardando de Acordo
- Confecção Aceite
- Confecção Andamento
- Devolvido Confecção
- Aguardando Envio GC

Pré-configuração inicial Vivo:
- Confecção Contrato

### 10.4 Quadro — Tratativas / Pendências

Pré-configuração inicial Claro:
- Tratativa Suporte
- Pendente MKT

Nenhum status Vivo será inventado nesta fase.

### 10.5 Configuração individual

Cada quadro terá botão próprio "Configurar".

O Gestor/Admin poderá:
- incluir/remover status manual;
- incluir/remover status de robô;
- incluir/remover etapa do pipeline, quando aplicável;
- definir regra separada por Claro/Vivo;
- visualizar a origem de cada regra.

## 11. Status manual + robô

### 11.1 Fontes atuais

O sistema já possui:
- `status_comercial_catalogo`;
- `status_comercial_operadoras`;
- `venda_status_comercial_historico`;
- `venda_robo_logs`;
- `pipeline_etapas`.

### 11.2 Descoberta de status do robô

Não existe catálogo manual completo dos status do robô.

A configuração deverá conseguir descobrir valores distintos já observados em `venda_robo_logs` para mudanças de status, sem obrigar o gestor a conhecer a origem técnica.

### 11.3 Normalização

Para detectar o mesmo nome em fontes diferentes, usar chave normalizada:
- trim;
- uppercase;
- remoção de acentos;
- colapso de espaços;
- remoção apenas de prefixos técnicos conhecidos, quando presentes, como `ROBÔ -`, `ROBO:`.

Não usar comparação fuzzy/semântica automática.

Exemplos que podem compartilhar chave:
- `Aguardando Aceite`
- `AGUARDANDO ACEITE`
- `ROBÔ - AGUARDANDO ACEITE`

Exemplos parecidos, mas não idênticos depois da normalização, continuam separados até configuração explícita.

## 12. Configurações por quadro

Cada quadro deverá ter sua própria definição persistida.

Campos conceituais:
- código do quadro;
- nome de exibição;
- ativo/inativo;
- ordem;
- tipo de fonte permitido;
- regras por operadora;
- status/etapas selecionados;
- usuário da última alteração;
- data da última alteração.

Alterar um quadro não replica configuração em outro.

## 13. Modelo de dados proposto

### 13.1 `acompanhamento_configuracoes`

Configurações gerais por chave/contexto.

Campos sugeridos:
- `id uuid`
- `chave text unique`
- `valor jsonb`
- `updated_by uuid`
- `created_at timestamptz`
- `updated_at timestamptz`

### 13.2 `acompanhamento_grupos`

Define os grupos configuráveis.

Campos:
- `id uuid`
- `contexto text`
- `codigo text`
- `nome text`
- `operadora text null`
- `ordem integer`
- `ativo boolean`

Unique recomendado: `(contexto, codigo, operadora)`.

### 13.3 `acompanhamento_tipo_vinculos`

Mapeia tipos do catálogo para grupos.

Campos:
- `id uuid`
- `tipo_pedido_id uuid references tipos_pedido_catalogo(id)`
- `grupo_id uuid references acompanhamento_grupos(id)`
- `classificado_por uuid`
- `created_at timestamptz`
- `updated_at timestamptz`

A ausência do vínculo representa "Não classificado".

### 13.4 `acompanhamento_metas_mensais`

Campos:
- `id uuid`
- `ano integer`
- `mes integer`
- `grupo text` (`np_fixa`, `outros`)
- `valor numeric`
- `updated_by uuid`
- timestamps

Unique: `(ano, mes, grupo)`.

### 13.5 `acompanhamento_metas_semanais`

Campos:
- `id uuid`
- `ano integer`
- `mes integer`
- `semana integer`
- `grupo text`
- `valor numeric`
- `origem text` (`automatico`, `manual`)
- `updated_by uuid`
- timestamps

### 13.6 `acompanhamento_metas_consultores`

Campos:
- `id uuid`
- `ano integer`
- `mes integer`
- `quadro text` (`enviados`, `assinados`)
- `consultor_id uuid`
- `meta_semanal numeric`
- `updated_by uuid`
- timestamps

Unique: `(ano, mes, quadro, consultor_id)`.

### 13.7 `acompanhamento_quadros`

Campos:
- `id uuid`
- `codigo text unique`
- `titulo text`
- `descricao text`
- `ordem integer`
- `ativo boolean`
- timestamps

### 13.8 `acompanhamento_quadro_regras`

Campos:
- `id uuid`
- `quadro_id uuid`
- `operadora text null`
- `fonte text` (`status_manual`, `status_robo`, `pipeline_etapa`)
- `referencia_id text null`
- `valor_original text`
- `valor_normalizado text`
- `ativo boolean`
- `updated_by uuid`
- timestamps

## 14. Segurança e RLS

Todas as novas tabelas em `public` terão RLS habilitado.

Leitura:
- Admin e Gestor.

Escrita:
- Admin e Gestor.

BKO:
- não acessa a página nem escreve suas configurações;
- sua criação de novo tipo de pedido apenas produz uma pendência natural, porque o tipo existe no catálogo sem vínculo.

Consultor/Closer:
- sem acesso às tabelas do acompanhamento.

As políticas devem validar papel via fonte autoritativa do sistema (`user_roles`), nunca via `user_metadata`.

## 15. Estado inicial da página

A página deve nascer sem números de vendas.

Estados:
- metas: vazias/zero até preenchimento;
- resultados: "Aguardando configuração";
- classificações: catálogo real de tipos pode ser exibido para configuração;
- consultores: lista real pode ser exibida para distribuição de metas;
- status manuais/robô/etapas: podem ser exibidos apenas como opções de configuração;
- nenhuma venda, receita, quantidade, cancelamento ou resultado semanal deve ser calculado nesta entrega.

## 16. Visual

Seguir identidade atual do OMNI Flow Lab:
- fundo escuro;
- amarelo OMNI como acento;
- Claro e Vivo com marcas/acentos próprios;
- cards compactos, mas com boa hierarquia;
- estados vazios elegantes;
- configurações em Sheet/Dialog, não espalhadas pela página;
- alertas de classificação pendente destacados;
- responsivo em desktop/tablet;
- tabelas de consultor com rolagem horizontal controlada em telas menores.

A página deve parecer um painel de gestão, não uma reprodução literal da planilha.

## 17. Fora de escopo desta primeira entrega

Não implementar ainda:
- cálculo real de vendas;
- leitura real de receita por classificação;
- contagem real de pedidos;
- cálculo de cancelados;
- cálculo de resultado atual;
- cálculo de diferença;
- histórico temporal de entrada em marco para resultados semanais;
- interpretação de "AG TEMPO INPUT";
- qualquer valor da planilha;
- qualquer classificação automática de tipos de pedido;
- qualquer inferência de status Vivo não informado pelo usuário.

## 18. Critérios de aceite da primeira entrega

1. A rota aparece somente para Admin/Gestor.
2. A página contém todos os blocos definidos neste documento.
3. Nenhum valor histórico da planilha é importado.
4. Nenhum resultado de venda real é calculado.
5. Meta mensal e semanal podem ser preparadas para persistência.
6. Consultores são carregados do cadastro do sistema para configuração de metas.
7. Tipos de pedido são carregados do catálogo para classificação.
8. Tipos sem vínculo aparecem como pendentes.
9. Cada quadro possui configuração independente.
10. Status manuais, status de robô descobertos e etapas podem ser selecionados como fontes de configuração.
11. As pré-configurações textuais dos quatro quadros operacionais são criadas sem inventar valores.
12. O item "AG TEMPO INPUT" permanece fora do cálculo até validação posterior.
13. Todas as novas tabelas têm RLS para Admin/Gestor.
14. Alterações de configuração registram usuário e timestamp.
15. A UI funciona sem depender de existirem vendas classificadas.

## 19. Próxima fase

Depois da reunião com a gestora:
1. validar nomenclaturas e grupos;
2. classificar os tipos de pedido;
3. validar fontes de cada quadro;
4. definir exatamente o marco de Recebimento e Aceite;
5. decidir regra de semana;
6. validar cancelamento;
7. conectar cálculos reais;
8. comparar os resultados do sistema com a planilha em um mês de teste antes de substituir o processo atual.
