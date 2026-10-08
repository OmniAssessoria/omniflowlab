import { describe, expect, test } from "bun:test";
import { podeGerenciarNotaOnvox } from "./closer-onvox-notes";

describe("permissões das notas ONVOX", () => {
  test("ADM e BKO podem editar ou excluir qualquer nota", () => {
    expect(podeGerenciarNotaOnvox("admin", "admin-1", "outro")).toBe(true);
    expect(podeGerenciarNotaOnvox("bko", "bko-1", "outro")).toBe(true);
  });

  test("Closer e consultor só gerenciam a própria nota", () => {
    expect(podeGerenciarNotaOnvox("closer", "closer-1", "closer-1")).toBe(true);
    expect(podeGerenciarNotaOnvox("consultor", "consultor-1", "consultor-1")).toBe(true);
    expect(podeGerenciarNotaOnvox("closer", "closer-1", "outro")).toBe(false);
    expect(podeGerenciarNotaOnvox("consultor", "consultor-1", "outro")).toBe(false);
  });

  test("gestor e perfis sem usuário não gerenciam notas", () => {
    expect(podeGerenciarNotaOnvox("gestor", "gestor-1", "gestor-1")).toBe(false);
    expect(podeGerenciarNotaOnvox("bko", null, "bko-1")).toBe(false);
  });
});
