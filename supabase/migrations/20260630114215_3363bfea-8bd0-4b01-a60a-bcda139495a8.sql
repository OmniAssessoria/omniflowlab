
-- Fase 1: trancar visibilidade por perfil

-- 1) Consultor: ampliar SELECT/UPDATE para tambem cobrir 'created_by' (quem criou a venda)
DROP POLICY IF EXISTS "Consultor vê suas vendas" ON public.vendas;
CREATE POLICY "Consultor vê suas vendas"
ON public.vendas FOR SELECT
TO authenticated
USING (consultor_id = auth.uid() OR created_by = auth.uid());

DROP POLICY IF EXISTS "Consultor edita as próprias vendas" ON public.vendas;
CREATE POLICY "Consultor edita as próprias vendas"
ON public.vendas FOR UPDATE
TO authenticated
USING (consultor_id = auth.uid() OR created_by = auth.uid())
WITH CHECK (consultor_id = auth.uid() OR created_by = auth.uid());

-- 2) Consultor: permitir INSERIR vendas se o consultor for ele mesmo
DROP POLICY IF EXISTS "Consultor cria as próprias vendas" ON public.vendas;
CREATE POLICY "Consultor cria as próprias vendas"
ON public.vendas FOR INSERT
TO authenticated
WITH CHECK (consultor_id = auth.uid() AND created_by = auth.uid());

-- 3) Clientes: leitura restrita por perfil
DROP POLICY IF EXISTS "clientes leitura autenticado" ON public.clientes;
CREATE POLICY "clientes leitura por perfil"
ON public.clientes FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gestor'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.vendas v
    WHERE v.cliente_cnpj = clientes.cnpj_cpf
      AND (v.consultor_id = auth.uid() OR v.created_by = auth.uid())
  )
);

-- 4) Colaboradores: somente admin/gestor enxergam a tabela completa;
--    consultor enxerga apenas o proprio registro (vinculado por user_id)
DROP POLICY IF EXISTS "colab leitura" ON public.colaboradores;
CREATE POLICY "colab leitura por perfil"
ON public.colaboradores FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gestor'::app_role)
  OR user_id = auth.uid()
);
