# Validação Painel TV — 2026-10-07

Commit auditado na rodada: `f1fe3b19abb6d2fde2ec1921151376be44b83bbc`.

## Dados
- `vw_painel_tv_telecom.fonte` vem diretamente de `vendas.produto`; não há CASE/IF G1/G2/Outros na VIEW atual.
- Contratos da VIEW exigem usuário ativo com perfil `consultor`.
- No mês da validação havia mais de 3 valores reais de fonte; a regra do frontend mantém as 3 maiores por valor e agrega o restante em `Outras`.
- O snapshot autenticado do perfil `telespectador` continuou retornando consultores, contratos e fontes após a alteração.
- O filtro adicional `equipe = Telecom` NÃO foi aplicado porque não existe campo de equipe em `profiles` nem `colaboradores`. Nenhum critério alternativo foi inventado.

## Parabenização
Validação de fronteira no fuso `America/Sao_Paulo`:
- 11:29:59 -> janela 11:30.
- 11:30:00 -> somente janela 16:30.
- 16:29:59 -> janela 16:30.
- 16:30:00 -> fora das duas janelas.

## Layout alterado
Foi executado harness headless com nomes longos, valores `R$ 1.234.567`, 2/4/6/9 consultores e 1/2/3 fontes em 1920x1080, além de 3840x2160, 1366x768 e 1280x1024.
- Ranking alterado: sem overflow nos cenários executados.
- Evolução alterada (100 px): sem overflow depois da compensação de padding/título.
- Participação alterada (anel 112 px, card 140 px, duas colunas acima de 6): sem overflow nos cenários executados.
- O harness isolado usa fonte fallback e marcou Hero/Barras de Meta, blocos não alterados nesta rodada. A bateria anterior da aplicação real registrou `bad: []` nesses blocos. Portanto esta rodada valida especificamente que as áreas modificadas não introduziram novo overflow.

## Mock
`src/lib/tv-data.example.ts` implementa a mesma interface completa da fonte real e pode ser ativado com `VT_TV_USE_EXAMPLE=true`.
