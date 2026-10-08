import { describe, expect, test } from "bun:test";\nimport ts from "typescript";

describe("detalhe do pedido TAKE", () => {
  test("usa cabeçalho compacto com responsáveis e menu de ações", async () => {
    const source = await Bun.file(new URL("./_shell.operacao-closer.$id.tsx", import.meta.url)).text();

    expect(source).toContain('pedido.produto === "TAKE_FLOW" ? (');
    expect(source).toContain('className="relative z-10 flex flex-wrap items-center justify-between gap-2"');
    expect(source).toContain("Closer:");
    expect(source).toContain("BKO:");
    expect(source).toContain("DropdownMenuTrigger asChild");
  });

  test("separa o TAKE em abas sem voltar a exibir o histórico antigo", async () => {
    const source = await Bun.file(new URL("./_shell.operacao-closer.$id.tsx", import.meta.url)).text();

    expect(source).toContain('<TabsTrigger value="resumo">Resumo</TabsTrigger>');
    expect(source).toContain('<TabsTrigger value="cliente">Cliente</TabsTrigger>');
    expect(source).toContain('<TabsTrigger value="itens">Produtos / Itens</TabsTrigger>');
    expect(source).toContain('<TabsTrigger value="chat">Chat</TabsTrigger>');
    expect(source).toContain('<TabsTrigger value="arquivos">Arquivos</TabsTrigger>');
    expect(source).toContain("ONVOX_SEM_HISTORICO");
  });

  test("organiza cliente representante e gestor técnico", async () => {
    const source = await Bun.file(new URL("./_shell.operacao-closer.$id.tsx", import.meta.url)).text();

    expect(source).toContain("CLIENTE / REPRESENTANTE / GESTOR TÉCNICO");
    expect(source).toContain('InfoGroup title="Cliente"');
    expect(source).toContain('InfoGroup title="Representante Legal"');
    expect(source).toContain('InfoGroup title="Gestor Técnico"');
    expect(source).toContain('pedido.representante_legal_nome');
    expect(source).toContain('pedido.gestor_tecnico_email_faturas');
  });
});


describe("detalhe do pedido ONVOX", () => {
  test("usa navegação por abas própria", async () => {
    const source = await Bun.file(new URL("./_shell.operacao-closer.$id.tsx", import.meta.url)).text();

    expect(source).toContain('<TabsTrigger value="acompanhamento">Acompanhamento BKO</TabsTrigger>');
    expect(source).toContain('<TabsTrigger value="itens-onvox">Itens da operação</TabsTrigger>');
    expect(source).toContain('<TabsTrigger value="informacoes-onvox">Informações</TabsTrigger>');
    expect(source).toContain('<TabsTrigger value="arquivos-onvox">Arquivos</TabsTrigger>');
    expect(source).toContain('<TabsTrigger value="chat-onvox">Chat</TabsTrigger>');
  });

  test("usa topo compacto e edição completa ONVOX", async () => {
    const source = await Bun.file(new URL("./_shell.operacao-closer.$id.tsx", import.meta.url)).text();

    expect(source).toContain("ONVOX_HEADER_COMPACTO");
    expect(source).toContain("Editar pedido ONVOX");
    expect(source).toContain("onvoxEditItems");
    expect(source).toContain("saveOnvoxEdit");
  });

  test("informações ONVOX possuem edição individual", async () => {
    const source = await Bun.file(new URL("./_shell.operacao-closer.$id.tsx", import.meta.url)).text();

    expect(source).toContain("EditableInfoLine");
    expect(source).toContain("openOnvoxFieldEditor");
    expect(source).toContain("ONVOX_SEM_HISTORICO");
  });
});


describe("acompanhamento ONVOX com notas operacionais", () => {
  test("remove portabilidade e seletor de etapa do acompanhamento", async () => {
    const source = await Bun.file(new URL("./_shell.operacao-closer.$id.tsx", import.meta.url)).text();

    expect(source).not.toContain("Portabilidade ONVOX");
    expect(source).toContain("ONVOX_ACOMPANHAMENTO_GRID");
    expect(source).toContain("FLUXO OPERACIONAL");
    expect(source).toContain("DATAS DO ACOMPANHAMENTO");
  });

  test("usa painel de notas com tags imagem e histórico", async () => {
    const source = await Bun.file(new URL("./_shell.operacao-closer.$id.tsx", import.meta.url)).text();

    expect(source).toContain("<CloserOnvoxNotes");
    expect(source).toContain("pedidoId={pedido.id}");
  });

  test("limpa imagens das notas antes de excluir o pedido", async () => {
    const source = await Bun.file(new URL("./_shell.operacao-closer.$id.tsx", import.meta.url)).text();

    expect(source).toContain('from("closer_pedido_notas")');
    expect(source).toContain("imagem_storage_path");
  });

  test("chat mantém enviadas à direita e recebidas à esquerda para qualquer usuário", async () => {
    const source = await Bun.file(new URL("./_shell.operacao-closer.$id.tsx", import.meta.url)).text();

    expect(source).toContain('const mine = message.user_id === user?.id;');
    expect(source).toContain('mine ? "justify-end" : "justify-start"');
    expect(source).toContain("CHAT_ONVOX_BUBBLES");
  });
});


describe("itens ONVOX com DID e plano PABX", () => {
  test("exibe DDD e número dos itens ONVOX e totaliza receita", async () => {
    const source = await Bun.file(new URL("./_shell.operacao-closer.$id.tsx", import.meta.url)).text();

    expect(source).toContain(">DDD<");
    expect(source).toContain(">Número<");
    expect(source).toContain("RECEITA TOTAL");
    expect(source).toContain("onvox_plano_pabx");
  });

  test("arquivo de detalhe não contém quebra de linha escapada em import", async () => {
    const source = await Bun.file(new URL("./_shell.operacao-closer.$id.tsx", import.meta.url)).text();

    expect(source).not.toContain('";\\nimport');
  });
});


describe("cabeçalho compartilhado ONVOX e TAKE", () => {
  test("exibe a razão social centralizada e destacada no topo", async () => {
    const source = await Bun.file(new URL("./_shell.operacao-closer.$id.tsx", import.meta.url)).text();

    expect(source).toContain("CLOSER_CLIENTE_HEADER");
    expect(source).toContain("cliente?.razao_social");
    expect(source).toContain("absolute left-1/2");
    expect(source).toContain("-translate-x-1/2");
    expect(source).toContain("text-white");
  });

  test("mantém o arquivo TSX sintaticamente válido", async () => {
    const path = new URL("./_shell.operacao-closer.$id.tsx", import.meta.url);
    const source = await Bun.file(path).text();
    const sourceFile = ts.createSourceFile(
      path.pathname,
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );

    expect(sourceFile.parseDiagnostics).toHaveLength(0);
  });
});
