import { describe, expect, test } from "bun:test";
import { podeGerenciarNotaSuporte } from "./support-note-permissions";

describe("permissão de notas do suporte", () => {
  test("ADM pode editar e excluir qualquer nota", () => {
    expect(podeGerenciarNotaSuporte("admin", "admin-id", "outro-user-id")).toBe(true);
  });

  test("BKO pode gerenciar qualquer nota e consultor somente a própria", () => {
    expect(podeGerenciarNotaSuporte("bko", "bko-id", "outro-user-id")).toBe(true);
    expect(podeGerenciarNotaSuporte("consultor", "consultor-id", "consultor-id")).toBe(true);
    expect(podeGerenciarNotaSuporte("consultor", "consultor-id", "outro-user-id")).toBe(false);
  });
});
