# OMNI Command Center

Crie um webapp completo chamado OMNI Flow Lab, com o subtítulo:

O laboratório inteligente do pipeline comercial OMNI.

O sistema será um CRM interno de vendas, pipeline, assinatura e suporte da OMNI Assessoria. Ele deve substituir e evoluir o controle atual feito nas planilhas Claro 2026.xlsx e Vivo 2026.xlsx, principalmente usando como referência a aba GERAL ATUAL de cada planilha.

O sistema precisa transmitir tecnologia, inovação, velocidade e controle operacional. Quero um visual premium, chamativo, moderno, animado e interativo, com identidade OMNI: amarelo e preto como cores principais, usando branco, cinza, verde, vermelho, azul e roxo apenas como cores de apoio para status, alertas, operadoras, urgência e indicadores.

A sensação visual deve ser de um centro de comando comercial, como se fosse um dashboard high-tech para controlar vendas, funis, assinatura, suporte, colaboradores, clientes e resultados mensais.

1. Objetivo principal do sistema

Criar um webapp para controlar todo o fluxo comercial da OMNI, desde a prospecção até o suporte final, com pipeline em Kanban, dashboards mensais, ambientes separados por operadora e importação/migração dos dados existentes nas planilhas Vivo 2026 e Claro 2026.

O sistema deve permitir que o vendedor crie uma venda, selecione ou cadastre o cliente, escolha a operadora, escolha o mês de referência, preencha os dados do pedido e mova o card pelas etapas do funil.

A lógica principal deve ser:

Cliente criado ou selecionado → Venda criada → Prospecção → Follow Up → Assinatura → Suporte → Concluído

2. Nome, branding e experiência visual

Nome do sistema:

OMNI Flow Lab

Subtítulo:

O laboratório inteligente do pipeline comercial OMNI.

Direção visual:

Visual tecnológico, premium, moderno e interativo.

Fundo principal em preto, grafite ou cinza muito claro, dependendo do modo claro/escuro.

Amarelo OMNI como cor de destaque principal.

Cards com bordas luminosas, sombras suaves e microanimações.

Gráficos com aparência futurista.

Kanban com movimentação fluida.

Efeitos sutis de brilho, glassmorphism, linhas de conexão, status pulsando e badges animados.

Interface com aparência de software profissional de operação comercial e telecom.

Nada genérico, nada com aparência simples de planilha.

Deve parecer um produto interno premium da OMNI.

Criar também um modo claro e modo escuro:

No modo claro:

Fundo branco/cinza claro.

Texto preto/grafite.

Cards brancos.

Amarelo e preto como destaque.

No modo escuro:

Fundo preto/grafite.

Cards em cinza escuro.

Texto branco.

Amarelo OMNI como destaque luminoso.

3. Ambientes separados por operadora

O sistema deve ter ambientes diferentes para cada operadora:

Ambiente Claro

Ambiente Vivo

Visão Geral OMNI

Na parte superior do sistema deve existir um seletor visual:

Geral OMNI | Claro | Vivo

Quando o usuário entrar em Claro, deve visualizar apenas clientes, pedidos, status, produtos, SLAs e vendas da Claro.

Quando entrar em Vivo, deve visualizar apenas clientes, pedidos, status, produtos, SLAs e vendas da Vivo.

Quando entrar em Geral OMNI, deve visualizar dados consolidados das duas operadoras.

Mesmo com ambientes separados, a identidade visual principal continua sendo OMNI: amarelo e preto. As operadoras podem ter apenas pequenos detalhes visuais:

Claro: badge vermelho discreto.

Vivo: badge roxo discreto.

Geral OMNI: badge amarelo/preto.

4. Implementação por mês

O sistema precisa ser implementado por mês, igual à lógica atual das planilhas.

Hoje existem abas como:

GERAL ATUAL

GERAL ANTERIOR

JANEIRO

FEVEREIRO

MARÇO

ABRIL

MAIO

JUNHO

DEZEMBRO 2025

No webapp, não quero depender de várias abas como planilha. Quero transformar isso em um controle inteligente por mês de referência.

Criar uma entidade chamada Competência Mensal.

Cada venda precisa ter obrigatoriamente:

Mês de referência.

Ano de referência.

Operadora.

Funil atual.

Etapa atual.

Status atual.

Responsável.

Data de criação.

Data de última alteração.

Na tela principal, criar um seletor de mês:

Janeiro | Fevereiro | Março | Abril | Maio | Junho | Julho | Agosto | Setembro | Outubro | Novembro | Dezembro

E também filtro por ano:

2025 | 2026 | 2027...

Ao criar uma venda, o usuário deve escolher o mês de referência. Por padrão, o sistema deve sugerir o mês atual.

O Dashboard, o Pipeline e os relatórios devem sempre respeitar o mês selecionado.

Exemplo:

Se o usuário selecionar Junho/2026, deve ver somente os cards, vendas, receitas, status e indicadores daquele mês.

Criar também botão:

Fechar mês

Ao fechar um mês, o sistema deve congelar os indicadores daquele mês como histórico, mas permitir edição apenas para administradores.

5. Importação das planilhas existentes

O sistema deve ter um módulo de importação para carregar as planilhas:

Claro 2026.xlsx

Vivo 2026.xlsx

Na importação, usar principalmente a aba:

GERAL ATUAL

Também permitir importar dados das abas mensais antigas, como Janeiro, Fevereiro, Março, Abril, Maio, Junho, Geral Anterior e Atual.

O sistema deve identificar automaticamente:

Operadora.

Mês da aba.

Dados dos clientes.

Dados dos colaboradores.

Status.

Produtos.

Tipos de pedido.

SLAs.

Histórico de pedidos.

Receita.

Quantidade de linhas.

Datas principais.

Criar uma tela de pré-visualização antes de importar.

A tela de importação deve mostrar:

Nome da planilha.

Aba detectada.

Quantidade de registros encontrados.

Quantidade de clientes detectados.

Quantidade de colaboradores detectados.

Quantidade de pedidos detectados.

Possíveis duplicidades.

Erros de leitura.

Campos não reconhecidos.

Depois da pré-visualização, permitir confirmar a importação.

6. Base de clientes existente

O sistema deve usar os clientes existentes nas planilhas Claro e Vivo.

Ao importar a aba GERAL ATUAL, o sistema deve criar uma base de clientes usando os campos:

CNPJ/CPF.

Razão Social.

UF.

DDD.

Operadora.

Produtos.

Histórico de pedidos.

Quantidade de linhas.

Receita.

Status.

Observações.

Última alteração.

Data de ativação.

Dados de portabilidade, quando houver.

Dados de entrega/instalação, quando houver.

Chips, eSIM, aparelhos, modelos e quantidades, quando houver.

Regra de duplicidade:

O cliente deve ser identificado preferencialmente por CNPJ/CPF.

Se o mesmo cliente aparecer na Claro e na Vivo, ele deve existir uma única vez na base geral, mas com relacionamento em duas operadoras.

Exemplo:

Cliente X:

Possui pedidos Claro.

Possui pedidos Vivo.

Histórico separado por operadora.

Visão consolidada na ficha do cliente.

Na hora de criar uma nova venda, o vendedor deve conseguir pesquisar cliente por:

Razão social.

CNPJ/CPF.

Operadora.

Telefone.

E-mail.

Número da linha.

Produto.

Nome do responsável.

Ao selecionar um cliente existente, o sistema deve preencher automaticamente os dados já conhecidos.

7. Base de colaboradores existente

O sistema deve usar os colaboradores existentes nas planilhas Vivo e Claro.

Nas planilhas existem áreas de configuração com nomes de colaboradores, supervisão, vendas e renovação.

Criar uma base de colaboradores com:

Nome do colaborador.

Tipo: vendas, renovação, supervisão, BKO, suporte ou gestão.

Operadora vinculada, se houver.

Status ativo/inativo.

Permissões.

Vendas relacionadas.

Pedidos relacionados.

Na criação da venda, o usuário deve conseguir escolher:

Consultor responsável.

BKO responsável.

Suporte responsável.

Gestor responsável, se necessário.

8. Campos principais da venda

A venda deve ter campos fixos, baseados na aba GERAL ATUAL.

Campos obrigatórios:

Operadora.

Mês de referência.

Ano de referência.

Data de recebimento.

Quantidade de linhas.

Receita.

Status.

Data de aceite.

Data de ativação.

Tipo de pedido.

SLA.

Consultor.

BKO.

Data de preenchimento.

Data de envio.

Data de input.

CNPJ/CPF.

Razão Social.

UF.

DDD.

Produtos.

Observação.

Última alteração.

Cotação / número do pedido / número da ordem.

Data de portabilidade.

Status de portabilidade.

Data de entrega / instalação.

Chip, eSIM e/ou aparelhos.

Nota fiscal / código de rastreio, quando for Vivo.

Série, quando for Vivo.

Biometria, quando for Claro.

Erros.

Número do pedido, quando houver.

Viabilidade fixa, quando houver.

Recebido x preenchimento.

Aceite x ativação.

Esses campos devem aparecer organizados por blocos, não em uma tela bagunçada.

Blocos sugeridos:

Resumo da Venda

Dados do Cliente

Dados Comerciais

Dados Operacionais

Portabilidade

Logística e Entrega

Assinatura e Biometria

Erros e Pendências

Histórico e Observações

9. Criação da venda

Criar botão principal:

+ Nova Venda

Ao clicar, abrir um fluxo moderno em etapas, estilo wizard:

Etapa 1 — Operadora e mês

Campos:

Operadora: Claro ou Vivo.

Mês de referência.

Ano.

Tipo de pedido.

Produto.

Origem da venda.

Etapa 2 — Cliente

Opções:

Buscar cliente existente.

Criar novo cliente.

Busca inteligente por:

Razão social.

CNPJ/CPF.

DDD.

Número da linha.

Operadora.

E-mail.

Telefone.

Se selecionar cliente existente, preencher os dados automaticamente.

Etapa 3 — Dados comerciais

Campos:

Quantidade de linhas.

Receita atual.

Receita proposta.

Valor total.

Consultor.

BKO.

Observações comerciais.

Prioridade.

Etapa 4 — Linhas e produtos

Criar tabela editável para linhas do pedido.

Campos da tabela:

Número da linha.

DDD.

Produto.

Plano atual.

Plano novo.

Franquia atual.

Franquia nova.

Valor atual.

Valor novo.

Ação: novo, renovação, portado, cancelamento, migração, transferência de titularidade, SVA, suporte.

Status da linha.

Observação.

Etapa 5 — Pipeline

Escolher:

Funil inicial.

Etapa inicial.

Próxima ação.

Data da próxima ação.

Ao salvar, criar o card automaticamente no Kanban.

10. Pipeline em Kanban

Criar uma tela chamada Pipeline.

A tela deve ter abas de funil:

Prospecção

Follow Up

Assinatura

Suporte

Também deve ter filtros superiores:

Operadora.

Mês.

Ano.

Consultor.

Status.

Tipo de pedido.

Produto.

Prioridade.

SLA.

Atrasados.

Urgentes.

Cada funil deve funcionar em Kanban, com colunas representando as etapas.

O card da venda deve mostrar:

Razão social.

Operadora.

Tipo de pedido.

Produto.

Quantidade de linhas.

Receita.

Status.

Consultor.

Mês de referência.

SLA.

Tempo parado na etapa.

Próxima ação.

Badge de prioridade.

Badge de atraso.

Ícone de observação, se houver.

Ícone de erro, se houver.

Ícone de assinatura/biometria, se houver.

O card deve ter design premium:

Borda lateral colorida conforme status.

Sombra suave.

Microanimação ao passar o mouse.

Badge da operadora.

Indicador de SLA em formato de barra ou círculo.

Ícone de alerta pulsando quando estiver atrasado.

Ao arrastar o card para outra etapa, abrir modal perguntando:

Registrar observação?

Alterar status?

Alterar próxima ação?

Alterar responsável?

Atualizar SLA?

Enviar para outro funil?

Registrar tudo no histórico.

11. Funis e etapas padrão

Criar inicialmente 4 funis padrão, mas tudo deve ser editável pelo administrador.

Funil 1 — Prospecção

Etapas:

Aguardando Início

Dia 1 - Ligação

Dia 2 - Ligação

Dia 2 - WhatsApp

Dia 3 - Ligação

Dia 4 - Ligação

Dia 4 - WhatsApp

Dia 5 - Ligação

Dia 5 - Declínio WhatsApp

Montar Proposta

Funil 2 — Follow Up

Etapas:

Montar Proposta

Troca de Carteira

Dia 1 - Follow Up

Dia 2 - Follow Up

Dia 3 - Follow Up

Dia 4 - Apoio Gestão

Dia 5 - Follow Up

Dia 6 - Follow Up

Dia 7 - Declínio WhatsApp

Preenchimento de Contrato

Funil 3 — Assinatura

Etapas:

Aguardando Assinatura

Aguardando Reenvio

Correção Cadastral

Dia 1 - Assinatura

Dia 2 - Assinatura

Dia 3 - Assinatura

Dia 4 - Assinatura

AG Confirmar Assinatura

Aguardando Biometria

Aguardando Concluir TT

Apoio Gestão

Contrato Assinado - Claro

Contrato Assinado - Vivo

Funil 4 — Suporte

Etapas:

Suportes em Espera

Urgente

Pré Vendas

Devolutiva do Consultor

A Tratar

Aguardando Retorno Cliente

Conferência Agendada

Aguardando Retorno OMNI/DATAVOXX

Aguardando Retorno Interno

Aguardando Prazo Anatel/Operadora

Pendência Comercial

Concluído

Cores sugeridas:

Urgente: vermelho.

Pré Vendas: azul.

Pendência Comercial: laranja.

Concluído: verde.

Assinatura: amarelo/dourado.

Suporte: roxo/azul.

Prospecção: rosa/magenta.

Follow Up: verde/azul.

12. Status por operadora

O sistema deve permitir que Claro e Vivo tenham status próprios.

Na importação, buscar os status das abas SELECT e STATUS PEDIDOS.

Exemplo de status Claro:

Auditoria

Aguardando Aceite

Aguardando Envio GC

Aguardando Concluir TT

Aguardando Nota Fiscal

Aguardando Entrega

Aguardando GAR ou Biometria

Pendente Instalação

Aguardando Portabilidade

Análise de Crédito

Cancelado

Concluído

Reprovado Crédito

Fila Input

Conectado

Pendência Comercial

Tratativa Suporte

Troca de Carteira em Análise

Troca Negada

Validação Pendente

Verificando Viabilidade

Portabilidade Negada

Conflitos Portabilidade

Exemplo de status Vivo:

Aguardando Caso

Confecção de Contrato

Aguardando Aceite

Auditoria

Fila de Inserção

Criar Gestor

Pendência BKO Inserção

Aguardando Status

Smart em Andamento

Sem Estoque

Mesa de Fraude

Análise de Crédito

Crédito Aprovado

Crédito Reprovado

Análise BKO

BKO Aprovado

BKO Reprovado

Aguardando Coleta

Aguardando Entrega

Aguardando Retirada Correios

Ocorrência na Entrega

Aguardando Data Portin

Ocorrência Portin

Ausência de Resposta SMS

Aguardando Conclusão Portin

Tratativa Suporte

Logística Concluída

Pendência Comercial

Cancelado

Tramitação Vivo

Pendência Sistêmica

Aguardando Instalação

Instalado

Cada status deve ter:

Nome.

Descrição.

SLA em horas.

SLA em dias.

Produto relacionado.

Operadora.

Cor.

Tipo: normal, alerta, conclusão, cancelamento, pendência ou suporte.

13. Produtos por operadora

Importar produtos existentes nas planilhas.

Produtos que podem existir:

Móvel.

Fixa.

Banda larga.

TV.

GOTO.

Passaporte.

Chip dados.

Pacote adicional.

PABX.

Link dedicado.

M2M.

Onvox.

Claro Monitor.

Vivo Travel Américas.

Vivo Travel Europa.

Vivo Travel Mundo.

VVN.

IP Fixo.

SIP.

Aluguel de equipamentos.

Siga-me.

Microsoft 365.

Aparelho.

O sistema deve permitir que o administrador cadastre novos produtos.

14. Tela de detalhe da venda

Ao clicar em um card, abrir uma tela completa da venda com layout premium.

Abas internas:

Resumo

Cliente

Linhas

Nota do Pedido

Pipeline

Assinatura

Suporte

Histórico

Arquivos

Aba Resumo

Mostrar:

Status atual.

Funil atual.

Etapa atual.

Operadora.

Mês.

Consultor.

BKO.

Quantidade de linhas.

Receita.

SLA.

Tempo na etapa.

Próxima ação.

Alertas.

Aba Cliente

Mostrar:

Razão social.

CNPJ/CPF com máscara.

UF.

DDD.

Contatos.

Histórico por operadora.

Pedidos anteriores.

Aba Linhas

Tabela editável com todas as linhas do pedido.

Aba Nota do Pedido

Gerar nota automática, em layout limpo, com botão para copiar.

A nota deve montar automaticamente:

Tipo de pedido.

Operadora.

Dados do cliente.

Dados comerciais.

Quantidade de linhas.

Receita.

Linhas envolvidas.

Dados de cancelamento, renovação, portabilidade ou migração.

Dados para conferência.

Observações internas.

Botões:

Copiar nota.

Imprimir.

Exportar PDF.

Enviar para assinatura.

Enviar para suporte.

Aba Histórico

Mostrar linha do tempo visual com:

Criação da venda.

Alterações de campo.

Mudanças de etapa.

Mudanças de funil.

Responsável que fez a alteração.

Data e hora.

Observação registrada.

15. Dashboard mensal

Criar uma tela chamada Dashboard com visual altamente tecnológico.

Filtros:

Operadora.

Mês.

Ano.

Consultor.

Produto.

Tipo de pedido.

Indicadores principais:

Total de vendas no mês.

Total de vendas Claro.

Total de vendas Vivo.

Receita total.

Quantidade total de linhas.

Vendas em prospecção.

Vendas em follow up.

Vendas em assinatura.

Vendas em suporte.

Vendas concluídas.

Vendas canceladas.

Vendas atrasadas.

Vendas urgentes.

Tempo médio de fechamento.

Tempo médio por etapa.

Conversão entre funis.

Receita por consultor.

Receita por operadora.

Receita por produto.

Gargalos do mês.

Criar gráficos:

Funil de conversão.

Receita por mês.

Receita por consultor.

Quantidade de linhas por operadora.

Status por operadora.

Cards atrasados por etapa.

Evolução diária do mês.

Comparativo Claro x Vivo.

Ranking de consultores.

Mapa de gargalos.

Visual dos gráficos:

Cards futuristas.

Números grandes.

Indicadores com brilho.

Barras animadas.

Gráficos suaves.

Badges coloridos.

Modo dark premium.

16. Automações e alertas

Criar automações internas:

Quando o card ultrapassar o SLA da etapa, marcar como atrasado.

Quando estiver próximo do vencimento, marcar como atenção.

Quando for urgente, destacar em vermelho.

Quando estiver parado há muitos dias, criar alerta de inatividade.

Quando chegar em etapa final de um funil, sugerir próximo funil.

Quando contrato for assinado, sugerir envio para suporte.

Quando suporte for concluído, marcar como concluído.

Quando houver pendência comercial, notificar o consultor.

Quando houver erro, exibir alerta no card.

Quando houver biometria pendente, destacar na venda.

Usar régua visual:

Verde: dentro do prazo.

Amarelo: atenção.

Laranja: próximo do vencimento.

Vermelho: atrasado.

Roxo: suporte ou tratativa especial.

Cinza: aguardando retorno.

17. Segurança e LGPD

As planilhas possuem dados sensíveis, então o sistema precisa proteger informações pessoais.

Aplicar máscara nos seguintes campos em listagens e cards:

CNPJ/CPF.

RG.

Telefone.

WhatsApp.

E-mail.

Somente usuários autorizados podem visualizar dados completos.

Criar perfis:

Administrador

Pode ver, criar, editar, excluir, importar, exportar e configurar tudo.

Gestor

Pode ver todos os dados operacionais, dashboards, funis, vendedores e relatórios.

Consultor / Vendedor

Pode criar vendas, movimentar seus próprios cards e visualizar apenas suas vendas, salvo permissão extra.

BKO

Pode visualizar e editar campos operacionais, status, pedidos, assinatura, input e suporte.

Suporte

Pode visualizar e editar cards do funil suporte.

Registrar log de tudo:

Quem acessou.

Quem editou.

O que foi alterado.

Data e hora.

Valor anterior.

Novo valor.

18. Estrutura de banco de dados sugerida

Criar as seguintes tabelas:

users

roles

permissions

operators

monthly_competencies

customers

collaborators

deals

deal_lines

deal_statuses

deal_products

funnels

funnel_stages

deal_history

deal_notes

deal_files

activities

sla_rules

import_batches

import_errors

support_tickets

signatures

notifications

Relacionamentos principais:

Um cliente pode ter várias vendas.

Uma venda pertence a uma operadora.

Uma venda pertence a um mês de referência.

Uma venda pertence a um funil e uma etapa.

Uma venda pode ter várias linhas.

Uma venda pode ter várias notas.

Uma venda pode ter vários históricos.

Uma venda pode ter arquivos.

Um colaborador pode ser consultor, BKO, suporte ou gestor.

Cada operadora tem seus próprios status, produtos e SLAs.

19. Configurações administrativas

Criar uma área chamada Configurações.

O administrador deve conseguir configurar:

Operadoras.

Meses.

Funis.

Etapas.

Cores das etapas.

Status por operadora.

Produtos por operadora.

SLAs.

Colaboradores.

Permissões.

Campos personalizados.

Mensagens padrão.

Modelos de nota.

Regras de automação.

Cada etapa deve ter:

Nome.

Descrição.

Cor.

Ordem.

Funil.

Operadora, se for específica.

SLA padrão.

Mensagem padrão.

Tipo da etapa.

Status ativo/inativo.

20. Mensagens padrão

Cada etapa do pipeline deve permitir mensagem padrão.

Exemplo:

Dia 1 - Ligação: mensagem de primeira tentativa.

Dia 2 - WhatsApp: mensagem de contato por WhatsApp.

Dia 7 - Declínio WhatsApp: mensagem de encerramento por falta de retorno.

Aguardando Biometria: mensagem solicitando biometria.

Aguardando Assinatura: mensagem solicitando assinatura.

Pendência Comercial: mensagem para o consultor resolver pendência.

No detalhe da venda, criar botão:

Copiar mensagem padrão

O sistema deve puxar automaticamente:

Nome do contato.

Nome da empresa.

Operadora.

Tipo de pedido.

Próxima ação.

21. Experiência mobile

O sistema deve ser responsivo.

No mobile:

Usar navegação por abas.

Kanban deve virar lista por etapa.

Cards devem ser grandes e fáceis de clicar.

Botões devem ser bem posicionados.

Filtros devem ficar recolhidos.

Detalhe da venda deve abrir em tela cheia.

A criação da venda deve ser em etapas simples.

Não deixar texto pequeno demais.

Priorizar leitura, toque e velocidade.

22. Requisitos finais de qualidade

O sistema precisa ficar funcional, visualmente premium e pronto para uso.

Não criar apenas telas estáticas. Implementar lógica real de:

Criar venda.

Editar venda.

Criar cliente.

Selecionar cliente existente.

Selecionar colaborador existente.

Selecionar operadora.

Selecionar mês.

Mover card no Kanban.

Registrar histórico.

Importar planilha.

Gerar nota automática.

Filtrar por mês.

Filtrar por operadora.

Exibir dashboard.

Controlar SLA.

Separar ambientes Claro e Vivo.

O resultado precisa parecer um sistema interno profissional, moderno e tecnológico, não uma planilha transformada em tela.

Priorizar visual de impacto, usabilidade comercial e controle operacional.

Nome final do sistema:

OMNI Flow Lab

Subtítulo final:

O laboratório inteligente do pipeline comercial OMNI.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://omniflowlab.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/1e9e293f-2276-46d2-9d2a-4b08c685e7b2).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
