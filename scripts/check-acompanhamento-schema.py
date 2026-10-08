from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
MIGRATION = ROOT / "supabase/migrations/20260926103000_acompanhamento_gestao_base.sql"

assert MIGRATION.exists(), "Migration de acompanhamento ainda não existe"
sql = MIGRATION.read_text(encoding="utf-8").lower()

tables = [
    "acompanhamento_configuracoes",
    "acompanhamento_grupos",
    "acompanhamento_tipo_vinculos",
    "acompanhamento_metas_mensais",
    "acompanhamento_metas_semanais",
    "acompanhamento_metas_consultores",
    "acompanhamento_quadros",
    "acompanhamento_quadro_regras",
]

for table in tables:
    assert f"create table" in sql and table in sql, f"Tabela ausente: {table}"
    assert f"alter table public.{table} enable row level security" in sql, f"RLS ausente: {table}"

assert "tipos_pedido_catalogo" in sql, "Vínculo de tipo não referencia o catálogo existente"
assert "acompanhamento_manager" in sql or "is_acompanhamento_manager" in sql, "Helper de autorização ausente"
assert "admin" in sql and "gestor" in sql, "Políticas não restringem a Admin/Gestor"

for literal in [
    "15000.00", "15000,00", "4.000,00", "4000.00", "11.000,00", "11000.00",
    "9122.00", "2585.00", "11707.00"
]:
    assert literal.lower() not in sql, f"Valor monetário da planilha não pode ser semeado: {literal}"

for code in [
    "aguardando_aceite",
    "troca_carteira_caso",
    "confeccao_correcoes",
    "tratativas_pendencias",
    "contratos_gerados_semana",
    "contratos_assinados_semana",
    "meta_enviados_consultor",
    "meta_assinados_consultor",
]:
    assert code in sql, f"Quadro estrutural ausente: {code}"

assert "ag tempo input" not in sql, "AG TEMPO INPUT deve permanecer fora da configuração inicial"

required_statuses = [
    "aguardando aceite",
    "troca de carteira",
    "abrir troca de carteira",
    "aguardando caso",
    "aguardando correção cadastral",
    "aguardando de acordo",
    "confecção aceite",
    "confecção andamento",
    "devolvido confecção",
    "aguardando envio gc",
    "confecção contrato",
    "tratativa suporte",
    "pendente mkt",
]
for status in required_statuses:
    assert status in sql, f"Pré-configuração textual ausente: {status}"

assert re.search(r"unique\s*\(\s*ano\s*,\s*mes\s*,\s*grupo\s*\)", sql), "Unique de meta mensal ausente"
assert "tipo_pedido_id" in sql and "grupo_id" in sql, "Campos do vínculo de tipo ausentes"

print("Contrato de schema do Acompanhamento da Gestão OK")
