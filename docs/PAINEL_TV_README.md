# Painel TV
1. A rota visual é `/tv`, exclusiva do perfil `telespectador`, e não altera vendas, linhas, planos, tipos de pedido ou status.
2. Contrato assinado usa a primeira movimentação histórica para `a-assinado`; a fonte vem diretamente de `vendas.produto`, sem CASE/IF fixo.
3. No painel, até 3 fontes aparecem individualmente; acima disso, as 3 de maior valor no mês permanecem e o restante é agrupado dinamicamente como `Outras`.
4. Consultores e contratos já exigem usuário ativo + perfil `consultor`; o filtro adicional `equipe = Telecom` segue pendente porque hoje não existe campo de equipe em `profiles` ou `colaboradores`.
5. A integração real fica em `src/lib/tv-data.ts`: `snapshot()`, `assinar(callback)` e `salvarMetas()`; polling padrão de 10 s preserva o último snapshot em falhas.
6. O mock completo fica em `src/lib/tv-data.example.ts` e pode ser ativado com `VT_TV_USE_EXAMPLE=true`, usando a mesma interface da fonte real.
7. As parabenizações usam o fuso `America/Sao_Paulo` e janelas semiabertas: [00:00,11:30) e [11:30,16:30), sem duplicar contratos às 11:30.
8. O palco permanece fixo em 1920x1080; Evolução usa card de 160 px com faixa de barras de 88 px (18 px para valor + trilho de 70 px), linha-base separada e datas 8 px abaixo; Participação mantém anel de 112 px.
9. A Participação usa 140 px de altura, não ~120 px, porque 112 px de anel + título + padding não cabem em 120 px; ranking aplica mínimo de 200 px até 6 consultores, mas 7–9 usam o espaço restante para preservar o palco 1080 sem overflow.
10. Após qualquer alteração de layout/dados, repetir 1920x1080, 3840x2160, 1366x768 e 1280x1024, cenários 2/4/6/9 consultores e 1/2/3 fontes, nomes longos, valores altos e verificação `bad: []`.
