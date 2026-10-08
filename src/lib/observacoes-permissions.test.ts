import { describe, expect, test } from "bun:test";
import { canManageObservation } from "./observacoes-permissions";

describe("canManageObservation", () => {
  test("permite editar e excluir apenas a própria observação", () => {
    expect(canManageObservation("user-a", "user-a")).toBe(true);
    expect(canManageObservation("user-a", "user-b")).toBe(false);
    expect(canManageObservation("user-a", null)).toBe(false);
  });
});
