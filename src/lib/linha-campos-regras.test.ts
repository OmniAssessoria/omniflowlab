import { describe, expect, test } from "bun:test";
import {
  claroPermiteProduto,
  getLinhaCampoRules,
  linhaPermiteOperadoraDoadora,
  normalizeLinhaLabel,
  operadoraPermiteProduto,
  produtosClaroPermitidos,
  produtosVivoPermitidos,
} from "./linha-campos-regras";

describe("matriz CLARO por Tipo de Pedido + Produto", () => {
  test("Novo + Móvel mantém DDD, plano e valor e bloqueia número", () => {
    const r = getLinhaCampoRules({ operadora: "CLARO", tipoPedido: "Novo", produto: "Móvel" });
    expect(r.bloqueiaDdd).toBe(false);
    expect(r.bloqueiaNumero).toBe(true);
    expect(r.bloqueiaPlano).toBe(false);
    expect(r.bloqueiaValor).toBe(false);
  });

  test("Novo + Fixa usa somente DDD e valor", () => {
    const r = getLinhaCampoRules({ operadora: "CLARO", tipoPedido: "Novo", produto: "Fixa" });
    expect(r.bloqueiaDdd).toBe(false);
    expect(r.bloqueiaNumero).toBe(true);
    expect(r.bloqueiaPlano).toBe(true);
    expect(r.bloqueiaValor).toBe(false);
  });

  test("Novo + Banda Larga usa plano e valor", () => {
    const r = getLinhaCampoRules({ operadora: "CLARO", tipoPedido: "Novo", produto: "Banda Larga" });
    expect(r.bloqueiaDdd).toBe(true);
    expect(r.bloqueiaNumero).toBe(true);
    expect(r.bloqueiaPlano).toBe(false);
    expect(r.bloqueiaValor).toBe(false);
  });

  test("Novo + M2M usa DDD, plano e valor", () => {
    const r = getLinhaCampoRules({ operadora: "CLARO", tipoPedido: "Novo", produto: "M2M" });
    expect(r.bloqueiaDdd).toBe(false);
    expect(r.bloqueiaNumero).toBe(true);
    expect(r.bloqueiaPlano).toBe(false);
    expect(r.bloqueiaValor).toBe(false);
  });

  test("Aparelho bloqueia DDD e número, mas usa plano e valor", () => {
    const r = getLinhaCampoRules({ operadora: "CLARO", tipoPedido: "Renovação", produto: "Aparelho" });
    expect(r.bloqueiaDdd).toBe(true);
    expect(r.bloqueiaNumero).toBe(true);
    expect(r.bloqueiaPlano).toBe(false);
    expect(r.bloqueiaValor).toBe(false);
    expect(r.valorSomenteExtra).toBe(false);
  });

  test("Aparelho VIVO também usa plano e valor", () => {
    const r = getLinhaCampoRules({ operadora: "VIVO", tipoPedido: "NOVO", produto: "APARELHO" });
    expect(r.bloqueiaDdd).toBe(true);
    expect(r.bloqueiaNumero).toBe(true);
    expect(r.bloqueiaPlano).toBe(false);
    expect(r.bloqueiaValor).toBe(false);
    expect(r.valorSomenteExtra).toBe(false);
  });

  test("Chip Dados usa DDD, plano e valor; SVA Portado não usa campos principais", () => {
    const chip = getLinhaCampoRules({ operadora: "CLARO", tipoPedido: "Novo", produto: "Chip Dados" });
    const sva = getLinhaCampoRules({ operadora: "CLARO", tipoPedido: "Portado", produto: "SVA" });
    expect([chip.bloqueiaDdd, chip.bloqueiaNumero, chip.bloqueiaPlano, chip.bloqueiaValor]).toEqual([false, true, false, false]);
    expect([sva.bloqueiaDdd, sva.bloqueiaNumero, sva.bloqueiaPlano, sva.bloqueiaValor]).toEqual([true, true, true, true]);
  });

  test("Transferência CLARO PJ/PJ bloqueia plano e valor e não usa Operadora Doadora", () => {
    const r = getLinhaCampoRules({
      operadora: "CLARO",
      tipoPedido: "Transferência de Titularidade PJ/PJ",
      produto: "Móvel",
    });
    expect(r.bloqueiaPlano).toBe(true);
    expect(r.bloqueiaValor).toBe(true);
    expect(linhaPermiteOperadoraDoadora({
      operadora: "CLARO",
      tipoPedido: "Transferência de Titularidade PJ/PJ",
    })).toBe(false);
    expect(linhaPermiteOperadoraDoadora({
      operadora: "CLARO",
      tipoPedido: "Transferência de Titularidade PF/PJ Pós",
    })).toBe(false);
  });

  test("produtos disponíveis seguem o Tipo de Pedido", () => {
    expect(produtosClaroPermitidos("Renovação")).toEqual(["Móvel", "Aparelho"]);
    expect(produtosClaroPermitidos("Portado")).toEqual(["Fixa", "Móvel", "SVA"]);
    expect(produtosClaroPermitidos("SVA")).toEqual(["Aparelho", "Passaporte"]);
    expect(claroPermiteProduto("Portabilidade PJ/PJ", "Móvel")).toBe(true);
    expect(claroPermiteProduto("Portabilidade PJ/PJ", "Aparelho")).toBe(true);
    expect(claroPermiteProduto("Portabilidade PJ/PJ", "Fixa")).toBe(false);
    expect(claroPermiteProduto("Transferência de Titularidade PJ/PJ", "Móvel")).toBe(true);
    expect(claroPermiteProduto("Transferência de Titularidade PJ/PJ", "Aparelho")).toBe(false);
  });
});


describe("matriz VIVO por Tipo de Pedido + Produto", () => {
  test("normaliza caixa, acentos e variações de escrita", () => {
    expect(normalizeLinhaLabel("  MÓVEL ")).toBe("movel");
    expect(normalizeLinhaLabel("MIGRAÇÃO PRÉ")).toBe("migracao pre");
    expect(normalizeLinhaLabel("CHIP DE DADOS")).toBe("chip dados");
    expect(normalizeLinhaLabel("Microsoft 265")).toBe("microsoft 365");
  });

  test("Migrações usam somente Móvel", () => {
    expect(produtosVivoPermitidos("MIGRAÇÃO PLANO")).toEqual(["Móvel"]);
    expect(produtosVivoPermitidos("migração pré")).toEqual(["Móvel"]);
    expect(produtosVivoPermitidos("MIGRACAO POS")).toEqual(["Móvel"]);
  });

  test("Novo + Móvel usa DDD, plano e valor e bloqueia número", () => {
    const r = getLinhaCampoRules({ operadora: "vivo", tipoPedido: "NOVO", produto: "mÓvEl" });
    expect([r.bloqueiaDdd, r.bloqueiaNumero, r.bloqueiaPlano, r.bloqueiaValor])
      .toEqual([false, true, false, false]);
  });

  test("Migração Pré/Pós + Móvel não usa Operadora Doadora", () => {
    for (const tipoPedido of ["MIGRAÇÃO PRÉ", "migração pós"]) {
      expect(linhaPermiteOperadoraDoadora({ operadora: "VIVO", tipoPedido })).toBe(false);
    }

    expect(linhaPermiteOperadoraDoadora({ operadora: "VIVO", tipoPedido: "MIGRAÇÃO PLANO" })).toBe(true);
  });

  test("Novo + SIP usa DDD, número e valor, sem plano", () => {
    const r = getLinhaCampoRules({ operadora: "VIVO", tipoPedido: "novo", produto: "sip" });
    expect([r.bloqueiaDdd, r.bloqueiaNumero, r.bloqueiaPlano, r.bloqueiaValor])
      .toEqual([false, false, true, false]);
  });

  test("Novo + CHIP DADOS usa DDD, plano e valor", () => {
    const r = getLinhaCampoRules({ operadora: "VIVO", tipoPedido: "novo", produto: "CHIP DE DADOS" });
    expect([r.bloqueiaDdd, r.bloqueiaNumero, r.bloqueiaPlano, r.bloqueiaValor])
      .toEqual([false, true, false, false]);
  });

  test("Novo + M2M usa DDD, número, plano e valor", () => {
    const r = getLinhaCampoRules({ operadora: "VIVO", tipoPedido: "novo", produto: "M2M" });
    expect([r.bloqueiaDdd, r.bloqueiaNumero, r.bloqueiaPlano, r.bloqueiaValor])
      .toEqual([false, false, false, false]);
  });

  test("Novo + Fixa usa DDD e valor", () => {
    const r = getLinhaCampoRules({ operadora: "VIVO", tipoPedido: "novo", produto: "FIXA" });
    expect([r.bloqueiaDdd, r.bloqueiaNumero, r.bloqueiaPlano, r.bloqueiaValor])
      .toEqual([false, true, true, false]);
  });

  test("Novo VIVO + Banda Larga exibe somente plano e valor", () => {
    expect(operadoraPermiteProduto("VIVO", "NOVO", "BANDA LARGA")).toBe(true);
    const r = getLinhaCampoRules({ operadora: "VIVO", tipoPedido: "NOVO", produto: "BANDA LARGA" });
    expect(r.bloqueiaDdd).toBe(true);
    expect(r.bloqueiaNumero).toBe(true);
    expect(r.bloqueiaPlano).toBe(false);
    expect(r.bloqueiaValor).toBe(false);
  });

  test("Novo VIVO aplica os campos específicos dos produtos de serviço", () => {
    const aluguel = getLinhaCampoRules({ operadora: "VIVO", tipoPedido: "NOVO", produto: "ALUGUEL DE EQUIPAMENTOS" });
    const tv = getLinhaCampoRules({ operadora: "VIVO", tipoPedido: "NOVO", produto: "TV" });
    const ip = getLinhaCampoRules({ operadora: "VIVO", tipoPedido: "NOVO", produto: "IP FIXO" });

    expect([aluguel.bloqueiaDdd, aluguel.bloqueiaNumero, aluguel.bloqueiaPlano, aluguel.bloqueiaValor, aluguel.descricaoAdicional])
      .toEqual([true, true, true, false, true]);
    expect([tv.bloqueiaDdd, tv.bloqueiaNumero, tv.bloqueiaPlano, tv.bloqueiaValor])
      .toEqual([true, true, false, false]);
    expect([ip.bloqueiaDdd, ip.bloqueiaNumero, ip.bloqueiaPlano, ip.bloqueiaValor, ip.descricaoAdicional])
      .toEqual([true, true, true, false, true]);
  });

  test("produtos VIVO são filtrados pelo Tipo de Pedido", () => {
    expect(operadoraPermiteProduto("VIVO", "PORTADO", "SIP")).toBe(true);
    expect(operadoraPermiteProduto("VIVO", "PORTADO", "MÓVEL")).toBe(true);
    expect(operadoraPermiteProduto("VIVO", "PORTADO", "TV")).toBe(false);
    expect(operadoraPermiteProduto("VIVO", "SVA", "PASSAPORTE")).toBe(true);
    expect(operadoraPermiteProduto("VIVO", "SVA", "MICROSOFT 365")).toBe(true);
    expect(operadoraPermiteProduto("VIVO", "NOVO", "SIGA-ME")).toBe(false);
    expect(operadoraPermiteProduto("VIVO", "SVA", "SIGA-ME")).toBe(false);
  });

  test("CLARO Chip Dados agora usa DDD, plano e valor", () => {
    const r = getLinhaCampoRules({ operadora: "CLARO", tipoPedido: "NOVO", produto: "CHIP DADOS" });
    expect([r.bloqueiaDdd, r.bloqueiaNumero, r.bloqueiaPlano, r.bloqueiaValor])
      .toEqual([false, true, false, false]);
  });
});
