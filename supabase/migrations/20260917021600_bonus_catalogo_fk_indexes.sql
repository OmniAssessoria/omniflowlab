-- Índices de apoio às FKs de auditoria do catálogo de bônus VIVO.
create index if not exists idx_bonus_vivo_catalogo_created_by
  on public.bonus_vivo_catalogo(created_by);

create index if not exists idx_bonus_vivo_catalogo_updated_by
  on public.bonus_vivo_catalogo(updated_by);
