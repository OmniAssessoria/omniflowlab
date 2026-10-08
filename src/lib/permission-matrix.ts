export type IndividualPermissionRole = "gestor" | "consultor";

export type PermissionItem = {
  key: string;
  label: string;
  gestor: boolean;
  consultor: boolean;
  description?: string;
  critical?: boolean;
  conditional?: boolean;
};

export type PermissionGroup = {
  id: string;
  label: string;
  items: PermissionItem[];
};

export type PermissionModule = {
  id: string;
  label: string;
  roles: IndividualPermissionRole[];
  groups: PermissionGroup[];
};

const p = (
  key: string,
  label: string,
  gestor: boolean,
  consultor: boolean,
  extra: Omit<PermissionItem, "key" | "label" | "gestor" | "consultor"> = {},
): PermissionItem => ({ key, label, gestor, consultor, ...extra });

export const PERMISSION_MODULES: PermissionModule[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    roles: ["gestor", "consultor"],
    groups: [{
      id: "acesso",
      label: "Acesso e visualização",
      items: [
        p("dashboard.acessar", "Acessar Dashboard", true, true),
        p("dashboard.ver_proprios_resultados", "Visualizar próprios resultados", true, true),
        p("dashboard.ver_proprias_vendas", "Visualizar próprias vendas", true, true),
        p("dashboard.ver_equipe", "Visualizar informações da equipe", true, false),
        p("dashboard.ver_todas_vendas", "Visualizar vendas de todos os consultores", true, false),
        p("dashboard.ver_resultados_consolidados", "Visualizar resultados consolidados", true, false),
        p("dashboard.ver_quantidade_vendas", "Visualizar quantidade de vendas", true, true),
        p("dashboard.ver_ativacoes", "Visualizar ativações", true, true),
        p("dashboard.ver_indicadores_funil", "Visualizar indicadores por funil", true, true),
        p("dashboard.ver_indicadores_operadora", "Visualizar indicadores por operadora", true, true),
        p("dashboard.ver_ranking", "Visualizar ranking de consultores", true, false),
        p("dashboard.ver_comparacao", "Visualizar comparação de resultados", true, false),
        p("dashboard.ver_receita", "Visualizar receita e indicadores financeiros", true, true, { description: "Somente quando o módulo financeiro estiver habilitado." }),
      ],
    }],
  },
  {
    id: "dashboard_gestor",
    label: "Dashboard Gestor",
    roles: ["gestor"],
    groups: [{
      id: "acesso",
      label: "Acesso, filtros e exportação",
      items: [
        p("dashboard_gestor.acessar", "Acessar a tela", true, false),
        p("dashboard_gestor.ver_todas_vendas", "Visualizar todas as vendas", true, false),
        p("dashboard_gestor.filtro_consultor", "Filtrar por Consultor", true, false),
        p("dashboard_gestor.filtro_tipo_pedido", "Filtrar por Tipo de Pedido", true, false),
        p("dashboard_gestor.filtro_recebimento", "Filtrar por Data de Recebimento", true, false),
        p("dashboard_gestor.filtro_aceite", "Filtrar por Data de Aceite", true, false),
        p("dashboard_gestor.limpar_filtros", "Limpar filtros", true, false),
        p("dashboard_gestor.atualizar", "Atualizar dados", true, false),
        p("dashboard_gestor.exportar_csv", "Exportar CSV", true, false),
        p("dashboard_gestor.exportar_xlsx", "Exportar XLSX", true, false),
      ],
    }],
  },
  {
    id: "acompanhamento",
    label: "Acompanhamento",
    roles: ["gestor"],
    groups: [{
      id: "acesso",
      label: "Acesso e indicadores",
      items: [
        p("acompanhamento.acessar", "Acessar a tela", true, false),
        p("acompanhamento.ver_todos_consultores", "Visualizar acompanhamento de todos os consultores", true, false),
        p("acompanhamento.ver_metas_individuais", "Visualizar metas individuais", true, false),
        p("acompanhamento.ver_metas_semanais", "Visualizar metas semanais", true, false),
        p("acompanhamento.ver_resultados_semanais", "Visualizar resultados semanais", true, false),
        p("acompanhamento.ver_enviados", "Visualizar quadro de enviados", true, false),
        p("acompanhamento.ver_assinados", "Visualizar quadro de assinados", true, false),
        p("acompanhamento.ver_indicadores", "Visualizar indicadores operacionais", true, false),
        p("acompanhamento.ver_regras_quadros", "Visualizar regras configuradas nos quadros", true, false),
        p("acompanhamento.ver_consolidado", "Visualizar resultados consolidados", true, false),
      ],
    }],
  },
  {
    id: "pipeline",
    label: "Pipeline",
    roles: ["gestor", "consultor"],
    groups: [
      {
        id: "acesso",
        label: "Acesso",
        items: [
          p("pipeline.acessar", "Acessar Pipeline", true, true),
          p("pipeline.ver_claro", "Visualizar CLARO", true, true),
          p("pipeline.ver_vivo", "Visualizar VIVO", true, true),
          p("pipeline.ver_pedidos_proprios", "Visualizar próprios pedidos", true, true),
          p("pipeline.ver_todos_pedidos", "Visualizar pedidos de todos os consultores", true, false),
          p("pipeline.criar_venda", "Criar Nova Venda", true, true),
          p("pipeline.abrir_pedido", "Abrir detalhes do pedido", true, true),
          p("pipeline.enviar_suporte", "Enviar pedido para Suporte", true, true),
        ],
      },
      {
        id: "filtros",
        label: "Filtros",
        items: [
          p("pipeline.filtro_status_comercial", "Filtrar Status Comercial", true, true),
          p("pipeline.filtro_status_pedido", "Filtrar Status do Pedido", true, true),
          p("pipeline.filtro_consultor", "Filtrar Consultor", true, false),
          p("pipeline.filtro_tipo_pedido", "Filtrar Tipo de Pedido", true, true),
          p("pipeline.filtro_produto", "Filtrar Produto", true, true),
          p("pipeline.filtro_sla", "Filtrar SLA", true, false),
          p("pipeline.limpar_filtros", "Limpar filtros", true, true),
        ],
      },
      {
        id: "movimentacao",
        label: "Movimentação",
        items: [
          p("pipeline.mover", "Usar botão Mover", true, true),
          p("pipeline.concluir", "Concluir pedido comercial", false, false, { critical: true }),
        ],
      },
      {
        id: "processos_bko",
        label: "Processos BKO",
        items: [
          p("pipeline.processos_bko.pendente_consultor", "Pendente Consultor", true, true),
          p("pipeline.processos_bko.apoio_gestao", "Apoio Gestão", true, true),
          p("pipeline.processos_bko.troca_carteira", "Troca de Carteira | Abertura de Caso", true, true),
          p("pipeline.processos_bko.montar_pedido", "Montar Pedido", true, true),
          p("pipeline.processos_bko.tratativa_suporte", "Tratativa de Suporte", true, false),
          p("pipeline.processos_bko.tempo_input", "Tempo para Input", true, false),
          p("pipeline.processos_bko.enviado_preenchimento", "Enviado para Preenchimento", true, false),
          p("pipeline.processos_bko.aguardando_assinatura", "Aguardando Assinatura", false, false, { conditional: true, description: "Etapa cadastrada, atualmente desativada. A permissão não ativa a etapa." }),
        ],
      },
      {
        id: "assinatura",
        label: "Assinatura",
        items: [
          p("pipeline.assinatura.aguardando", "Aguardando Assinatura", true, false),
          p("pipeline.assinatura.dia1", "Dia 1 - Assinatura", true, true),
          p("pipeline.assinatura.dia2", "Dia 2 - Assinatura", true, true),
          p("pipeline.assinatura.dia3", "Dia 3 - Assinatura", true, true),
          p("pipeline.assinatura.dia4", "Dia 4 - Assinatura", true, true),
          p("pipeline.assinatura.apoio", "Apoio Gestão", true, true),
          p("pipeline.assinatura.contrato_assinado", "Contrato Assinado", false, false),
          p("pipeline.assinatura.aguardando_reenvio", "Aguardando Reenvio", false, false, { conditional: true, description: "Etapa cadastrada, atualmente desativada." }),
          p("pipeline.assinatura.correcao_cadastral", "Correção Cadastral", false, false, { conditional: true, description: "Etapa cadastrada, atualmente desativada." }),
          p("pipeline.assinatura.ag_confirmar", "AG Confirmar Assinatura", false, false, { conditional: true, description: "Etapa cadastrada, atualmente desativada." }),
          p("pipeline.assinatura.aguardando_biometria", "Aguardando Biometria", false, false, { conditional: true, description: "Etapa cadastrada, atualmente desativada." }),
          p("pipeline.assinatura.aguardando_concluir_tt", "Aguardando Concluir TT", false, false, { conditional: true, description: "Etapa cadastrada, atualmente desativada." }),
        ],
      },
      {
        id: "suporte",
        label: "Suporte",
        items: [
          p("pipeline.suporte.ver_espera", "Visualizar Suportes em Espera", true, true),
          p("pipeline.suporte.ver_pre_vendas", "Visualizar Pre Vendas", true, true),
          p("pipeline.suporte.ver_devolutiva", "Visualizar Devolutiva do Consultor", true, true),
          p("pipeline.suporte.ver_tratativa", "Visualizar Tratativa OMNI/DATAVOXX", true, true),
          p("pipeline.suporte.ver_pendencia_comercial", "Visualizar Pendência Comercial", true, true),
          p("pipeline.suporte.ver_concluido", "Visualizar Concluído", true, true),
          p("pipeline.suporte.mover", "Mover cards operacionalmente entre etapas de Suporte", false, false),
          p("pipeline.suporte.resolver", "Resolver atendimento", false, false, { critical: true }),
          p("pipeline.suporte.reabrir", "Reabrir atendimento", false, false, { critical: true }),
          p("pipeline.suporte.prioridade", "Reclassificar prioridade", false, false),
        ],
      },
    ],
  },
  {
    id: "nova_venda",
    label: "Nova Venda",
    roles: ["gestor", "consultor"],
    groups: [
      {
        id: "operadora",
        label: "Operadora",
        items: [
          p("nova_venda.acessar", "Acessar Nova Venda", true, true),
          p("nova_venda.selecionar_claro", "Selecionar CLARO", true, true),
          p("nova_venda.selecionar_vivo", "Selecionar VIVO", true, true),
        ],
      },
      {
        id: "cliente",
        label: "Cliente",
        items: [
          p("nova_venda.buscar_cliente", "Buscar cliente existente", true, true),
          p("nova_venda.selecionar_cliente", "Selecionar cliente existente", true, true),
          p("nova_venda.criar_cliente", "Cadastrar nova empresa", true, true),
          p("nova_venda.cliente.razao_social", "Informar Razão Social", true, true),
          p("nova_venda.cliente.documento", "Informar CNPJ/CPF", true, true),
          p("nova_venda.cliente.contato", "Informar Contato", true, true),
          p("nova_venda.cliente.ddd", "Informar DDD", true, true),
          p("nova_venda.cliente.telefone", "Informar Telefone", true, true),
          p("nova_venda.cliente.email", "Informar E-mail", true, true),
          p("nova_venda.cliente.uf", "Selecionar UF", true, true),
        ],
      },
      {
        id: "responsavel",
        label: "Responsável",
        items: [
          p("nova_venda.selecionar_consultor", "Selecionar Consultor responsável", true, false),
          p("nova_venda.criar_para_outro_usuario", "Criar venda para outro usuário", true, false),
        ],
      },
      {
        id: "tipos_pedido",
        label: "Tipos de Pedido",
        items: [
          p("nova_venda.tipos_pedido", "Selecionar Tipos de Pedido disponíveis", true, true),
        ],
      },
      {
        id: "produtos",
        label: "Produtos",
        items: [
          p("nova_venda.produtos", "Selecionar Produtos disponíveis", true, true),
        ],
      },
      {
        id: "cedentes",
        label: "Cedentes / Cessionários",
        items: [
          p("nova_venda.gerenciar_cedentes", "Gerenciar Cedentes/Cessionários", false, true),
          p("nova_venda.cedentes.visualizar", "Visualizar existentes quando aplicável", false, true),
          p("nova_venda.cedentes.selecionar", "Selecionar um ou mais quando aplicável", false, true),
          p("nova_venda.cedentes.criar", "Criar novo quando aplicável", false, true),
          p("nova_venda.cedentes.vincular", "Vincular ao pedido", false, true),
        ],
      },
      {
        id: "representantes",
        label: "Representantes",
        items: [
          p("nova_venda.gerenciar_representantes", "Adicionar Representantes", true, true),
          p("nova_venda.representantes.negociante", "Marcar Representante Negociante", true, true),
          p("nova_venda.representantes.assinante", "Marcar Representante Assinante", true, true),
        ],
      },
    ],
  },
  {
    id: "pedido",
    label: "Pedido",
    roles: ["gestor", "consultor"],
    groups: [
      {
        id: "acesso",
        label: "Acesso",
        items: [
          p("pedido.acessar", "Acessar pedido", true, true),
          p("pedido.ver_proprio", "Visualizar próprio pedido", true, true),
          p("pedido.ver_outros", "Visualizar pedidos de outros usuários", true, false),
          p("pedido.ver_concluido", "Visualizar pedido concluído", true, true),
          p("pedido.ver_cancelado", "Visualizar pedido cancelado", true, true),
        ],
      },
      {
        id: "dados",
        label: "Dados do Pedido",
        items: [
          p("pedido.editar_dados", "Abrir Editar Pedido / editar dados permitidos", true, false),
          p("pedido.editar_numero", "Editar número do pedido", true, false),
          p("pedido.editar_operadora", "Editar Operadora pelo modal", false, false),
          p("pedido.editar_consultor", "Alterar Consultor responsável", true, false),
          p("pedido.editar_status", "Alterar Status administrativo", false, false),
          p("pedido.editar_tipo_pedido", "Editar Tipo de Pedido", true, false),
          p("pedido.editar_produtos", "Editar Produtos", true, false),
          p("pedido.editar_quantidade", "Editar Quantidade", true, false),
          p("pedido.editar_valor", "Editar Receita / Valor", true, false),
          p("pedido.editar_contato", "Editar Contato", true, false),
          p("pedido.editar_telefone", "Editar Telefone", true, false),
          p("pedido.editar_email", "Editar E-mail", true, false),
          p("pedido.editar_uf", "Editar UF", true, false),
        ],
      },
      {
        id: "datas",
        label: "Datas",
        items: [
          p("pedido.datas.visualizar", "Visualizar Datas", true, true),
          p("pedido.datas.editar", "Editar datas operacionais protegidas", false, false),
          p("pedido.data_recebimento.editar", "Editar Data de Recebimento", false, false),
          p("pedido.data_preenchimento.editar", "Editar Data de Preenchimento", false, false),
          p("pedido.data_envio.editar", "Editar Data de Envio", false, false),
          p("pedido.data_aceite.editar", "Editar Data de Aceite", false, false),
          p("pedido.data_input.editar", "Editar Data de Input", false, false),
          p("pedido.data_ativacao.editar", "Editar Data de Ativação", false, false),
          p("pedido.data_portabilidade.editar", "Editar Data de Portabilidade", false, false),
          p("pedido.data_entrega.editar", "Editar Data de Entrega", false, false),
        ],
      },
      {
        id: "biometria",
        label: "Biometria",
        items: [
          p("pedido.biometria.visualizar", "Visualizar Biometria", true, true),
          p("pedido.biometria.editar_status", "Alterar Status de Biometria", false, false),
        ],
      },
      {
        id: "linhas",
        label: "Linhas",
        items: [
          p("pedido.linhas.visualizar", "Visualizar Linhas", true, true),
          p("pedido.linhas.adicionar", "Adicionar Linhas", true, true),
          p("pedido.linhas.editar", "Editar Linhas", true, true),
          p("pedido.linhas.excluir", "Excluir Linhas", true, true, { critical: true }),
          p("pedido.linhas.ddd", "Editar DDD quando aplicável", true, true),
          p("pedido.linhas.numero", "Editar Número quando aplicável", true, true),
          p("pedido.linhas.plano", "Selecionar Plano", true, true),
          p("pedido.linhas.valor", "Editar Valor", true, true),
          p("pedido.linhas.passaporte", "Selecionar Passaporte quando permitido", true, true),
          p("pedido.linhas.operadora_doadora", "Informar Operadora Doadora quando aplicável", true, true),
          p("pedido.linhas.cedente", "Informar Cedente/Cessionário quando aplicável", true, true),
          p("pedido.linhas.descricao", "Preencher campos específicos / descrição", true, true),
          p("pedido.linhas.aparelho", "Preencher dados de aparelho", true, true),
        ],
      },
      {
        id: "planos",
        label: "Planos",
        items: [
          p("pedido.planos.visualizar", "Visualizar Planos", true, true),
          p("pedido.planos.selecionar", "Selecionar Planos", true, true),
          p("pedido.planos.gerenciar", "Gerenciar Planos", true, false),
        ],
      },
      {
        id: "catalogos",
        label: "Catálogos",
        items: [
          p("pedido.catalogos.visualizar", "Visualizar Catálogos", true, true),
          p("pedido.catalogos.gerenciar", "Gerenciar Catálogos administrativos", false, false),
        ],
      },
      {
        id: "cedentes",
        label: "Cedentes / Cessionários",
        items: [
          p("pedido.cedentes.visualizar", "Visualizar Cedentes/Cessionários", true, true),
          p("pedido.cedentes.criar", "Criar Cedentes/Cessionários", true, true),
          p("pedido.cedentes.editar", "Editar Cedentes/Cessionários", true, true),
          p("pedido.cedentes.vincular", "Vincular ao pedido/linha", true, true),
          p("pedido.cedentes.remover_vinculo", "Remover vínculo", true, true),
          p("pedido.cedentes.multiplos", "Vincular múltiplos", true, true),
          p("pedido.cedentes.vinculo_em_massa", "Vincular em massa nas linhas", true, true),
        ],
      },
      {
        id: "representantes",
        label: "Representantes",
        items: [
          p("pedido.representantes.visualizar", "Visualizar Representantes", true, true),
          p("pedido.representantes.criar", "Adicionar Representantes", true, true),
          p("pedido.representantes.editar", "Editar Representantes", true, true),
          p("pedido.representantes.remover", "Remover Representantes", true, true),
          p("pedido.representantes.negociante", "Definir Negociante", true, true),
          p("pedido.representantes.assinante", "Definir Assinante", true, true),
        ],
      },
      {
        id: "documentos",
        label: "Documentos",
        items: [
          p("pedido.documentos.visualizar", "Visualizar Documentos", true, true),
          p("pedido.documentos.enviar", "Enviar Documentos", true, true),
          p("pedido.documentos.baixar", "Baixar Documentos", true, true),
          p("pedido.documentos.excluir", "Excluir Documentos", true, false, { critical: true }),
        ],
      },
      {
        id: "observacoes",
        label: "Observações",
        items: [
          p("pedido.observacoes.visualizar", "Visualizar Observações", true, true),
          p("pedido.observacoes.criar", "Criar Observações", true, true),
          p("pedido.observacoes.editar", "Editar Observações permitidas", true, true),
          p("pedido.observacoes.anexar_imagem", "Anexar imagem", true, true),
        ],
      },
      {
        id: "notas",
        label: "Notas",
        items: [
          p("pedido.notas.visualizar", "Visualizar Notas da Assinatura", true, true),
          p("pedido.notas.criar", "Adicionar Notas permitidas", true, true),
          p("pedido.notas.editar", "Editar Notas permitidas", true, true),
        ],
      },
      {
        id: "historico",
        label: "Histórico",
        items: [
          p("pedido.historico.visualizar", "Visualizar Histórico", true, true),
          p("pedido.historico.ver_autor", "Visualizar autor", true, true),
          p("pedido.historico.ver_alteracoes", "Visualizar alterações", true, true),
        ],
      },
      {
        id: "nota_pdf",
        label: "Nota PDF",
        items: [
          p("pedido.nota_pdf.visualizar", "Visualizar Nota PDF", true, true),
          p("pedido.nota_pdf.gerar", "Gerar Nota PDF", true, true),
          p("pedido.nota_pdf.baixar", "Baixar Nota PDF", true, true),
        ],
      },
      {
        id: "acoes_criticas",
        label: "Ações Críticas",
        items: [
          p("pedido.trocar_operadora", "Trocar Operadora", false, false, { critical: true, description: "Essa permissão representa uma ação administrativa crítica." }),
          p("pedido.cancelar", "Cancelar Atendimento", false, false, { critical: true }),
          p("pedido.concluir", "Concluir Pedido", false, false, { critical: true }),
          p("pedido.finalizar_cancelado", "Finalizar Pedido Cancelado", false, false, { critical: true }),
          p("pedido.excluir", "Excluir Pedido", true, false, { critical: true, description: "Essa permissão permite excluir pedidos." }),
          p("pedido.reabrir", "Reabrir Pedido", false, false, { critical: true }),
          p("pedido.alterar_consultor", "Alterar Consultor responsável", true, false, { critical: true }),
          p("pedido.excluir_cliente", "Excluir Cliente", true, false, { critical: true, description: "Essa permissão permite excluir clientes/empresas." }),
        ],
      },
    ],
  },
  {
    id: "meus_pedidos",
    label: "Meus Pedidos",
    roles: ["gestor", "consultor"],
    groups: [
      {
        id: "acesso",
        label: "Acesso",
        items: [
          p("meus_pedidos.acessar", "Acessar Meus Pedidos", true, true),
          p("meus_pedidos.ver_proprios", "Visualizar próprios pedidos", true, true),
          p("meus_pedidos.ver_todos", "Visualizar todos os pedidos", true, false),
          p("meus_pedidos.abrir", "Abrir pedido", true, true),
          p("meus_pedidos.excluir", "Excluir Pedido", true, false, { critical: true }),
          p("meus_pedidos.exportar", "Exportar base", false, false),
        ],
      },
      {
        id: "filtros",
        label: "Filtros",
        items: [
          p("meus_pedidos.filtro_operadora", "Filtrar Operadora", true, true),
          p("meus_pedidos.filtro_consultor", "Filtrar Consultor", true, false),
          p("meus_pedidos.filtro_bko", "Filtrar BKO", true, false),
          p("meus_pedidos.filtro_tipo_pedido", "Filtrar Tipo de Pedido", true, true),
          p("meus_pedidos.filtro_status", "Filtrar Status", true, true),
          p("meus_pedidos.filtro_biometria", "Filtrar Biometria", true, true),
          p("meus_pedidos.filtro_mes", "Filtrar Mês", true, true),
          p("meus_pedidos.filtro_ano", "Filtrar Ano", true, true),
          p("meus_pedidos.filtro_sla", "Filtrar SLA", false, true),
        ],
      },
    ],
  },
  {
    id: "clientes",
    label: "Clientes",
    roles: ["gestor"],
    groups: [{
      id: "acesso",
      label: "Acesso e gestão",
      items: [
        p("clientes.visualizar", "Visualizar Clientes", true, false),
        p("clientes.ver_proprios", "Visualizar próprios clientes", true, false),
        p("clientes.ver_todos", "Visualizar todos os clientes", true, false),
        p("clientes.criar", "Criar Cliente", true, false),
        p("clientes.editar", "Editar informações permitidas", true, false),
        p("clientes.excluir", "Excluir Cliente", true, false, { critical: true }),
      ],
    }],
  },
  {
    id: "closer",
    label: "Operação Closer",
    roles: ["gestor", "consultor"],
    groups: [
      {
        id: "acesso",
        label: "Acesso",
        items: [
          p("closer.acessar", "Acessar Operação Closer", true, true),
          p("closer.ver_proprios", "Visualizar próprios pedidos", true, true),
          p("closer.ver_todos", "Visualizar todos os pedidos", true, false),
          p("closer.criar", "Criar pedido", true, true),
          p("closer.criar_onvox", "Criar ONVOX", true, true),
          p("closer.criar_take", "Criar Take Flow", true, true),
          p("closer.criar_cliente", "Criar Cliente", true, true),
          p("closer.selecionar_responsavel", "Selecionar/filtrar Responsável", true, false),
          p("closer.criar_para_outro_usuario", "Criar para outro Consultor/Closer", true, false),
          p("closer.editar", "Editar informações permitidas", true, true),
        ],
      },
      {
        id: "documentos_historico",
        label: "Documentos, Histórico e Tags",
        items: [
          p("closer.documentos.visualizar", "Visualizar documentos", true, true),
          p("closer.documentos.enviar", "Enviar documentos", true, true),
          p("closer.historico", "Visualizar histórico", true, true),
          p("closer.tags", "Trabalhar com tags permitidas", true, true),
          p("closer.gerenciar_opcoes", "Gerenciar catálogo de opções", false, false),
          p("closer.excluir", "Excluir pedido administrativamente", false, false, { critical: true }),
        ],
      },
    ],
  },
  {
    id: "suporte",
    label: "Suporte",
    roles: ["gestor", "consultor"],
    groups: [
      {
        id: "visualizacao",
        label: "Visualização",
        items: [
          p("suporte.acessar", "Acessar Suporte / Meus Chamados", true, true),
          p("suporte.ver_proprios", "Visualizar próprios atendimentos", true, true),
          p("suporte.ver_todos", "Visualizar todos os chamados", true, false),
          p("suporte.pesquisar", "Pesquisar", true, true),
          p("suporte.ver_mensagens", "Visualizar mensagens", true, true),
          p("suporte.ver_historico", "Visualizar histórico", true, true),
          p("suporte.ver_prioridade", "Visualizar prioridade", true, true),
          p("suporte.ver_responsavel", "Visualizar responsável", true, true),
          p("suporte.ver_etapa", "Visualizar etapa", true, true),
          p("suporte.ver_legados", "Visualizar chamados legados relacionados", true, true),
        ],
      },
      {
        id: "filtros",
        label: "Filtros",
        items: [
          p("suporte.filtro_todos", "Filtro Todos", true, true),
          p("suporte.filtro_aguardando", "Filtro Aguardando criação", true, true),
          p("suporte.filtro_atendimento", "Filtro Em atendimento", true, true),
          p("suporte.filtro_concluidos", "Filtro Concluídos", true, true),
          p("suporte.filtro_nao_lidas", "Filtro Não lidas", true, true),
        ],
      },
      {
        id: "solicitacao",
        label: "Solicitação",
        items: [
          p("suporte.criar", "Criar solicitação a partir do Pedido", true, true),
          p("suporte.criar_avulso", "Criar novo Suporte avulso pela Central", true, false),
        ],
      },
      {
        id: "mensagens",
        label: "Mensagens",
        items: [
          p("suporte.enviar_mensagem", "Enviar mensagens no atendimento permitido", true, true),
        ],
      },
      {
        id: "operacao",
        label: "Operação",
        items: [
          p("suporte.criar_card", "Criar Card de Atendimento", false, false),
          p("suporte.alterar_prioridade", "Alterar Prioridade", false, false),
          p("suporte.resolver", "Resolver Solicitação", false, false, { critical: true }),
          p("suporte.reabrir", "Reabrir Solicitação", false, false, { critical: true }),
          p("suporte.excluir", "Excluir Suporte Avulso", false, false, { critical: true }),
        ],
      },
    ],
  },
  {
    id: "comissoes",
    label: "Comissões",
    roles: ["gestor", "consultor"],
    groups: [
      {
        id: "visualizacao",
        label: "Visualização",
        items: [
          p("comissoes.acessar", "Acessar Comissões", true, true),
          p("comissoes.ver_proprias", "Visualizar próprias comissões", true, true),
          p("comissoes.ver_todas", "Visualizar comissões da equipe", true, false),
          p("comissoes.ver_valores", "Visualizar valores", true, true),
          p("comissoes.ver_metas", "Visualizar Metas", true, true),
        ],
      },
      {
        id: "gestao",
        label: "Gestão",
        items: [
          p("comissoes.criar_meta", "Criar Meta", true, false),
          p("comissoes.editar_meta", "Editar Meta", true, false),
          p("comissoes.remover_meta", "Remover Meta", true, false),
          p("comissoes.confirmar", "Confirmar Comissão", true, false),
          p("comissoes.cancelar", "Cancelar Comissão", true, false),
          p("comissoes.fechar_periodo", "Administrar fechamento", false, false, { critical: true }),
          p("comissoes.excluir", "Executar exclusões administrativas", false, false, { critical: true }),
        ],
      },
    ],
  },
  {
    id: "equipe",
    label: "Equipe",
    roles: ["gestor"],
    groups: [{
      id: "acesso",
      label: "Acesso e indicadores",
      items: [
        p("equipe.acessar", "Acessar Equipe", true, false),
        p("equipe.visualizar", "Visualizar colaboradores", true, false),
        p("equipe.pesquisar", "Pesquisar colaborador", true, false),
        p("equipe.filtro_funcao", "Filtrar por Função", true, false),
        p("equipe.filtro_operadora", "Filtrar por Operadora", true, false),
        p("equipe.ver_indicadores", "Visualizar indicadores", true, false),
        p("equipe.ver_receita", "Visualizar Receita", true, false),
        p("equipe.excluir_usuario", "Excluir colaborador", false, false, { critical: true }),
        p("equipe.permissoes.visualizar", "Visualizar configuração de permissões", false, false),
        p("equipe.permissoes.editar", "Editar configuração de permissões", false, false),
      ],
    }],
  },
  {
    id: "relatorios",
    label: "Relatórios",
    roles: ["gestor"],
    groups: [{
      id: "acesso",
      label: "Relatórios e exportações",
      items: [
        p("relatorios.acessar", "Acessar Relatórios", true, false),
        p("relatorios.consultores", "Desempenho dos Consultores", true, false),
        p("relatorios.pipeline", "Pipeline", true, false),
        p("relatorios.sla", "SLA", true, false),
        p("relatorios.closer", "Operação Closer", true, false),
        p("relatorios.comissoes", "Comissões", true, false),
        p("relatorios.comparativos", "Comparativos", true, false),
        p("relatorios.filtro_ano", "Selecionar Ano", true, false),
        p("relatorios.filtro_mes", "Selecionar Mês", true, false),
        p("relatorios.pesquisar", "Pesquisar na tabela", true, false),
        p("relatorios.detalhar_consultor", "Abrir detalhamento de Consultor", true, false),
        p("relatorios.detalhar_closer", "Abrir detalhamento de Closer", true, false),
        p("relatorios.exportar_csv", "Exportar CSV", true, false),
        p("relatorios.exportar_pdf", "Exportar PDF", true, false),
      ],
    }],
  },
  {
    id: "notificacoes",
    label: "Notificações",
    roles: ["gestor", "consultor"],
    groups: [{
      id: "acesso",
      label: "Acesso e leitura",
      items: [
        p("notificacoes.acessar", "Acessar Notificações", true, true),
        p("notificacoes.ver_proprias", "Visualizar notificações próprias/pertinentes", true, true),
        p("notificacoes.ver_equipe", "Visualizar notificações da equipe", true, false),
        p("notificacoes.ver_detalhe", "Abrir detalhe", true, true),
        p("notificacoes.marcar_lida", "Marcar como lida", true, true),
        p("notificacoes.marcar_todas_lidas", "Marcar todas como lidas", true, true),
      ],
    }],
  },
];

export function modulesForRole(role: IndividualPermissionRole) {
  return PERMISSION_MODULES.filter(module => module.roles.includes(role));
}

export function defaultPermissionState(role: IndividualPermissionRole): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  for (const module of modulesForRole(role)) {
    for (const group of module.groups) {
      for (const item of group.items) result[item.key] = item[role];
    }
  }
  return result;
}

export function allPermissionKeys(role: IndividualPermissionRole): string[] {
  return Object.keys(defaultPermissionState(role));
}
