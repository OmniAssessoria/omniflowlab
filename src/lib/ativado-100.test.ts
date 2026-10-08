import { describe, expect, test } from "bun:test";
import { getMissingAtivado100Dates } from "./ativado-100";

describe("getMissingAtivado100Dates", () => {
  test("não exige Portabilidade nem Entrega/Instalação quando as cinco datas obrigatórias estão preenchidas", () => {
    expect(getMissingAtivado100Dates({
      data_recebimento: "2026-09-18",
      data_preenchimento: "2026-09-18",
      data_aceite: "2026-09-18",
      data_input: "2026-09-18",
      data_ativacao: "2026-09-18",
      data_portabilidade: null,
      data_entrega: null,
    })).toEqual([]);
  });

  test("retorna somente as quatro datas obrigatórias faltantes quando só Recebimento está preenchido", () => {
    expect(getMissingAtivado100Dates({
      data_recebimento: "2026-09-18",
      data_preenchimento: null,
      data_aceite: null,
      data_input: null,
      data_ativacao: null,
      data_portabilidade: null,
      data_entrega: null,
    })).toEqual([
      "Preenchimento",
      "Aceite",
      "Input",
      "Ativação",
    ]);
  });
});
