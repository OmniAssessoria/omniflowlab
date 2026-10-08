from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
permissions = (ROOT / "src/lib/permissions.ts").read_text(encoding="utf-8")
shell = (ROOT / "src/components/app-shell.tsx").read_text(encoding="utf-8")
route_tree = (ROOT / "src/routeTree.gen.ts").read_text(encoding="utf-8")
route = (ROOT / "src/routes/_shell.acompanhamento.tsx").read_text(encoding="utf-8")

assert 'ACOMPANHAMENTO_ROLES: AppRole[] = ["admin", "gestor"]' in permissions
assert '"/acompanhamento": ACOMPANHAMENTO_ROLES' in permissions

assert 'to: "/acompanhamento"' in shell
assert 'label: "Acompanhamento"' in shell
assert 'roles: ACOMPANHAMENTO_ROLES' in shell
assert 'isAcompanhamento' in shell
assert '!isAcompanhamento' in shell, "Seletor global de operadora deve ficar oculto no Acompanhamento"

assert "ShellAcompanhamentoRouteImport" in route_tree
assert "'/acompanhamento': typeof ShellAcompanhamentoRoute" in route_tree
assert "'/_shell/acompanhamento': typeof ShellAcompanhamentoRoute" in route_tree
assert "'/_shell/acompanhamento': {" in route_tree
assert "ShellAcompanhamentoRoute: ShellAcompanhamentoRoute" in route_tree

assert 'primaryRole === "admin" || primaryRole === "gestor"' in route

print("Contrato de navegação/permissão do Acompanhamento OK")
