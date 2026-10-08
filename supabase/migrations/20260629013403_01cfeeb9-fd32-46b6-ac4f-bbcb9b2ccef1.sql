
-- Catálogos e bases para a Importação Inicial das planilhas Claro/Vivo

-- 1. CLIENTES
CREATE TABLE public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj_cpf TEXT,
  razao_social TEXT NOT NULL,
  uf TEXT,
  ddd TEXT,
  contato TEXT,
  telefone TEXT,
  email TEXT,
  operadoras TEXT[] NOT NULL DEFAULT '{}',
  receita_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  qtd_linhas_total INTEGER NOT NULL DEFAULT 0,
  ultima_venda_em TIMESTAMPTZ,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX clientes_cnpj_cpf_uniq ON public.clientes(cnpj_cpf) WHERE cnpj_cpf IS NOT NULL;
CREATE UNIQUE INDEX clientes_razao_uf_ddd_uniq ON public.clientes(razao_social, COALESCE(uf,''), COALESCE(ddd,'')) WHERE cnpj_cpf IS NULL;
CREATE INDEX clientes_razao_idx ON public.clientes USING gin (to_tsvector('portuguese', razao_social));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes TO authenticated;
GRANT ALL ON public.clientes TO service_role;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clientes leitura autenticado" ON public.clientes FOR SELECT TO authenticated USING (true);
CREATE POLICY "clientes escrita admin/gestor" ON public.clientes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor'));

CREATE TRIGGER clientes_touch BEFORE UPDATE ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2. COLABORADORES
CREATE TABLE public.colaboradores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_normalizado TEXT NOT NULL UNIQUE,
  nome_exibicao TEXT NOT NULL,
  funcao TEXT,
  mesa TEXT,
  operadoras TEXT[] NOT NULL DEFAULT '{}',
  ativo BOOLEAN NOT NULL DEFAULT true,
  origem TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.colaboradores TO authenticated;
GRANT ALL ON public.colaboradores TO service_role;
ALTER TABLE public.colaboradores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "colab leitura" ON public.colaboradores FOR SELECT TO authenticated USING (true);
CREATE POLICY "colab escrita admin/gestor" ON public.colaboradores FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor'));
CREATE TRIGGER colab_touch BEFORE UPDATE ON public.colaboradores FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3. CATÁLOGOS (status / produtos / tipos de pedido)
CREATE TABLE public.status_catalogo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operadora TEXT NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  sla_horas INTEGER,
  cor TEXT,
  tipo TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(operadora, nome)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.status_catalogo TO authenticated;
GRANT ALL ON public.status_catalogo TO service_role;
ALTER TABLE public.status_catalogo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "status_cat leitura" ON public.status_catalogo FOR SELECT TO authenticated USING (true);
CREATE POLICY "status_cat escrita admin" ON public.status_catalogo FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.produtos_catalogo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operadora TEXT NOT NULL,
  nome TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(operadora, nome)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.produtos_catalogo TO authenticated;
GRANT ALL ON public.produtos_catalogo TO service_role;
ALTER TABLE public.produtos_catalogo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prod_cat leitura" ON public.produtos_catalogo FOR SELECT TO authenticated USING (true);
CREATE POLICY "prod_cat escrita admin" ON public.produtos_catalogo FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.tipos_pedido_catalogo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operadora TEXT NOT NULL,
  nome TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(operadora, nome)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tipos_pedido_catalogo TO authenticated;
GRANT ALL ON public.tipos_pedido_catalogo TO service_role;
ALTER TABLE public.tipos_pedido_catalogo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tipos_cat leitura" ON public.tipos_pedido_catalogo FOR SELECT TO authenticated USING (true);
CREATE POLICY "tipos_cat escrita admin" ON public.tipos_pedido_catalogo FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 4. ERROS DE IMPORTAÇÃO
CREATE TABLE public.import_erros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID,
  arquivo TEXT,
  aba TEXT,
  linha INTEGER,
  coluna TEXT,
  valor TEXT,
  motivo TEXT,
  status TEXT NOT NULL DEFAULT 'pendente',
  corrigido_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  corrigido_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_erros TO authenticated;
GRANT ALL ON public.import_erros TO service_role;
ALTER TABLE public.import_erros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "erros leitura admin/gestor" ON public.import_erros FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor'));
CREATE POLICY "erros escrita admin" ON public.import_erros FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 5. AUDITORIA DAS RODADAS DE IMPORTAÇÃO
CREATE TABLE public.import_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  arquivos JSONB NOT NULL DEFAULT '[]',
  totais JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'concluido',
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_runs TO authenticated;
GRANT ALL ON public.import_runs TO service_role;
ALTER TABLE public.import_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "runs leitura admin/gestor" ON public.import_runs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor'));
CREATE POLICY "runs escrita admin" ON public.import_runs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 6. EXTENSÕES NA TABELA VENDAS
ALTER TABLE public.vendas
  ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS consultor_colab_id UUID REFERENCES public.colaboradores(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS bko_colab_id UUID REFERENCES public.colaboradores(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS arquivo_origem TEXT,
  ADD COLUMN IF NOT EXISTS aba_origem TEXT,
  ADD COLUMN IF NOT EXISTS linha_origem INTEGER,
  ADD COLUMN IF NOT EXISTS dados_originais JSONB,
  ADD COLUMN IF NOT EXISTS data_preenchimento DATE,
  ADD COLUMN IF NOT EXISTS data_envio DATE,
  ADD COLUMN IF NOT EXISTS data_input DATE,
  ADD COLUMN IF NOT EXISTS ddd TEXT,
  ADD COLUMN IF NOT EXISTS cotacao TEXT,
  ADD COLUMN IF NOT EXISTS numero_pedido TEXT,
  ADD COLUMN IF NOT EXISTS status_portabilidade TEXT,
  ADD COLUMN IF NOT EXISTS data_portabilidade DATE,
  ADD COLUMN IF NOT EXISTS status_biometria TEXT,
  ADD COLUMN IF NOT EXISTS viabilidade_fixa TEXT,
  ADD COLUMN IF NOT EXISTS nota_fiscal TEXT,
  ADD COLUMN IF NOT EXISTS cod_rastreio TEXT,
  ADD COLUMN IF NOT EXISTS serie TEXT,
  ADD COLUMN IF NOT EXISTS equipamentos TEXT,
  ADD COLUMN IF NOT EXISTS data_entrega DATE,
  ADD COLUMN IF NOT EXISTS bko_nome TEXT;

CREATE INDEX IF NOT EXISTS idx_vendas_cliente_id ON public.vendas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_vendas_consultor_colab ON public.vendas(consultor_colab_id);
