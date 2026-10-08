-- Sincroniza os Status Comerciais e SLAs com as planilhas CLARO/VIVO
-- revisadas em 2026-09-17. MV = Móvel; FB = Fixa.
--
-- Observação da fonte: "AGUARDANDO DE ACORDO" mostra 24h na coluna SLA
-- e 10 dias na coluna DIAS. Mantemos 240h, coerente com 10 dias e com a
-- configuração operacional que já existia no sistema.

-- Corrige três nomes antigos que vieram com siglas que não aparecem na planilha atual.
update public.status_comercial_catalogo
set nome = 'MV - ANÁLISE DE CRÉDITO'
where nome = 'MV - ANÁLISE DE CRÉDITO (CPC)'
  and not exists (
    select 1 from public.status_comercial_catalogo
    where lower(nome) = lower('MV - ANÁLISE DE CRÉDITO')
  );

update public.status_comercial_catalogo
set nome = 'MV - VALIDAÇÃO PENDENTE'
where nome = 'MV - VALIDAÇÃO PENDENTE (CPC)'
  and not exists (
    select 1 from public.status_comercial_catalogo
    where lower(nome) = lower('MV - VALIDAÇÃO PENDENTE')
  );

update public.status_comercial_catalogo
set nome = 'MV - CONCLUÍDO INSPEÇÃO'
where nome = 'MV - CONCLUÍDO INSPEÇÃO (CPO)'
  and not exists (
    select 1 from public.status_comercial_catalogo
    where lower(nome) = lower('MV - CONCLUÍDO INSPEÇÃO')
  );

with source(operadora, nome, sla_horas) as (
  values
    -- CLARO | Móvel
    ('CLARO','MV - AG ASSIN TERMO 11',72),
    ('CLARO','MV - ABRIR TROCA DE CARTEIRA',48),
    ('CLARO','MV - TROCA DE CARTEIRA EM ANÁLISE',48),
    ('CLARO','MV - TROCA NEGADA',72),
    ('CLARO','MV - TROCA NEGADA - CANCELADO',null),
    ('CLARO','MV - CONFECÇÃO ACEITE',24),
    ('CLARO','CONFECÇÃO ANDAMENTO',24),
    ('CLARO','MV - PRD ERRO SOLAR',24),
    ('CLARO','AGUARDANDO CORREÇÃO CADASTRAL',24),
    ('CLARO','MV - DEVOLVIDO CONFECÇÃO',24),
    ('CLARO','MV - AGUARDANDO ENVIO GC',24),
    ('CLARO','MV - AGUARDANDO ACEITE',72),
    ('CLARO','MV - SOLICITAR RENOVAÇÃO ANTECIPADA',24),
    ('CLARO','MV - RENOVAÇÃO ANTECIPADA EM ANALISE',72),
    ('CLARO','MV - AGUARDANDO DE ACORDO',240),
    ('CLARO','MV - AGUARDANDO TEMPO INPUT',null),
    ('CLARO','MV - PENDENTE MKT',480),
    ('CLARO','MV - FILA INPUT',24),
    ('CLARO','MV - INPUT EM ANDAMENTO',24),
    ('CLARO','MV - PRD CORREÇÃO',120),
    ('CLARO','MV - AGUARDANDO BIOMETRIA',24),
    ('CLARO','MV - FALTA EQUIPAMENTO',168),
    ('CLARO','MV - VALIDAÇÃO PENDENTE',48),
    ('CLARO','MV - ANÁLISE DE CRÉDITO',72),
    ('CLARO','MV - AGUARDANDO GAR OU BIOMETRIA',48),
    ('CLARO','MV - REPROVADO GAR OU BIOMETRIA',48),
    ('CLARO','MV - REPROVADO CRÉDITO',null),
    ('CLARO','MV - DEVOLVIDO BKO',24),
    ('CLARO','MV - CONCLUÍDO INSPEÇÃO',24),
    ('CLARO','MV - VALIDAR ATIVAÇÃO',null),
    ('CLARO','MV - AGUARDANDO NOTA FISCAL',120),
    ('CLARO','MV - AGUARDANDO ENTREGA',240),
    ('CLARO','MV - AGUARDANDO BAIXA NF',120),
    ('CLARO','MV - INSUCESSO DE ENTREGA',120),
    ('CLARO','MV - ATIVADO 100%',null),
    ('CLARO','MV - PRD - SUPORTE',120),
    ('CLARO','MV - AGUARDANDO PORTABILIDADE',120),
    ('CLARO','MV - PORTABILIDADE NEGADA',120),
    ('CLARO','MV - CONFLITOS PORTABILIDADE',120),
    ('CLARO','MV - CANCELADO',null),
    ('CLARO','MV - AGUARDANDO CONCLUIR TT',480),
    ('CLARO','MV - PENDÊNCIA COMERCIAL',48),
    ('CLARO','MV - PENDENTE BKO',24),
    ('CLARO','MV - TRATATIVA SUPORTE',240),

    -- CLARO | Fixa
    ('CLARO','FB - VERIFICANDO VIABILIDADE',240),
    ('CLARO','AUDITORIA',24),
    ('CLARO','FB - FILA INPUT',24),
    ('CLARO','FB - PENDÊNCIA SISTÊMICA',48),
    ('CLARO','FB - REPROVADO CRÉDITO',null),
    ('CLARO','FB - QUALIFICAÇÃO',24),
    ('CLARO','FB - REQUALIFICAÇÃO',24),
    ('CLARO','FB - PENDENTE INSTALAÇÃO',48),
    ('CLARO','FB - CONECTADO',null),

    -- VIVO | Móvel
    ('VIVO','MV - AGUARDANDO CASO',24),
    ('VIVO','MV - CONFECÇÃO DE CONTRATO',24),
    ('VIVO','MV - AGUARDANDO ACEITE',72),
    ('VIVO','MV - AUDITORIA',72),
    ('VIVO','MV - FILA DE INSERÇÃO',48),
    ('VIVO','MV - CRIAR GESTOR',48),
    ('VIVO','MV - PENDÊNCIA BKO INSERÇÃO',72),
    ('VIVO','MV - AGUARDANDO STATUS',24),
    ('VIVO','MV - SEM ESTOQUE',168),
    ('VIVO','MV - MESA DE FRAUDE',48),
    ('VIVO','MV - ANÁLISE DE CRÉDITO',72),
    ('VIVO','MV - CRÉDITO APROVADO',48),
    ('VIVO','MV - CRÉDITO REPROVADO',null),
    ('VIVO','MV - ANÁLISE BKO',48),
    ('VIVO','MV - BKO APROVADO',48),
    ('VIVO','MV - BKO REPROVADO',48),
    ('VIVO','MV - AGUARDANDO COLETA',120),
    ('VIVO','MV - AGUARDANDO ENTREGA',240),
    ('VIVO','MV - AGUARDANDO RETIRADA CORREIOS',168),
    ('VIVO','MV - OCORRÊNCIA NA ENTREGA',120),
    ('VIVO','MV - AGUARDANDO DATA PORTIN',48),
    ('VIVO','MV - OCORRÊNCIA PORTIN',120),
    ('VIVO','MV - AUSÊNCIA DE RESPOSTA SMS',24),
    ('VIVO','MV - AGUARDANDO CONCLUSÃO PORTIN',120),
    ('VIVO','MV - TRATATIVA SUPORTE',192),
    ('VIVO','MV - LOGÍSTICA CONCLUÍDA',null),
    ('VIVO','MV - PENDÊNCIA COMERCIAL',48),
    ('VIVO','MV - CANCELADO',null),

    -- VIVO | Fixa
    ('VIVO','AUDITORIA',72),
    ('VIVO','FB - FILA DE INSERÇÃO',24),
    ('VIVO','FB - TRAMITAÇÃO VIVO',120),
    ('VIVO','FB - PENDÊNCIA SISTÊMICA',120),
    ('VIVO','FB - SMART EM ANDAMENTO',48),
    ('VIVO','FB - CRÉDITO REPROVADO',null),
    ('VIVO','FB - AGUARDANDO INSTALAÇÃO',24),
    ('VIVO','FB - AGUARDANDO CONCLUSÃO',72),
    ('VIVO','FB - TRATATIVA SUPORTE',120),
    ('VIVO','FB - INSTALADO',null)
),
missing_names as (
  select nome,
         900 + row_number() over (order by nome) * 10 as ordem
  from (
    select distinct nome
    from source
  ) n
  where not exists (
    select 1
    from public.status_comercial_catalogo c
    where lower(c.nome) = lower(n.nome)
  )
)
insert into public.status_comercial_catalogo(nome, ordem, ativo)
select nome, ordem, true
from missing_names;

with source(operadora, nome, sla_horas) as (
  values
    ('CLARO','MV - AG ASSIN TERMO 11',72),
    ('CLARO','MV - ABRIR TROCA DE CARTEIRA',48),
    ('CLARO','MV - TROCA DE CARTEIRA EM ANÁLISE',48),
    ('CLARO','MV - TROCA NEGADA',72),
    ('CLARO','MV - TROCA NEGADA - CANCELADO',null),
    ('CLARO','MV - CONFECÇÃO ACEITE',24),
    ('CLARO','CONFECÇÃO ANDAMENTO',24),
    ('CLARO','MV - PRD ERRO SOLAR',24),
    ('CLARO','AGUARDANDO CORREÇÃO CADASTRAL',24),
    ('CLARO','MV - DEVOLVIDO CONFECÇÃO',24),
    ('CLARO','MV - AGUARDANDO ENVIO GC',24),
    ('CLARO','MV - AGUARDANDO ACEITE',72),
    ('CLARO','MV - SOLICITAR RENOVAÇÃO ANTECIPADA',24),
    ('CLARO','MV - RENOVAÇÃO ANTECIPADA EM ANALISE',72),
    ('CLARO','MV - AGUARDANDO DE ACORDO',240),
    ('CLARO','MV - AGUARDANDO TEMPO INPUT',null),
    ('CLARO','MV - PENDENTE MKT',480),
    ('CLARO','MV - FILA INPUT',24),
    ('CLARO','MV - INPUT EM ANDAMENTO',24),
    ('CLARO','MV - PRD CORREÇÃO',120),
    ('CLARO','MV - AGUARDANDO BIOMETRIA',24),
    ('CLARO','MV - FALTA EQUIPAMENTO',168),
    ('CLARO','MV - VALIDAÇÃO PENDENTE',48),
    ('CLARO','MV - ANÁLISE DE CRÉDITO',72),
    ('CLARO','MV - AGUARDANDO GAR OU BIOMETRIA',48),
    ('CLARO','MV - REPROVADO GAR OU BIOMETRIA',48),
    ('CLARO','MV - REPROVADO CRÉDITO',null),
    ('CLARO','MV - DEVOLVIDO BKO',24),
    ('CLARO','MV - CONCLUÍDO INSPEÇÃO',24),
    ('CLARO','MV - VALIDAR ATIVAÇÃO',null),
    ('CLARO','MV - AGUARDANDO NOTA FISCAL',120),
    ('CLARO','MV - AGUARDANDO ENTREGA',240),
    ('CLARO','MV - AGUARDANDO BAIXA NF',120),
    ('CLARO','MV - INSUCESSO DE ENTREGA',120),
    ('CLARO','MV - ATIVADO 100%',null),
    ('CLARO','MV - PRD - SUPORTE',120),
    ('CLARO','MV - AGUARDANDO PORTABILIDADE',120),
    ('CLARO','MV - PORTABILIDADE NEGADA',120),
    ('CLARO','MV - CONFLITOS PORTABILIDADE',120),
    ('CLARO','MV - CANCELADO',null),
    ('CLARO','MV - AGUARDANDO CONCLUIR TT',480),
    ('CLARO','MV - PENDÊNCIA COMERCIAL',48),
    ('CLARO','MV - PENDENTE BKO',24),
    ('CLARO','MV - TRATATIVA SUPORTE',240),
    ('CLARO','FB - VERIFICANDO VIABILIDADE',240),
    ('CLARO','AUDITORIA',24),
    ('CLARO','FB - FILA INPUT',24),
    ('CLARO','FB - PENDÊNCIA SISTÊMICA',48),
    ('CLARO','FB - REPROVADO CRÉDITO',null),
    ('CLARO','FB - QUALIFICAÇÃO',24),
    ('CLARO','FB - REQUALIFICAÇÃO',24),
    ('CLARO','FB - PENDENTE INSTALAÇÃO',48),
    ('CLARO','FB - CONECTADO',null),
    ('VIVO','MV - AGUARDANDO CASO',24),
    ('VIVO','MV - CONFECÇÃO DE CONTRATO',24),
    ('VIVO','MV - AGUARDANDO ACEITE',72),
    ('VIVO','MV - AUDITORIA',72),
    ('VIVO','MV - FILA DE INSERÇÃO',48),
    ('VIVO','MV - CRIAR GESTOR',48),
    ('VIVO','MV - PENDÊNCIA BKO INSERÇÃO',72),
    ('VIVO','MV - AGUARDANDO STATUS',24),
    ('VIVO','MV - SEM ESTOQUE',168),
    ('VIVO','MV - MESA DE FRAUDE',48),
    ('VIVO','MV - ANÁLISE DE CRÉDITO',72),
    ('VIVO','MV - CRÉDITO APROVADO',48),
    ('VIVO','MV - CRÉDITO REPROVADO',null),
    ('VIVO','MV - ANÁLISE BKO',48),
    ('VIVO','MV - BKO APROVADO',48),
    ('VIVO','MV - BKO REPROVADO',48),
    ('VIVO','MV - AGUARDANDO COLETA',120),
    ('VIVO','MV - AGUARDANDO ENTREGA',240),
    ('VIVO','MV - AGUARDANDO RETIRADA CORREIOS',168),
    ('VIVO','MV - OCORRÊNCIA NA ENTREGA',120),
    ('VIVO','MV - AGUARDANDO DATA PORTIN',48),
    ('VIVO','MV - OCORRÊNCIA PORTIN',120),
    ('VIVO','MV - AUSÊNCIA DE RESPOSTA SMS',24),
    ('VIVO','MV - AGUARDANDO CONCLUSÃO PORTIN',120),
    ('VIVO','MV - TRATATIVA SUPORTE',192),
    ('VIVO','MV - LOGÍSTICA CONCLUÍDA',null),
    ('VIVO','MV - PENDÊNCIA COMERCIAL',48),
    ('VIVO','MV - CANCELADO',null),
    ('VIVO','AUDITORIA',72),
    ('VIVO','FB - FILA DE INSERÇÃO',24),
    ('VIVO','FB - TRAMITAÇÃO VIVO',120),
    ('VIVO','FB - PENDÊNCIA SISTÊMICA',120),
    ('VIVO','FB - SMART EM ANDAMENTO',48),
    ('VIVO','FB - CRÉDITO REPROVADO',null),
    ('VIVO','FB - AGUARDANDO INSTALAÇÃO',24),
    ('VIVO','FB - AGUARDANDO CONCLUSÃO',72),
    ('VIVO','FB - TRATATIVA SUPORTE',120),
    ('VIVO','FB - INSTALADO',null)
)
insert into public.status_comercial_operadoras(status_id, operadora, sla_horas, ativo, updated_at)
select c.id, s.operadora::public.operadora_enum, s.sla_horas, true, now()
from source s
join public.status_comercial_catalogo c
  on lower(c.nome) = lower(s.nome)
on conflict (status_id, operadora)
do update set
  sla_horas = excluded.sla_horas,
  ativo = true,
  updated_at = now();
