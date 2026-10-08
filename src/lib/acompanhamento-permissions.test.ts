import { describe, expect, test } from "bun:test";
import { ACOMPANHAMENTO_ROLES, canAccessRoute } from "./permissions";

describe("Acompanhamento da Gestão permissions", () => {
  test("rota é exclusiva de admin e gestor", () => {
    expect(canAccessRoute("/acompanhamento", "admin")).toBe(true);
    expect(canAccessRoute("/acompanhamento", "gestor")).toBe(true);
    expect(canAccessRoute("/acompanhamento", "consultor")).toBe(false);
    expect(canAccessRoute("/acompanhamento", "bko")).toBe(false);
    expect(canAccessRoute("/acompanhamento", "closer")).toBe(false);
  });

  test("papéis do menu são exatamente admin e gestor", () => {
    expect(ACOMPANHAMENTO_ROLES).toEqual(["admin", "gestor"]);
  });
});
