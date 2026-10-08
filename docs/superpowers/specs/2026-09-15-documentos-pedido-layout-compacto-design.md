# Design — Documentos do Pedido + layout compacto da ficha

Data: 15/09/2026

## Objetivo

Adicionar um módulo de documentos vinculado ao pedido e reorganizar a ficha do pedido para reduzir altura, manter informações operacionais importantes e dar mais destaque visual à operadora e à biometria.

## Escopo funcional

### 1. Documentos do Pedido

Criar uma seção **Documentos do Pedido** imediatamente abaixo de **Observações do Pedido**.

A seção deve permitir a qualquer usuário que já tenha acesso ao pedido:

- enviar documento;
- visualizar/abrir documento;
- baixar documento;
- excluir documento.

O formulário de upload terá:

- **Título** obrigatório, texto livre;
- **Arquivo** obrigatório;
- tamanho máximo de **100 MB por arquivo**.

Tipos aceitos:

- imagens comuns;
- PDF;
- Word `.doc` e `.docx`.

A listagem exibirá:

- título;
- nome original do arquivo;
- tipo/extensão;
- tamanho;
- enviado por;
- data/hora de envio;
- ações de visualizar/abrir, baixar e excluir.

A exclusão sempre pede confirmação.

### 2. Exclusão e auditoria

A exclusão será lógica no domínio do sistema:

- o registro do documento permanece no banco;
- recebe `deleted_at` e `deleted_by`;
- deixa de aparecer na lista normal;
- deixa de gerar URL de leitura;
- fica registrado no histórico do pedido quem excluiu, quando, título e nome original do arquivo.

O binário poderá ser removido fisicamente do Storage após a marcação lógica. Se a remoção física falhar, o documento continuará invisível e sem acesso pelo aplicativo; uma limpeza posterior poderá remover o objeto órfão.

Upload e exclusão também serão registrados em `venda_historico` para auditoria.

## Arquitetura de armazenamento

### Bucket

Criar bucket privado do Supabase Storage, sugerido: `pedido-documentos`.

Configuração:

- privado;
- limite de 100 MB;
- MIME types limitados a PDF, Word e imagens suportadas;
- sem URL pública permanente.

Arquivos serão gravados com caminho estável baseado no pedido e em UUID, por exemplo:

`<venda_id>/<documento_id>/<nome-sanitizado>`

### Metadados

Criar tabela `venda_documentos` com, no mínimo:

- `id uuid primary key`;
- `venda_id uuid`;
- `titulo text not null`;
- `arquivo_nome_original text not null`;
- `storage_path text not null unique`;
- `mime_type text not null`;
- `tamanho_bytes bigint not null`;
- `created_by uuid not null`;
- `created_by_nome text not null`;
- `created_at timestamptz not null default now()`;
- `deleted_at timestamptz null`;
- `deleted_by uuid null`;
- `deleted_by_nome text null`.

A consulta padrão do frontend usa apenas documentos com `deleted_at is null`.

## Permissões

A regra de acesso dos documentos deve seguir a mesma visibilidade já aplicada ao pedido em `vendas`.

Em outras palavras: se o usuário pode ler aquele pedido, pode listar, enviar, abrir/baixar e excluir documentos daquele pedido.

Não será criada uma matriz paralela por perfil para documentos.

O banco deve validar o acesso, não apenas a interface.

Para Storage:

- INSERT valida acesso ao pedido pelo `venda_id` presente no caminho;
- SELECT/assinatura de URL exige documento ativo e acesso ao pedido;
- DELETE físico exige acesso ao pedido e serve para limpeza do binário após exclusão lógica ou rollback de upload incompleto.

## Fluxo de upload

1. Usuário abre **Adicionar documento**.
2. Informa título e escolhe arquivo.
3. Frontend valida título, tipo e tamanho antes do envio.
4. Gera `documento_id` e `storage_path` únicos.
5. Faz upload no bucket privado.
6. Insere metadados em `venda_documentos`.
7. Registra evento no histórico do pedido.
8. Atualiza a lista.

Se a gravação de metadados falhar depois do upload, o frontend tenta remover o objeto enviado para evitar órfão.

## Visualização e download

O frontend nunca usará URL pública fixa.

Ao visualizar ou baixar, solicita URL assinada temporária.

- imagens e PDF podem abrir em nova aba quando o navegador suportar;
- Word pode abrir conforme suporte do navegador/sistema ou cair naturalmente para download.

## Layout da ficha do pedido

### Cabeçalho

Manter o número do pedido e as ações principais atuais.

A operadora passa a ter um badge mais forte visualmente:

- apenas o texto `CLARO` ou `VIVO`;
- sem ícone;
- ligeiramente maior que o badge atual;
- brilho mais evidente e acabamento premium;
- vermelho para Claro e roxo para Vivo;
- sem ocupar espaço exagerado.

### Biometria compacta

Mover a biometria para o cabeçalho, ao lado da operadora.

Mostrar:

- ícone de biometria;
- legenda textual do estado atual;
- cor equivalente ao comportamento atual:
  - `Pendente` amarelo;
  - `Cancelada` vermelho;
  - `Concluída` verde;
  - sem informação em tom neutro.

A permissão de edição da biometria permanece a mesma já existente no sistema.

O bloco grande de Biometria do corpo da página deixa de existir.

### KPIs compactos

Remover do topo:

- `Dias na etapa`;
- `Próx. ação`.

Manter somente:

- `Linhas`;
- `Valor da venda`;
- `Consultor`.

Esses três itens virão em uma faixa horizontal mais baixa e compacta, preservando os mesmos valores atuais.

A remoção é apenas visual nessa ficha; nenhum campo de banco será apagado.

### Status do Pedido

Manter as quatro opções existentes, porém em card menor e horizontal:

- Ativado 100%;
- Cancelado;
- Reprovado;
- PRD/Suporte.

As regras e permissões de edição permanecem iguais às atuais.

### Datas do Sistema

**As datas permanecem no sistema.**

O card de datas não será removido nem terá campos descartados.

Ele continua exibindo os dados operacionais já existentes, incluindo recebimento, preenchimento, aceite, input, ativação e demais datas presentes na ficha.

Na nova composição, a área principal do Resumo terá:

- Status Comercial;
- Status do Pedido compacto;
- Datas do Sistema preservadas.

### Observações e documentos

Observações do Pedido continuam com o comportamento atual.

Logo abaixo entra Documentos do Pedido, com visual alinhado ao mockup aprovado e responsividade para desktop/tablet/mobile.

## Componentização

Para evitar aumentar ainda mais a rota de detalhes, a implementação deverá extrair responsabilidades em componentes próprios:

- `DocumentosPedido` — lista, upload, visualização, download e exclusão;
- `PedidoHeaderMeta` ou equivalente — operadora + biometria compacta;
- reutilizar os componentes atuais de Status do Pedido/Datas sempre que possível, alterando apenas apresentação.

A rota `_shell.vendas.$id.tsx` continua responsável por composição e dados principais, não por toda a lógica de documentos.

## Responsividade

Desktop:

- operadora e biometria no cabeçalho;
- três KPIs compactos em linha;
- Status Comercial + Status do Pedido + Datas distribuídos de forma equilibrada.

Tablet/mobile:

- blocos quebram em linhas sem esconder informações;
- tabela de documentos pode usar rolagem horizontal ou cards compactos;
- ações de documento permanecem acessíveis.

## Erros e estados

Upload deve tratar explicitamente:

- arquivo acima de 100 MB;
- tipo não suportado;
- título vazio;
- falha de upload;
- falha ao gravar metadados;
- falha ao gerar URL assinada;
- falha ao excluir.

Não inserir documento na lista como ativo enquanto o fluxo não concluir com sucesso.

## Testes e contratos

Criar cobertura para:

- limite de 100 MB;
- tipos permitidos/rejeitados;
- usuário sem acesso ao pedido não acessa documentos;
- usuário com acesso pode inserir, ler e excluir;
- exclusão deixa documento fora da listagem ativa;
- exclusão registra ator/data no histórico;
- URLs são privadas/assinadas;
- layout não contém os cards `Dias na etapa` e `Próx. ação` no topo;
- `Linhas`, `Valor da venda` e `Consultor` permanecem;
- Datas do Sistema permanecem;
- operadora aparece sem ícone e com destaque maior;
- biometria compacta aparece ao lado da operadora com a legenda/cor correta.

## Fora de escopo

Nesta entrega não haverá:

- categorias fixas de documento;
- versionamento de arquivos;
- restauração de documento excluído pela interface;
- OCR;
- assinatura eletrônica;
- edição online de Word/PDF;
- compartilhamento público externo.
