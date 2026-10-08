# Regras operacionais por linha, operadora e perfil

Data: 17/09/2026

## Objetivo

Consolidar quatro regras operacionais que hoje estão parcialmente aplicadas entre interface e banco: um único doador por linha, biometria exclusiva da CLARO, isolamento real de Tipo de Produto por operadora e acesso do Consultor ao funil Assinatura sem ampliar indevidamente sua atuação no Processos BKO.

A implementação deve manter o comportamento já aprovado para bônus VIVO, Nota do Pedido e Histórico completo, sem reabrir esses fluxos.

## Princípios

1. Regras críticas existem em duas camadas: interface para orientar o usuário e Supabase para garantir integridade.
2. Alterações de catálogo preservam histórico de pedidos antigos quando o item é excluído.
3. Renomeações de Tipo de Produto propagam apenas dentro da mesma operadora.
4. Permissões de movimentação do Pipeline precisam ser idênticas no frontend e na função canônica `pipeline_move_venda`.
5. Nenhuma regra deve depender apenas de texto visual, DOM ou estado local.

---

## 1. Um único doador por linha

### Regra funcional

Cada registro de `venda_linhas` pode possuir zero ou um doador.

Não será mais permitido cadastrar múltiplos doadores para a mesma linha.

As regras atuais que determinam quais Tipos de Produto aceitam doador permanecem inalteradas; este pacote muda a cardinalidade de vários para no máximo um.

### Interface

O modal `Detalhes da linha` deixa de apresentar uma lista de vários doadores.

Estados possíveis:

- sem doador: exibir formulário `Adicionar doador`;
- com doador: exibir os dados do único doador, com ações `Editar` e `Remover` quando o usuário puder editar a linha.

Depois que um doador existir, o formulário de inclusão não oferece um segundo cadastro.

Na tabela de linhas, quando houver doador, será exibido um selo visual `Doador` na mesma área de indicadores do Tipo de Produto em que o bônus já aparece. O selo usa ícone de pessoa/usuário e deve permanecer visível sem abrir `Detalhes`. Quando também houver bônus, os dois indicadores coexistem lado a lado ou com quebra responsiva dentro da mesma célula.

### Banco

Adicionar restrição única em `venda_linha_doadores(linha_id)`.

Antes da criação da restrição, validar se existem duplicidades. Na inspeção realizada em 17/09/2026 não havia linhas com mais de um doador, portanto não é prevista consolidação destrutiva de dados.

A exclusão de `venda_linhas` continua removendo o doador por `ON DELETE CASCADE`.

### Critérios de aceite

- primeira inclusão de doador funciona;
- segunda inclusão para a mesma linha é impossível pela UI e rejeitada pelo banco;
- editar o doador atualiza o mesmo registro e não cria um segundo;
- remover o doador libera novamente a inclusão;
- selo `Doador` aparece imediatamente na linha quando o registro existe;
- bônus e doador podem aparecer simultaneamente na mesma linha.

---

## 2. Biometria exclusiva da CLARO

### Regra funcional

Pedidos VIVO não possuem biometria.

Biometria é um conceito exclusivo de pedidos CLARO.

### Interface

Para pedidos VIVO:

- não exibir o controle de biometria no cabeçalho;
- não exibir blocos, badges ou status relacionados à biometria;
- não permitir edição de `status_biometria`;
- Nota do Pedido e PDF não devem apresentar biometria para VIVO;
- qualquer indicação de biometria específica do pedido deve ficar ausente, e não aparecer como `Sem informação`.

Para pedidos CLARO, o comportamento atual permanece.

### Banco

Criar proteção para garantir que todo pedido VIVO tenha sempre:

- `tem_biometria = false`;
- `status_biometria = null`.

A migration deve neutralizar dados legados de biometria em pedidos VIVO existentes. A inspeção de 17/09/2026 encontrou pelo menos um pedido VIVO com `status_biometria` preenchido, portanto a limpeza é necessária.

A proteção deve atuar em INSERT e UPDATE de `vendas`. Se uma gravação tentar definir biometria em VIVO, o banco deve normalizar os campos para `false`/`null` antes de persistir. Se a operadora de um pedido for alterada para VIVO por algum fluxo permitido, a biometria também deve ser neutralizada na mesma gravação.

### Pipeline

A etapa específica de biometria atualmente identificada como `a-biometria` pertence ao funil Assinatura. Mesmo que ela esteja inativa hoje ou seja reativada futuramente, pedidos VIVO não podem ser movimentados para ela.

A função `pipeline_move_venda` deve rejeitar `a-biometria` para pedidos VIVO.

A interface deve filtrar o mesmo destino para evitar oferecer uma opção que o banco recusará.

### Critérios de aceite

- pedido VIVO não mostra biometria em nenhuma ficha operacional relevante;
- tentativa direta de salvar biometria em VIVO termina persistida como `tem_biometria=false` e `status_biometria=null`;
- pedido CLARO mantém biometria normalmente;
- pedido VIVO não pode ser movimentado para `a-biometria`;
- Nota/PDF VIVO não exibe campo de biometria.

---

## 3. Tipo de Produto isolado por operadora

### Contexto atual

O catálogo utilizado para `Tipo de Produto` é `tipos_pedido_catalogo`, apesar do nome legado da tabela. Cada item já possui a coluna `operadora`, e a leitura atual da interface já filtra por essa coluna.

O problema restante é o comportamento de edição e exclusão do catálogo em relação às linhas já existentes.

### Regra funcional

CLARO e VIVO possuem catálogos independentes de Tipo de Produto.

Um item pode ter o mesmo nome nas duas operadoras, mas continua sendo dois registros distintos.

#### Adição

Adicionar um Tipo de Produto em CLARO disponibiliza a opção apenas para novas linhas CLARO.

Adicionar em VIVO disponibiliza apenas para novas linhas VIVO.

Dentro da mesma operadora, não será permitido criar outro item ativo com o mesmo nome normalizado por `trim` e comparação sem diferença de maiúsculas/minúsculas.

#### Renomeação

Ao renomear um Tipo de Produto, o novo nome deve ser propagado para todas as `venda_linhas.tipo_produto` que:

1. usam exatamente o nome anterior armazenado no item de catálogo;
2. pertencem a uma venda da mesma operadora do item de catálogo alterado.

Exemplo:

- VIVO: `Portado` -> `Portado Vivo`;
- linhas VIVO que continham `Portado` passam para `Portado Vivo`;
- linhas CLARO que continham `Portado` permanecem `Portado`.

A atualização de catálogo e linhas deve ocorrer atomicamente no banco, para não deixar estado parcial.

A renomeação deve ser rejeitada quando o novo nome conflitar com outro item ativo da mesma operadora.

#### Exclusão

Ao excluir um Tipo de Produto:

- o item deixa de aparecer no catálogo daquela operadora;
- linhas antigas mantêm exatamente o texto que já possuíam;
- a outra operadora não sofre qualquer alteração;
- nenhum histórico de linha é reescrito.

Esta é a opção B aprovada pelo usuário.

### Banco

Criar uma função/RPC canônica para renomear item de Tipo de Produto com transação única.

A função recebe o ID do item e o novo nome, identifica sua operadora e atualiza apenas as linhas vinculadas a vendas daquela operadora.

A RPC deve autorizar somente os mesmos perfis que hoje podem gerenciar esse catálogo na interface: Admin e BKO. A autorização deve ser validada no banco, não apenas na UI.

A exclusão continua removendo ou inativando apenas o item de catálogo, conforme o mecanismo vigente; não deve executar UPDATE em `venda_linhas`.

Adicionar ou confirmar unicidade lógica de nome dentro da mesma operadora sem impedir que CLARO e VIVO tenham itens homônimos.

### Interface

O gerenciador de catálogo continua sendo aberto a partir da linha do pedido e usa a operadora do pedido como escopo obrigatório.

A ação `Editar` passa a chamar a função canônica de renomeação.

A mensagem de confirmação deve deixar claro que o novo nome será aplicado às linhas existentes daquela operadora.

A ação `Excluir` informa que pedidos antigos manterão o texto original.

### Critérios de aceite

- renomear em CLARO altera catálogo e linhas CLARO correspondentes, sem tocar VIVO;
- renomear em VIVO altera catálogo e linhas VIVO correspondentes, sem tocar CLARO;
- exclusão em uma operadora não muda linhas antigas;
- exclusão em uma operadora não remove o item homônimo da outra;
- novas linhas só listam itens ativos da operadora do pedido;
- usuário sem papel Admin/BKO não consegue renomear catálogo por chamada direta à RPC.

---

## 4. Consultor com acesso ao funil Assinatura

### Regra funcional

O Consultor continua limitado às três primeiras etapas permitidas no funil `Processos BKO`:

- `bko-pendente` — Pendente Consultor;
- `bko-apoio` — Apoio Gestão;
- `bko-troca` — Troca de Carteira | Abertura de Caso.

O Consultor não ganha acesso às etapas posteriores do Processos BKO.

Além disso, o Consultor passa a ter acesso operacional ao funil `Assinatura`.

### Entrada em Assinatura

Quando o pedido estiver em uma das três etapas permitidas do Processos BKO, o Consultor poderá mover o pedido para a primeira etapa ativa do funil Assinatura.

`Primeira etapa ativa` significa a etapa ativa de menor `ordem` pertencente ao funil `assinatura`, desde que o funil esteja ativo e participe do fluxo comercial.

Não será oferecida entrada direta em uma etapa arbitrária do funil Assinatura a partir do BKO. A entrada ocorre pela primeira etapa ativa, preservando o fluxo.

### Dentro de Assinatura

Depois que o pedido estiver em Assinatura, o Consultor poderá movimentá-lo entre todas as etapas ativas do próprio funil Assinatura, respeitando restrições específicas por operadora, como a proibição de `a-biometria` para VIVO.

Esta mudança não concede ao Consultor permissão para concluir definitivamente o pedido. A regra atual de conclusão permanece inalterada.

Também não será criado, neste pacote, um novo caminho de retorno de Assinatura para Processos BKO. O objetivo aprovado é permitir entrada e movimentação dentro de Assinatura, não redesenhar reversões de fluxo.

### Frontend

Atualizar `availableCommercialDestinations` e os diálogos/cartões que consomem essa função para:

- manter apenas as três etapas permitidas quando a origem e o destino permanecerem em Processos BKO;
- oferecer somente a primeira etapa ativa de Assinatura como saída permitida do BKO;
- quando o pedido já estiver em Assinatura, listar somente as outras etapas ativas da própria Assinatura compatíveis com a operadora;
- não oferecer etapas posteriores do BKO ao Consultor;
- não oferecer `a-biometria` para VIVO.

### Banco

Atualizar `pipeline_move_venda` com a mesma matriz de permissões.

Para Consultor sem papel amplo:

- só pode movimentar pedidos dos quais é consultor responsável;
- em Processos BKO, origem precisa estar nas três etapas permitidas;
- dentro do BKO, destino também precisa estar nessas três etapas;
- do BKO para Assinatura, destino precisa ser exatamente a primeira etapa ativa de Assinatura pela `ordem` configurada;
- dentro de Assinatura, destino deve ser uma etapa ativa do próprio funil Assinatura e válida para a operadora;
- de Assinatura não será permitido criar um novo retorno para Processos BKO neste pacote;
- nenhuma dessas regras altera permissões de admin, gestor ou BKO.

### Critérios de aceite

- Consultor continua circulando entre as três etapas permitidas do BKO;
- Consultor não vê nem acessa etapas posteriores do BKO;
- Consultor consegue enviar o pedido do BKO para a primeira etapa ativa de Assinatura;
- Consultor consegue movimentar entre etapas ativas da Assinatura;
- VIVO não recebe destino de biometria;
- Consultor continua sem concluir pedido quando a regra de conclusão não o autoriza;
- banco e frontend rejeitam ou ocultam os mesmos destinos.

---

## Arquivos e áreas previstas

Frontend, conforme inspeção atual:

- `src/components/linha-operational-extras.tsx`
- `src/components/pedido-header-meta.tsx`
- `src/components/catalogo-linha-select.tsx`
- `src/lib/catalogos.ts`
- `src/lib/pipeline-movement.ts`
- `src/components/move-venda-dialog.tsx`
- página/componente que renderiza os cards do Pipeline comercial
- `src/routes/_shell.vendas.$id.tsx`
- `src/lib/pedido-nota-live.ts`
- `src/lib/pdf-nota-live.ts`

Banco:

- nova migration para unicidade de doador por linha;
- nova migration para regra de biometria por operadora;
- nova função/RPC para renomear Tipo de Produto por operadora;
- atualização versionada de `pipeline_move_venda`.

Testes:

- testes unitários da matriz de movimentação do Consultor;
- testes unitários da elegibilidade de biometria por operadora;
- teste/contrato do indicador de doador único;
- teste de integração SQL para renomeação por operadora e preservação da outra operadora;
- validação SQL da restrição única de doador;
- teste de autorização da RPC de catálogo;
- build do projeto.

---

## Não objetivos deste pacote

- alterar regras de bônus VIVO já aprovadas;
- alterar o Histórico unificado;
- alterar a Nota do Pedido fora da remoção de biometria para VIVO;
- mudar permissões de conclusão de pedido;
- criar retorno novo de Assinatura para Processos BKO;
- alterar catálogos de Produto ou Plano, salvo se algum ajuste técnico compartilhado for indispensável para não quebrar o componente genérico.

## Estratégia de entrega

A implementação será feita na branch isolada `feat/regras-operacionais-operadora-2026-09-17`, baseada na `main` atual no início deste trabalho. Banco e código serão alterados de forma coordenada. Cada regra terá teste antes da implementação correspondente, seguindo TDD. Ao final, serão executados testes, build e verificações de integridade no Supabase. A `main` só será atualizada depois de validação e aprovação explícita para integração.