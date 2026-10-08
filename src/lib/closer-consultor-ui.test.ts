import { describe, expect, test } from "bun:test";
import {
  buildCloserClientPayload,
  filterCloserClientOptions,
  formatBrlInput,
  onvoxDidUsaNumero,
  onvoxProdutosPermitidos,
  onvoxQuantidadePersistida,
  onvoxValorTotalLinha,
  parseBrlInput,
  somenteDigitosOnvox,
  somenteDigitosTake,
  somarReceitaCloser,
  takeApiTipoValido,
  usaFluxoGuiadoNovoPedido,
  type CloserClientOption,
} from "./closer-consultor-ui";

const CLIENTES: CloserClientOption[] = [
  {
    id: "1",
    razao_social: "ACME SERVICOS LTDA",
    cnpj: "12.345.678/0001-90",
    contato: "Ana",
    telefone: "(16) 99999-0000",
    email: "ana@acme.com.br",
    origem_lead: "INDICACAO",
  },
  {
    id: "2",
    razao_social: "BETA TECNOLOGIA SA",
    cnpj: "98.765.432/0001-10",
    contato: "Bruno",
    telefone: "(16) 98888-0000",
    email: "bruno@beta.com.br",
    origem_lead: "OUTBOUND",
  },
];

describe("linhas de cadastro ONVOX", () => {
  test("Novo aceita DID, RAMAIS, 0800 e APARELHO", () => {
    expect(onvoxProdutosPermitidos("NOVO")).toEqual(["DID", "RAMAIS", "0800", "APARELHO"]);
  });

  test("Portabilidade, TT e Portabilidade PF aceitam somente DID", () => {
    expect(onvoxProdutosPermitidos("PORTABILIDADE")).toEqual(["DID"]);
    expect(onvoxProdutosPermitidos("TT")).toEqual(["DID"]);
    expect(onvoxProdutosPermitidos("PORTABILIDADE PF")).toEqual(["DID"]);
  });

  test("Ramais e DID calculam valor total por quantidade x valor unitário", () => {
    expect(onvoxValorTotalLinha("RAMAIS", "4", "5", "")).toBe(20);
    expect(onvoxQuantidadePersistida("RAMAIS", "4")).toBe(4);
    expect(onvoxValorTotalLinha("DID", "3", "7.5", "")).toBe(22.5);
    expect(onvoxQuantidadePersistida("DID", "3")).toBe(3);
  });

  test("0800 e APARELHO são persistidos como uma linha", () => {
    expect(onvoxQuantidadePersistida("0800", "99")).toBe(1);
    expect(onvoxQuantidadePersistida("APARELHO", "99")).toBe(1);
    expect(onvoxValorTotalLinha("0800", "1", "", "12.5")).toBe(12.5);
    expect(onvoxValorTotalLinha("APARELHO", "1", "", "150")).toBe(150);
  });
});

describe("valores BRL do cadastro TAKE", () => {
  test("formata valor numérico como BRL", () => {
    expect(formatBrlInput("1234.5")).toBe("R$ 1.234,50");
    expect(formatBrlInput("0")).toBe("R$ 0,00");
    expect(formatBrlInput("")).toBe("");
  });

  test("converte entrada monetária mascarada para valor decimal", () => {
    expect(parseBrlInput("R$ 1.234,56")).toBe("1234.56");
    expect(parseBrlInput("R$ 0,05")).toBe("0.05");
    expect(parseBrlInput("")).toBe("");
  });
});

describe("campos adicionais do TAKE", () => {
  test("tipo de API aceita somente as duas opções previstas", () => {
    expect(takeApiTipoValido("API OFICIAL")).toBe(true);
    expect(takeApiTipoValido("API NÃO OFICIAL")).toBe(true);
    expect(takeApiTipoValido("OUTRA")).toBe(false);
  });

  test("DDD e número mantêm somente caracteres numéricos", () => {
    expect(somenteDigitosTake("(16)")).toBe("16");
    expect(somenteDigitosTake("99753-2291")).toBe("997532291");
    expect(somenteDigitosTake("abc")).toBe("");
  });
});

describe("fluxo guiado de novo pedido ONVOX/TAKE", () => {
  test("Consultor, Closer, ADM e BKO usam seleção ONVOX/TAKE antes do formulário", () => {
    expect(usaFluxoGuiadoNovoPedido("consultor")).toBe(true);
    expect(usaFluxoGuiadoNovoPedido("closer")).toBe(true);
    expect(usaFluxoGuiadoNovoPedido("admin")).toBe(true);
    expect(usaFluxoGuiadoNovoPedido("bko")).toBe(true);
  });

  test("Gestor mantém o fluxo atual", () => {
    expect(usaFluxoGuiadoNovoPedido("gestor")).toBe(false);
  });
});

describe("fluxo de cadastro do consultor na Operação Closer", () => {
  test("busca cliente por razão social sem diferenciar maiúsculas/minúsculas", () => {
    expect(filterCloserClientOptions(CLIENTES, "acme").map((cliente) => cliente.id)).toEqual(["1"]);
  });

  test("busca cliente por CNPJ mesmo sem pontuação", () => {
    expect(filterCloserClientOptions(CLIENTES, "12345678000190").map((cliente) => cliente.id)).toEqual(["1"]);
  });

  test("cadastro rápido mantém somente os dados solicitados e grava origem técnica", () => {
    expect(buildCloserClientPayload({
      closerId: "closer-1",
      closerNome: "Consultor Teste",
      razaoSocial: " Nova Empresa Ltda ",
      cnpj: "11.222.333/0001-44",
      contato: " Maria ",
      telefone: " (16) 99777-0000 ",
      email: " MARIA@EXEMPLO.COM ",
    })).toEqual({
      closer_id: "closer-1",
      closer_nome: "Consultor Teste",
      razao_social: "Nova Empresa Ltda",
      cnpj: "11.222.333/0001-44",
      contato: "Maria",
      telefone: "(16) 99777-0000",
      email: "maria@exemplo.com",
      origem_lead: "CADASTRO MANUAL",
    });
  });
});


describe("totalizador de receita da Operação Closer", () => {
  test("soma somente os valores recebidos na lista filtrada", () => {
    expect(somarReceitaCloser([
      { receita_total: 120.5 },
      { receita_total: "79.50" },
      { receita_total: null },
      { receita_total: undefined },
    ])).toBe(200);
  });

  test("ignora valores inválidos sem quebrar o total", () => {
    expect(somarReceitaCloser([
      { receita_total: "abc" },
      { receita_total: 50 },
    ])).toBe(50);
  });
});


describe("campos de DID ONVOX", () => {
  test("Portabilidade DID usa DDD e número, sem quantidade comercial", () => {
    expect(onvoxDidUsaNumero("PORTABILIDADE", "DID")).toBe(true);
    expect(onvoxDidUsaNumero("PORTABILIDADE PF", "DID")).toBe(true);
    expect(onvoxQuantidadePersistida("DID", "12", "PORTABILIDADE")).toBe(1);
  });

  test("Novo DID mantém quantidade e usa apenas DDD", () => {
    expect(onvoxDidUsaNumero("NOVO", "DID")).toBe(false);
    expect(onvoxQuantidadePersistida("DID", "12", "NOVO")).toBe(12);
  });

  test("DDD e número mantêm somente dígitos", () => {
    expect(somenteDigitosOnvox("(16)")).toBe("16");
    expect(somenteDigitosOnvox("99753-2291")).toBe("997532291");
  });
});
