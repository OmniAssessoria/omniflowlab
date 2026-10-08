import { describe, expect, test } from "bun:test";
import type { PipelineEtapa, PipelineFunil } from "./pipeline-structure";
import {
  COMMERCIAL_COMPLETION_SOURCE_STAGE_IDS,
  CONSULTOR_ASSINATURA_STAGE_IDS,
  CONSULTOR_PROCESSOS_BKO_STAGE_IDS,
  availableCommercialDestinations,
  canConcludeCommercialOrder,
  canMoveCommercialOrder,
} from "./pipeline-movement";

const funis: PipelineFunil[] = [
  { id: "prospeccao", nome: "Prospecção", ordem: 1, ativo: true, participa_fluxo_comercial: true },
  { id: "followup", nome: "Follow Up", ordem: 2, ativo: false, participa_fluxo_comercial: true },
  { id: "processos_bko", nome: "Processos BKO", ordem: 3, ativo: true, participa_fluxo_comercial: true },
  { id: "assinatura", nome: "Assinatura", ordem: 4, ativo: true, participa_fluxo_comercial: true },
  { id: "suporte", nome: "Suporte", ordem: 5, ativo: true, participa_fluxo_comercial: false },
];

const etapas: PipelineEtapa[] = [
  { id: "p-aguardando", funil_id: "prospeccao", nome: "Aguardando Início", cor: "default", ordem: 1, ativo: true },
  { id: "p-d1-lig", funil_id: "prospeccao", nome: "Dia 1 - Ligação", cor: "info", ordem: 2, ativo: false },
  { id: "f-proposta", funil_id: "followup", nome: "Montar Proposta", cor: "warning", ordem: 11, ativo: true },
  { id: "bko-pendente", funil_id: "processos_bko", nome: "Pendente Consultor", cor: "warning", ordem: 21, ativo: true },
  { id: "bko-apoio", funil_id: "processos_bko", nome: "Apoio Gestão", cor: "warning", ordem: 22, ativo: true },
  { id: "bko-troca", funil_id: "processos_bko", nome: "Troca de Carteira | Abertura de Caso", cor: "warning", ordem: 23, ativo: true },
  { id: "bko-montar", funil_id: "processos_bko", nome: "Montar Pedido", cor: "info", ordem: 24, ativo: true },
  { id: "bko-suporte", funil_id: "processos_bko", nome: "Tratativa de Suporte", cor: "info", ordem: 25, ativo: true },
  { id: "a-aguardando", funil_id: "assinatura", nome: "Aguardando Assinatura", cor: "warning", ordem: 29, ativo: true },
  { id: "a-biometria", funil_id: "assinatura", nome: "Aguardando Biometria", cor: "warning", ordem: 30, ativo: true },
  { id: "a-d1", funil_id: "assinatura", nome: "Dia 1 - Assinatura", cor: "info", ordem: 31, ativo: true },
  { id: "a-d2", funil_id: "assinatura", nome: "Dia 2 - Assinatura", cor: "info", ordem: 32, ativo: true },
  { id: "a-d3", funil_id: "assinatura", nome: "Dia 3 - Assinatura", cor: "info", ordem: 33, ativo: true },
  { id: "a-d4", funil_id: "assinatura", nome: "Dia 4 - Assinatura", cor: "info", ordem: 34, ativo: true },
  { id: "a-apoio", funil_id: "assinatura", nome: "Apoio Gestão", cor: "warning", ordem: 39, ativo: true },
  { id: "a-assinado", funil_id: "assinatura", nome: "Contrato Assinado - Claro", cor: "success", ordem: 40, ativo: true },
  { id: "a-assinado-vivo", funil_id: "assinatura", nome: "Contrato Assinado - Vivo", cor: "success", ordem: 41, ativo: true },
  { id: "s-espera", funil_id: "suporte", nome: "Suportes em Espera", cor: "warning", ordem: 42, ativo: true },
];

describe("availableCommercialDestinations", () => {
  test("oferece somente funis comerciais ativos e visíveis, com etapas ativas", () => {
    const result = availableCommercialDestinations({
      funis,
      etapas,
      visibleFunilIds: ["prospeccao", "followup", "processos_bko", "assinatura", "suporte"],
      currentFunilId: "prospeccao",
      currentEtapaId: "nao-e-a-atual",
      role: "admin",
      operadora: "CLARO",
    });

    expect(result.map(item => item.etapaId)).toEqual([
      "p-aguardando",
      "bko-pendente",
      "bko-apoio",
      "bko-troca",
      "bko-montar",
      "bko-suporte",
      "a-aguardando",
      "a-biometria",
      "a-d1",
      "a-d2",
      "a-d3",
      "a-d4",
      "a-apoio",
      "a-assinado",
      "a-assinado-vivo",
    ]);
    expect(result.some(item => item.funilId === "suporte")).toBe(false);
    expect(result.some(item => item.funilId === "followup")).toBe(false);
    expect(result.some(item => item.etapaId === "p-d1-lig")).toBe(false);
  });

  test("VIVO nunca recebe destino de biometria", () => {
    const result = availableCommercialDestinations({
      funis,
      etapas,
      visibleFunilIds: ["processos_bko", "assinatura"],
      currentFunilId: "assinatura",
      currentEtapaId: "a-d1",
      role: "admin",
      operadora: "VIVO",
    });

    expect(result.some(item => item.etapaId === "a-biometria")).toBe(false);
    expect(result.some(item => item.etapaId === "a-d2")).toBe(true);
  });

  test("respeita a visibilidade do usuário e remove o destino atual", () => {
    const result = availableCommercialDestinations({
      funis,
      etapas,
      visibleFunilIds: ["prospeccao", "assinatura"],
      currentFunilId: "assinatura",
      currentEtapaId: "a-assinado",
      role: "bko",
      operadora: "CLARO",
    });

    expect(result.map(item => item.etapaId)).toEqual([
      "p-aguardando",
      "a-aguardando",
      "a-biometria",
      "a-d1",
      "a-d2",
      "a-d3",
      "a-d4",
      "a-apoio",
      "a-assinado-vivo",
    ]);
  });

  test("consultor vê somente os destinos autorizados, sem Contrato Assinado", () => {
    expect(CONSULTOR_PROCESSOS_BKO_STAGE_IDS).toEqual(["bko-pendente", "bko-montar", "bko-apoio", "bko-troca"]);
    expect(CONSULTOR_ASSINATURA_STAGE_IDS).toEqual(["a-d1", "a-d2", "a-d3", "a-d4", "a-apoio"]);

    const result = availableCommercialDestinations({
      funis,
      etapas,
      visibleFunilIds: ["prospeccao", "processos_bko", "assinatura"],
      currentFunilId: "prospeccao",
      currentEtapaId: "p-aguardando",
      role: "consultor",
      operadora: "VIVO",
    });

    expect(result.map(item => item.etapaId)).toEqual([
      "bko-pendente",
      "bko-apoio",
      "bko-troca",
      "bko-montar",
      "a-d1",
      "a-d2",
      "a-d3",
      "a-d4",
      "a-apoio",
    ]);
  });

  test("consultor continua vendo os destinos permitidos quando já está em Assinatura", () => {
    const result = availableCommercialDestinations({
      funis,
      etapas,
      visibleFunilIds: ["prospeccao", "processos_bko", "assinatura"],
      currentFunilId: "assinatura",
      currentEtapaId: "a-d1",
      role: "consultor",
      operadora: "VIVO",
    });

    expect(result.map(item => item.etapaId)).toEqual([
      "bko-pendente",
      "bko-apoio",
      "bko-troca",
      "bko-montar",
      "a-d2",
      "a-d3",
      "a-d4",
      "a-apoio",
    ]);
  });

  test("consultor nunca recebe Contrato Assinado nem etapas comerciais não autorizadas", () => {
    const result = availableCommercialDestinations({
      funis,
      etapas,
      visibleFunilIds: ["prospeccao", "processos_bko", "assinatura"],
      currentFunilId: "processos_bko",
      currentEtapaId: "bko-montar",
      role: "consultor",
      operadora: "CLARO",
    });

    expect(result.map(item => item.etapaId)).toEqual([
      "bko-pendente",
      "bko-apoio",
      "bko-troca",
      "a-d1",
      "a-d2",
      "a-d3",
      "a-d4",
      "a-apoio",
    ]);
    expect(result.some(item => ["p-aguardando", "bko-suporte", "a-aguardando", "a-assinado", "a-assinado-vivo"].includes(item.etapaId))).toBe(false);
  });
  test("Contrato Assinado aparece somente para BKO e ADM", () => {
    for (const role of ["consultor", "gestor"] as const) {
      const result = availableCommercialDestinations({
        funis,
        etapas,
        visibleFunilIds: ["assinatura"],
        currentFunilId: "assinatura",
        currentEtapaId: "a-d1",
        role,
        operadora: "CLARO",
      });
      expect(result.some(item => item.etapaId === "a-assinado")).toBe(false);
    }

    for (const role of ["bko", "admin"] as const) {
      const result = availableCommercialDestinations({
        funis,
        etapas,
        visibleFunilIds: ["assinatura"],
        currentFunilId: "assinatura",
        currentEtapaId: "a-d1",
        role,
        operadora: "CLARO",
      });
      expect(result.some(item => item.etapaId === "a-assinado")).toBe(true);
    }
  });
});

describe("permissões comerciais", () => {
  test("consultor, gestor, BKO e admin podem usar a movimentação comercial", () => {
    expect(canMoveCommercialOrder("consultor")).toBe(true);
    expect(canMoveCommercialOrder("gestor")).toBe(true);
    expect(canMoveCommercialOrder("bko")).toBe(true);
    expect(canMoveCommercialOrder("admin")).toBe(true);
    expect(canMoveCommercialOrder("suporte")).toBe(false);
  });

  test("somente BKO e admin concluem, e apenas nas etapas assinadas", () => {
    expect(COMMERCIAL_COMPLETION_SOURCE_STAGE_IDS).toEqual(["a-assinado"]);
    expect(canConcludeCommercialOrder("bko", "a-assinado", null)).toBe(true);
    expect(canConcludeCommercialOrder("admin", "a-assinado", null)).toBe(true);
    expect(canConcludeCommercialOrder("gestor", "a-assinado", null)).toBe(false);
    expect(canConcludeCommercialOrder("consultor", "a-assinado", null)).toBe(false);
    expect(canConcludeCommercialOrder("bko", "a-aguardando", null)).toBe(false);
    expect(canConcludeCommercialOrder("bko", "a-assinado", "2026-09-15T18:00:00Z")).toBe(false);
  });
});
