from pathlib import Path

migration = Path("supabase/migrations/20260918001000_sync_status_comercial_planilhas.sql").read_text(encoding="utf-8")
correction = Path("supabase/migrations/20260918001300_claro_aguardando_acordo_sla_24h.sql").read_text(encoding="utf-8")

EXPECTED = [
    # CLARO | Móvel
    ("CLARO", "MV - AG ASSIN TERMO 11", 72),
    ("CLARO", "MV - ABRIR TROCA DE CARTEIRA", 48),
    ("CLARO", "MV - TROCA DE CARTEIRA EM ANÁLISE", 48),
    ("CLARO", "MV - TROCA NEGADA", 72),
    ("CLARO", "MV - TROCA NEGADA - CANCELADO", None),
    ("CLARO", "MV - CONFECÇÃO ACEITE", 24),
    ("CLARO", "CONFECÇÃO ANDAMENTO", 24),
    ("CLARO", "MV - PRD ERRO SOLAR", 24),
    ("CLARO", "AGUARDANDO CORREÇÃO CADASTRAL", 24),
    ("CLARO", "MV - DEVOLVIDO CONFECÇÃO", 24),
    ("CLARO", "MV - AGUARDANDO ENVIO GC", 24),
    ("CLARO", "MV - AGUARDANDO ACEITE", 72),
    ("CLARO", "MV - SOLICITAR RENOVAÇÃO ANTECIPADA", 24),
    ("CLARO", "MV - RENOVAÇÃO ANTECIPADA EM ANALISE", 72),
    ("CLARO", "MV - AGUARDANDO DE ACORDO", 24),
    ("CLARO", "MV - AGUARDANDO TEMPO INPUT", None),
    ("CLARO", "MV - PENDENTE MKT", 480),
    ("CLARO", "MV - FILA INPUT", 24),
    ("CLARO", "MV - INPUT EM ANDAMENTO", 24),
    ("CLARO", "MV - PRD CORREÇÃO", 120),
    ("CLARO", "MV - AGUARDANDO BIOMETRIA", 24),
    ("CLARO", "MV - FALTA EQUIPAMENTO", 168),
    ("CLARO", "MV - VALIDAÇÃO PENDENTE", 48),
    ("CLARO", "MV - ANÁLISE DE CRÉDITO", 72),
    ("CLARO", "MV - AGUARDANDO GAR OU BIOMETRIA", 48),
    ("CLARO", "MV - REPROVADO GAR OU BIOMETRIA", 48),
    ("CLARO", "MV - REPROVADO CRÉDITO", None),
    ("CLARO", "MV - DEVOLVIDO BKO", 24),
    ("CLARO", "MV - CONCLUÍDO INSPEÇÃO", 24),
    ("CLARO", "MV - VALIDAR ATIVAÇÃO", None),
    ("CLARO", "MV - AGUARDANDO NOTA FISCAL", 120),
    ("CLARO", "MV - AGUARDANDO ENTREGA", 240),
    ("CLARO", "MV - AGUARDANDO BAIXA NF", 120),
    ("CLARO", "MV - INSUCESSO DE ENTREGA", 120),
    ("CLARO", "MV - ATIVADO 100%", None),
    ("CLARO", "MV - PRD - SUPORTE", 120),
    ("CLARO", "MV - AGUARDANDO PORTABILIDADE", 120),
    ("CLARO", "MV - PORTABILIDADE NEGADA", 120),
    ("CLARO", "MV - CONFLITOS PORTABILIDADE", 120),
    ("CLARO", "MV - CANCELADO", None),
    ("CLARO", "MV - AGUARDANDO CONCLUIR TT", 480),
    ("CLARO", "MV - PENDÊNCIA COMERCIAL", 48),
    ("CLARO", "MV - PENDENTE BKO", 24),
    ("CLARO", "MV - TRATATIVA SUPORTE", 240),

    # CLARO | Fixa
    ("CLARO", "FB - VERIFICANDO VIABILIDADE", 240),
    ("CLARO", "AUDITORIA", 24),
    ("CLARO", "FB - FILA INPUT", 24),
    ("CLARO", "FB - PENDÊNCIA SISTÊMICA", 48),
    ("CLARO", "FB - REPROVADO CRÉDITO", None),
    ("CLARO", "FB - QUALIFICAÇÃO", 24),
    ("CLARO", "FB - REQUALIFICAÇÃO", 24),
    ("CLARO", "FB - PENDENTE INSTALAÇÃO", 48),
    ("CLARO", "FB - CONECTADO", None),

    # VIVO | Móvel
    ("VIVO", "MV - AGUARDANDO CASO", 24),
    ("VIVO", "MV - CONFECÇÃO DE CONTRATO", 24),
    ("VIVO", "MV - AGUARDANDO ACEITE", 72),
    ("VIVO", "MV - AUDITORIA", 72),
    ("VIVO", "MV - FILA DE INSERÇÃO", 48),
    ("VIVO", "MV - CRIAR GESTOR", 48),
    ("VIVO", "MV - PENDÊNCIA BKO INSERÇÃO", 72),
    ("VIVO", "MV - AGUARDANDO STATUS", 24),
    ("VIVO", "MV - SEM ESTOQUE", 168),
    ("VIVO", "MV - MESA DE FRAUDE", 48),
    ("VIVO", "MV - ANÁLISE DE CRÉDITO", 72),
    ("VIVO", "MV - CRÉDITO APROVADO", 48),
    ("VIVO", "MV - CRÉDITO REPROVADO", None),
    ("VIVO", "MV - ANÁLISE BKO", 48),
    ("VIVO", "MV - BKO APROVADO", 48),
    ("VIVO", "MV - BKO REPROVADO", 48),
    ("VIVO", "MV - AGUARDANDO COLETA", 120),
    ("VIVO", "MV - AGUARDANDO ENTREGA", 240),
    ("VIVO", "MV - AGUARDANDO RETIRADA CORREIOS", 168),
    ("VIVO", "MV - OCORRÊNCIA NA ENTREGA", 120),
    ("VIVO", "MV - AGUARDANDO DATA PORTIN", 48),
    ("VIVO", "MV - OCORRÊNCIA PORTIN", 120),
    ("VIVO", "MV - AUSÊNCIA DE RESPOSTA SMS", 24),
    ("VIVO", "MV - AGUARDANDO CONCLUSÃO PORTIN", 120),
    ("VIVO", "MV - TRATATIVA SUPORTE", 192),
    ("VIVO", "MV - LOGÍSTICA CONCLUÍDA", None),
    ("VIVO", "MV - PENDÊNCIA COMERCIAL", 48),
    ("VIVO", "MV - CANCELADO", None),

    # VIVO | Fixa
    ("VIVO", "AUDITORIA", 72),
    ("VIVO", "FB - FILA DE INSERÇÃO", 24),
    ("VIVO", "FB - TRAMITAÇÃO VIVO", 120),
    ("VIVO", "FB - PENDÊNCIA SISTÊMICA", 120),
    ("VIVO", "FB - SMART EM ANDAMENTO", 48),
    ("VIVO", "FB - CRÉDITO REPROVADO", None),
    ("VIVO", "FB - AGUARDANDO INSTALAÇÃO", 24),
    ("VIVO", "FB - AGUARDANDO CONCLUSÃO", 72),
    ("VIVO", "FB - TRATATIVA SUPORTE", 120),
    ("VIVO", "FB - INSTALADO", None),
]

assert len(EXPECTED) == 91, f"A matriz deveria ter 91 combinações e tem {len(EXPECTED)}"
assert sum(1 for op, _, _ in EXPECTED if op == "CLARO") == 53
assert sum(1 for op, _, _ in EXPECTED if op == "VIVO") == 38

missing = []
for operadora, nome, sla in EXPECTED:
    if operadora == "CLARO" and nome == "MV - AGUARDANDO DE ACORDO":
        # A carga inicial refletia a coluna DIAS=10 (240h), mas a coluna SLA
        # da planilha diz 24h. A migração corretiva torna 24h o valor final.
        if nome not in migration or "sla_horas = 24" not in correction or nome not in correction:
            missing.append((operadora, nome, sla))
        continue
    sla_sql = "null" if sla is None else str(sla)
    token = f"('{operadora}','{nome.replace(chr(39), chr(39)*2)}',{sla_sql})"
    if token not in migration:
        missing.append((operadora, nome, sla))

assert not missing, f"Combinações ausentes na carga das planilhas: {missing}"
assert "MV - LOGÍSTICA CONCLUÍDA" in migration
assert "MV - ATIVADO 100%" in migration

print("OK: 91 combinações das planilhas estão protegidas no contrato (53 CLARO, 38 VIVO).")
