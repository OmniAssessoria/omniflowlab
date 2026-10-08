import { describe, expect, test } from "bun:test";

describe("detalhe TAKE organizado por abas", () => {
  test("usa as cinco abas principais", async () => {
    const source = await Bun.file(new URL("./_shell.operacao-closer.$id.tsx", import.meta.url)).text();

    expect(source).toContain('<TabsTrigger value="resumo">Resumo</TabsTrigger>');
    expect(source).toContain('<TabsTrigger value="cliente">Cliente</TabsTrigger>');
    expect(source).toContain('<TabsTrigger value="itens">Produtos / Itens</TabsTrigger>');
    expect(source).toContain('<TabsTrigger value="chat">Chat</TabsTrigger>');
    expect(source).toContain('<TabsTrigger value="arquivos">Arquivos</TabsTrigger>');
  });

  test("topo TAKE mostra somente closer bko e menu de ações", async () => {
    const source = await Bun.file(new URL("./_shell.operacao-closer.$id.tsx", import.meta.url)).text();

    expect(source).toContain('TAKE · Closer');
    expect(source).toContain('TAKE · BKO');
    expect(source).toContain('DropdownMenuTrigger asChild');
    expect(source).toContain('Editar pedido');
    expect(source).toContain('Excluir pedido');
  });

  test("resumo TAKE concentra datas e fluxo operacional", async () => {
    const source = await Bun.file(new URL("./_shell.operacao-closer.$id.tsx", import.meta.url)).text();

    expect(source).toContain('<TabsContent value="resumo"');
    expect(source).toContain('Acompanhamento BKO');
    expect(source).toContain('Data recebimento');
    expect(source).toContain('showDescription={false}');
  });

  test("chat TAKE aceita imagem colada e tem visualização ampla", async () => {
    const source = await Bun.file(new URL("./_shell.operacao-closer.$id.tsx", import.meta.url)).text();

    expect(source).toContain('onPaste={handleChatPaste}');
    expect(source).toContain('pendingChatImage');
    expect(source).toContain('imagem_storage_path');
    expect(source).toContain('min-h-[360px]');
  });

  test("arquivos ficam em aba própria com visualização", async () => {
    const source = await Bun.file(new URL("./_shell.operacao-closer.$id.tsx", import.meta.url)).text();

    expect(source).toContain('<TabsContent value="arquivos"');
    expect(source).toContain('previewDocument');
    expect(source).toContain('Pré-visualização do arquivo');
  });

  test("edição TAKE reutiliza o formulário completo do pedido", async () => {
    const source = await Bun.file(new URL("./_shell.operacao-closer.$id.tsx", import.meta.url)).text();

    expect(source).toContain('Editar pedido TAKE');
    expect(source).toContain('Tipo de API');
    expect(source).toContain('Linhas de conexão');
    expect(source).toContain('Representante Legal');
    expect(source).toContain('Gestor Técnico');
  });
});
