# Validação — Evolução Mensal — 2026-10-08

Escopo: somente os cards **Evolução Mensal** do Painel TV.

## Estrutura validada
- Card: 160 px.
- Título: 16 px.
- Faixa de barras: 88 px = 18 px do valor + 70 px de trilho.
- Barra: 0 = 2 px; valor positivo = mínimo 4 px; maior mês = 70 px; teto absoluto = 70 px.
- Linha-base: 1 px.
- Datas: faixa separada, iniciando 8 px abaixo da linha-base.
- Barra: largura 100% da coluna, max-width 56 px, box-sizing border-box.
- 6 colunas: repeat(6, minmax(0,1fr)), gap 8 px.
- 4 gráficos: valor reduzido para 12 px apenas nesse cenário para impedir colisão lateral; demais cenários mantêm 13 px.

## Cenários de cálculo
Foram exercitados:
- mês 100x maior que os demais;
- seis meses zerados;
- somente mês atual com valor;
- mês atual com 65 contratos;
- valor R$ 1.234.567;
- 1, 2, 3 e 4 gráficos lado a lado.

Resultado do verificador determinístico: `bad: []`.

Formatação confirmada:
- R$ 795
- R$ 10,9k
- R$ 1,2M

## Encaixe vertical
Área interna útil do card: 146 px.
Estrutura utilizada: 142 px.
Folga interna: 4 px.

Uma renderização estática 1920x1080 com 4 gráficos e valor máximo de R$ 1.234.567 foi inspecionada sem barra cruzando a linha-base, sem sobreposição com datas e sem estouro lateral aparente.

## CI
O workflow `check-painel-tv` do GitHub continua encerrando antes de executar qualquer step (`steps: null`), comportamento já observado em workflows não relacionados. Ele não foi considerado evidência de falha do código desta alteração.
