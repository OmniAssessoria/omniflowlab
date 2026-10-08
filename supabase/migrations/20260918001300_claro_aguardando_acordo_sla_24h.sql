-- Correção de fidelidade à planilha CLARO:
-- "AGUARDANDO DE ACORDO" exibe SLA=24h e DIAS=10.
-- O sistema usa SLA em horas, portanto a coluna SLA é a fonte canônica.
update public.status_comercial_operadoras o
set sla_horas = 24,
    updated_at = now()
from public.status_comercial_catalogo c
where c.id = o.status_id
  and o.operadora = 'CLARO'::public.operadora_enum
  and c.nome = 'MV - AGUARDANDO DE ACORDO';
