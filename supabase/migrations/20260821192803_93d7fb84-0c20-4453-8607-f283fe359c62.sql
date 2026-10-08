
-- Permissões básicas para venda_erros
GRANT SELECT, INSERT, UPDATE, DELETE ON public.venda_erros TO authenticated;
GRANT ALL ON public.venda_erros TO service_role;

-- Recriar policies para venda_erros para incluir o perfil 'bko'
DROP POLICY IF EXISTS venda_erros_insert ON public.venda_erros;
DROP POLICY IF EXISTS venda_erros_update ON public.venda_erros;
DROP POLICY IF EXISTS venda_erros_delete ON public.venda_erros;
DROP POLICY IF EXISTS venda_erros_read_all ON public.venda_erros;

-- SELECT: Todos autenticados podem ver os erros (regra de negócio filtra na UI se necessário)
CREATE POLICY "venda_erros_read_all" ON public.venda_erros
  FOR SELECT TO authenticated
  USING (true);

-- INSERT: Admin, Gestor e BKO podem inserir em qualquer venda. Consultor apenas nas próprias.
CREATE POLICY "venda_erros_insert" ON public.venda_erros
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'gestor') OR 
    public.has_role(auth.uid(), 'bko') OR
    EXISTS (SELECT 1 FROM public.vendas v WHERE v.id = venda_id AND v.consultor_id = auth.uid())
  );

-- UPDATE: Admin, Gestor e BKO podem atualizar qualquer erro. Consultor apenas nos próprios.
CREATE POLICY "venda_erros_update" ON public.venda_erros
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'gestor') OR 
    public.has_role(auth.uid(), 'bko') OR
    EXISTS (SELECT 1 FROM public.vendas v WHERE v.id = venda_id AND v.consultor_id = auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'gestor') OR 
    public.has_role(auth.uid(), 'bko') OR
    EXISTS (SELECT 1 FROM public.vendas v WHERE v.id = venda_id AND v.consultor_id = auth.uid())
  );

-- DELETE: Admin, Gestor e BKO podem excluir. Consultor apenas nos próprios.
CREATE POLICY "venda_erros_delete" ON public.venda_erros
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'gestor') OR 
    public.has_role(auth.uid(), 'bko') OR
    EXISTS (SELECT 1 FROM public.vendas v WHERE v.id = venda_id AND v.consultor_id = auth.uid())
  );
