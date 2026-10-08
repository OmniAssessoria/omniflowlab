# Auditoria Funcional do Upgrade Operacional — 16/09/2026

## Critério

Esta auditoria não considera um requisito concluído apenas porque existe código. A classificação usa evidência de frontend, backend/banco e, quando disponível, validação manual real.

Legenda:
- **FUNCIONAL** — frontend ligado + regra/fonte backend presente.
- **FUNCIONAL / VALIDADO MANUALMENTE** — além da implementação, houve teste real na interface.
- **CORRIGIDO NO PR #19** — problema encontrado durante validação e corrigido na branch atual; ainda depende de merge para aparecer no Lovable/main.
- **ATENÇÃO HISTÓRICA** — regra atual está correta, mas existe dado antigo criado antes da proteção.

## 22 requisitos originais

| # | Requisito | Estado | Evidência / observação |
|---|---|---|---|
| 1 | Bônus VIVO por linha | **FUNCIONAL / VALIDADO MANUALMENTE** | `LinhaOperationalExtras` exibe bônus somente para VIVO. `BonusVivoSelect` grava `possui_bonus`/`bonus_gb`. Usuário confirmou em teste real que a parte de bônus estava correta. |
| 2 | Restrição do Consultor em Processos BKO | **FUNCIONAL** | Frontend: `src/lib/pipeline-movement.ts` limita Consultor a `bko-pendente`, `bko-apoio`, `bko-troca`. Backend: `pipeline_move_venda` contém as mesmas três etapas. |
| 3 | Biometria: Pendente amarelo, Cancelada vermelho, Concluída verde | **FUNCIONAL** | `src/components/pedido-header-meta.tsx` define tons warning/destructive/success e persiste pela venda. `Clientes/Pedidos` usa a mesma semântica. |
| 4 | Pedido concluído não reabre | **FUNCIONAL** | `pipeline_concluir_venda` existe; não há RPC de reabertura de venda. `omni-store` remove concluídos do Pipeline ativo. |
| 5 | Após conclusão: Consultor/Gestor somente leitura; BKO/Admin operam | **FUNCIONAL** | `src/routes/_shell.vendas.$id.tsx` calcula `podeEditar` com BKO/Admin liberados e Consultor/Gestor bloqueados quando `concluidoEm` existe. Guardas do banco protegem alterações operacionais. |
| 6 | Remover antigo Status do Pedido | **CORRIGIDO NO PR #19** | O bloco antigo já não aparece na ficha do pedido, porém a listagem `Clientes/Pedidos` ainda exibia `vendas.status` e `status_pedido`. PR #19 remove `Status` e `Resultado` da visão operacional. |
| 7 | Observação em cada Status Comercial | **FUNCIONAL** | `StatusComercialPedido` mantém histórico e RPC `atualizar_observacao_status_comercial`. Após ajuste #17, observação é inserida depois do status e salva com Enter, com autor/data/perfil. |
| 8 | MV - ATIVADO 100% + selo verde | **FUNCIONAL + ATENÇÃO HISTÓRICA** | `PedidoHeaderMeta` renderiza selo verde quando `ativado_100_em` existe. Trigger atual valida regras. Foi encontrado 1 registro histórico inválido antigo, criado antes da proteção; ele foi preservado como auditoria. |
| 9 | Concluído e Ativado 100% independentes | **FUNCIONAL** | Conclusão é controlada por `pipeline_concluir_venda`; Ativado 100% é controlado pelo Status Comercial e snapshot `ativado_100_em`. Um fluxo não chama o outro. |
| 10 | Sete datas obrigatórias para Ativado 100% | **FUNCIONAL NO BACKEND + CORRIGIDO NO PR #19** | Trigger `prepare_status_comercial_historico` já rejeita ausência de Recebimento, Preenchimento, Aceite, Input, Ativação, Portabilidade e Entrega. Teste direto no pedido OMN-9015898 foi bloqueado corretamente. PR #19 adiciona preflight no frontend com lista das datas faltantes. |
| 11 | Admin com permissões operacionais de BKO | **FUNCIONAL** | Fluxos de Status Comercial, datas, suporte e ações operacionais tratam `admin || bko`. Backend/RPCs também validam ambos onde aplicável. |
| 12 | Doadores por linha nos quatro tipos definidos | **FUNCIONAL** | `LinhaOperationalExtras` contém exatamente os quatro tipos aprovados e permite múltiplos registros em `venda_linha_doadores`, com nome/e-mail/telefone/operadora. Operadora passou a texto livre no ajuste #18. |
| 13 | Novo Suporte sem venda vinculada | **FUNCIONAL / VALIDADO VISUALMENTE** | `NovoSuporteDialog` cria atendimento sem venda usando `createStandaloneSupport`; RPC `criar_suporte_avulso` existe. Tela foi aberta durante validação real. |
| 14 | Assumir atendimento sem exclusividade | **FUNCIONAL** | `SupportOperationalPanel` expõe “Assumir atendimento” para BKO/Admin e informa explicitamente que demais BKOs mantêm acesso. RPC `assumir_atendimento_suporte` existe. |
| 15 | Chat, informações e documentos separados; docs privados até 100 MB | **FUNCIONAL** | `SupportOperationalPanel` possui “Informações do atendimento” e “Documentos do atendimento” separados. Tabelas `suporte_informacoes`/`suporte_documentos` existem. Bucket `suporte-documentos` é privado e tem limite 104857600 bytes. |
| 16 | Status Comercial por operadora sem duplicar catálogo | **FUNCIONAL** | `status_comercial_catalogo` possui 89 status ativos; aplicabilidade fica em `status_comercial_operadoras`. Estado atual: 87 CLARO e 54 VIVO. |
| 17 | SLA por Status Comercial + Operadora, permitindo Sem SLA | **FUNCIONAL** | `status_comercial_operadoras.sla_horas` é por relação status/operadora e aceita null. Histórico congela snapshot de SLA por troca. |
| 18 | Configurações > SLA: CLARO/VIVO/Ambas, busca, Sem SLA, ativar/desativar | **FUNCIONAL** | `StatusComercialSlaConfig` possui as três abas, pesquisa, switches de aplicabilidade e campo vazio = Sem SLA. Correção posterior garante que status desativado continue visível nas abas CLARO/VIVO para reativação. |
| 19 | Semáforo SLA verde/laranja/vermelho/neutro e reinício por status | **FUNCIONAL** | `getSlaState` possui testes de <50%, 50–100%, >100% e sem SLA. Cada inserção em histórico gera novos `sla_inicio_em`, `sla_metade_em` e `sla_limite_em`. |
| 20 | Indicador SLA sempre visível no card do Pipeline | **FUNCIONAL** | `CommercialCard` calcula `slaVisual` e sempre cria `slaDot`, incluindo estado neutro Sem SLA. |
| 21 | Clientes/Pedidos mostrar Operadora, Status Comercial e SLA | **CORRIGIDO NO PR #19** | A versão anterior misturava dados novos com campos legados. PR #19 coloca SLA como primeira coluna, Status Comercial logo após Operadora e remove Tipo/Produto/Status/Resultado baseados em fontes antigas. |
| 22 | Filtro SLA para BKO/Admin: Verde/Laranja/Vermelho/Sem SLA | **FUNCIONAL** | `canFilterSla = admin || bko`; query aplica limites de SLA e combina com os demais filtros. PR #19 apenas move o filtro para posição mais evidente. |

## Ajustes posteriores já aprovados

| Ajuste | Estado | Evidência |
|---|---|---|
| Catálogo gerenciável de bônus VIVO | **FUNCIONAL** | `BonusVivoSelect` permite BKO/Admin adicionar, editar e excluir opções em `bonus_vivo_catalogo`; linhas antigas preservam o valor gravado. |
| Observação somente depois da troca de Status Comercial | **FUNCIONAL** | Campo saiu do modal de troca e aparece no cartão do status ativo; Enter salva via RPC. |
| Operadora do doador como texto livre | **FUNCIONAL** | `Doador.operadora` é string; UI usa `Input`; banco foi convertido para `text` com proteção contra vazio. |
| Máscara automática de CNPJ no Novo Suporte | **FUNCIONAL** | `formatCnpjInput`, `isCompleteCnpj`, `maxLength=18`; exige 14 dígitos antes de criar. |

## Problemas descobertos na validação real e tratados no PR #19

### Totais da venda derivados das linhas
**Problema confirmado:** OMN-9015898 possuía 1 linha de R$ 500,00 em `venda_linhas`, mas `vendas.quantidade_linhas=0` e `vendas.valor=0`.

**Causa:** o trigger existente recalculava totais do cliente, mas não atualizava o resumo da própria venda.

**Correção:** migration `20260917024500_recalc_venda_totais_from_linhas.sql` cria rollup central após INSERT/UPDATE/DELETE e faz backfill. Após aplicação, OMN-9015898 passou para **1 linha / R$ 500,00** e os totais do cliente voltaram a coincidir com a soma das vendas.

### ATIVADO 100%
A proteção backend atual foi testada diretamente e rejeitou OMN-9015898 com as seis datas faltantes. O PR #19 adiciona também validação prévia no frontend para não depender da tentativa de insert para avisar o usuário.

### Clientes/Pedidos
A tabela antiga misturava `vendas.status`, `status_pedido`, `tipo_pedido` e `produto` com o modelo operacional novo. O PR #19 remove essas fontes da visão principal, reduz rolagem horizontal e coloca SLA como primeira informação operacional.

## Resultado da auditoria

- **18/22** requisitos originais já estavam funcionalmente ligados antes desta rodada.
- **4/22** exigiam atenção encontrada pela validação real: #6, #8, #10 e #21.
  - #8 tinha apenas um dado histórico inválido antigo; a regra atual funciona.
  - #10 já estava correta no backend e recebeu preflight no PR #19.
  - #6 e #21 tinham resíduos visuais de campos legados em Clientes/Pedidos e foram corrigidos no PR #19.
- Um bug transversal não listado nos 22 requisitos foi confirmado e corrigido: **totais da venda não acompanhavam as linhas**.

## Estado de integração

- Migration de rollup já aplicada e validada no Supabase.
- Código/UI do PR #19 está em branch isolada e deve permanecer sem merge até aprovação explícita.
- Antes do merge: exigir contratos, testes e build verdes no HEAD final e revisar diff para garantir ausência de arquivos temporários.
