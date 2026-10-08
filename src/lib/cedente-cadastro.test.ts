import { describe, expect, test } from "bun:test";
import {
  cedenteTipoPorDocumento,
  montarPayloadCedente,
  validarCedenteCadastro,
} from "./cedente-cadastro";

describe("cadastro de Cedente PF/PJ", () => {
  test("identifica PF por CPF e PJ por CNPJ", () => {
    expect(cedenteTipoPorDocumento("123.456.789-01")).toBe("PF");
    expect(cedenteTipoPorDocumento("12.345.678/0001-90")).toBe("PJ");
  });

  test("PF exige CPF, nome, email e telefone e não grava razão social", () => {
    expect(validarCedenteCadastro({
      tipoPessoa: "PF",
      documento: "12345678901",
      razaoSocial: "",
      nome: "Maria da Silva",
      email: "maria@exemplo.com",
      telefone: "16999999999",
    })).toBeNull();

    expect(montarPayloadCedente({
      tipoPessoa: "PF",
      documento: "12345678901",
      razaoSocial: "",
      nome: "Maria da Silva",
      email: "maria@exemplo.com",
      telefone: "(16) 99999-9999",
    })).toEqual({
      cnpj_cpf: "12345678901",
      razao_social: null,
      nome: "Maria da Silva",
      email: "maria@exemplo.com",
      telefone: "16999999999",
    });
  });

  test("PJ mantém CNPJ, razão social, nome e email e não exige telefone", () => {
    expect(validarCedenteCadastro({
      tipoPessoa: "PJ",
      documento: "12345678000190",
      razaoSocial: "Empresa Teste Ltda",
      nome: "João",
      email: "joao@empresa.com",
      telefone: "",
    })).toBeNull();

    expect(montarPayloadCedente({
      tipoPessoa: "PJ",
      documento: "12345678000190",
      razaoSocial: "Empresa Teste Ltda",
      nome: "João",
      email: "joao@empresa.com",
      telefone: "16999999999",
    })).toEqual({
      cnpj_cpf: "12345678000190",
      razao_social: "Empresa Teste Ltda",
      nome: "João",
      email: "joao@empresa.com",
      telefone: null,
    });
  });
});
