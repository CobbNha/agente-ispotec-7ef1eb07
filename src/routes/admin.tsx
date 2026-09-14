import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { FileText, LogOut, ShieldCheck, Trash2, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Marca } from "@/components/ispotec/Marca";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Toaster } from "@/components/ui/sonner";
import {
  apagarDocumento,
  assumirAdministrador,
  estadoAdministrador,
  guardarDocumento,
  listarDocumentos,
  relatorioUso,
} from "@/lib/conhecimento.functions";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Administração — ISPOTEC AI" },
      {
        name: "description",
        content:
          "Área reservada: gestão da base de conhecimento do assistente institucional do ISPOTEC.",
      },
      { property: "og:title", content: "Administração — ISPOTEC AI" },
      {
        property: "og:description",
        content: "Gestão de documentos e configurações do assistente institucional do ISPOTEC.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Administracao,
});

async function extrairTexto(ficheiro: File): Promise<string> {
  const nome = ficheiro.name.toLowerCase();
  if (nome.endsWith(".pdf")) {
    const pdfjs = await import("pdfjs-dist");
    const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    const dados = new Uint8Array(await ficheiro.arrayBuffer());
    const documento = await pdfjs.getDocument({ data: dados }).promise;
    const paginas: string[] = [];
    for (let i = 1; i <= documento.numPages; i++) {
      const pagina = await documento.getPage(i);
      const conteudo = await pagina.getTextContent();
      paginas.push(
        conteudo.items
          .map((item) => ("str" in item ? item.str : ""))
          .join(" ")
          .replace(/\s+/g, " "),
      );
    }
    return paginas.join("\n\n");
  }
  return ficheiro.text();
}

function Autenticacao() {
  const [email, setEmail] = useState("");
  const [palavraPasse, setPalavraPasse] = useState("");
  const [modo, setModo] = useState<"entrar" | "criar">("entrar");
  const [aEnviar, setAEnviar] = useState(false);

  async function submeter(evento: React.FormEvent) {
    evento.preventDefault();
    setAEnviar(true);
    try {
      if (modo === "criar") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password: palavraPasse,
          options: { emailRedirectTo: `${window.location.origin}/admin` },
        });
        if (error) throw error;
        if (!data.session) {
          toast.success("Conta criada", {
            description: "Confirme o endereço de email através da mensagem que recebeu.",
          });
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password: palavraPasse,
        });
        if (error) throw error;
      }
    } catch (erro) {
      toast.error("Não foi possível continuar", {
        description: erro instanceof Error ? erro.message : "Verifique os dados introduzidos.",
      });
    } finally {
      setAEnviar(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-institucional px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <Marca tamanho={64} />
          <CardTitle>Administração ISPOTEC AI</CardTitle>
          <CardDescription>
            Área reservada à gestão da base de conhecimento.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submeter} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email institucional</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="palavra-passe">Palavra-passe</Label>
              <Input
                id="palavra-passe"
                type="password"
                required
                minLength={8}
                value={palavraPasse}
                onChange={(e) => setPalavraPasse(e.target.value)}
                autoComplete={modo === "criar" ? "new-password" : "current-password"}
              />
            </div>
            <Button type="submit" className="w-full" disabled={aEnviar}>
              {modo === "entrar" ? "Entrar" : "Criar conta de administrador"}
            </Button>
            <button
              type="button"
              onClick={() => setModo(modo === "entrar" ? "criar" : "entrar")}
              className="w-full text-center text-xs text-muted-foreground underline-offset-4 hover:underline"
            >
              {modo === "entrar"
                ? "Ainda não tenho conta de administrador"
                : "Já tenho conta — entrar"}
            </button>
            <Link
              to="/"
              className="block text-center text-xs text-muted-foreground underline-offset-4 hover:underline"
            >
              Voltar ao assistente
            </Link>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Administracao() {
  const [sessaoIniciada, setSessaoIniciada] = useState<boolean | null>(null);

  useEffect(() => {
    const { data: subscricao } = supabase.auth.onAuthStateChange((_evento, sessao) => {
      setSessaoIniciada(Boolean(sessao));
    });
    void supabase.auth.getSession().then(({ data }) => setSessaoIniciada(Boolean(data.session)));
    return () => subscricao.subscription.unsubscribe();
  }, []);

  if (sessaoIniciada === null) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        A carregar...
      </div>
    );
  }
  if (!sessaoIniciada) return <Autenticacao />;
  return <Painel />;
}

function Painel() {
  const clienteQuery = useQueryClient();
  const verEstado = useServerFn(estadoAdministrador);
  const assumir = useServerFn(assumirAdministrador);
  const verDocumentos = useServerFn(listarDocumentos);
  const verRelatorio = useServerFn(relatorioUso);
  const gravar = useServerFn(guardarDocumento);
  const remover = useServerFn(apagarDocumento);

  const estado = useQuery({ queryKey: ["estado-admin"], queryFn: () => verEstado() });
  const souAdmin = estado.data?.souAdmin === true;

  const documentos = useQuery({
    queryKey: ["documentos"],
    queryFn: () => verDocumentos(),
    enabled: souAdmin,
  });
  const relatorio = useQuery({
    queryKey: ["relatorio"],
    queryFn: () => verRelatorio(),
    enabled: souAdmin,
  });
  const categorias = useQuery({
    queryKey: ["categorias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categorias")
        .select("id, nome")
        .order("nome");
      if (error) throw new Error(error.message);
      return data;
    },
  });

  const [titulo, setTitulo] = useState("");
  const [categoriaId, setCategoriaId] = useState<string>("");
  const [acesso, setAcesso] = useState<"publico" | "interno">("publico");
  const [conteudo, setConteudo] = useState("");
  const [ficheiro, setFicheiro] = useState<File | null>(null);

  const assumirPapel = useMutation({
    mutationFn: () => assumir(),
    onSuccess: () => {
      toast.success("Já é administrador desta plataforma.");
      void clienteQuery.invalidateQueries();
    },
    onError: (erro: Error) => toast.error("Não foi possível", { description: erro.message }),
  });

  const enviarDocumento = useMutation({
    mutationFn: async () => {
      let texto = conteudo.trim();
      let caminho: string | null = null;
      if (ficheiro) {
        texto = (await extrairTexto(ficheiro)).trim();
        const nomeSeguro = `${crypto.randomUUID()}-${ficheiro.name.replace(/[^\w.\-]/g, "_")}`;
        const { error } = await supabase.storage
          .from("documentos")
          .upload(nomeSeguro, ficheiro, { upsert: false });
        if (error) throw new Error(error.message);
        caminho = nomeSeguro;
      }
      if (texto.length < 30) {
        throw new Error("Não foi possível ler texto suficiente. Cole o conteúdo manualmente.");
      }
      return gravar({
        data: {
          titulo: titulo.trim(),
          categoria_id: categoriaId || null,
          acesso,
          conteudo: texto,
          origem: ficheiro ? "ficheiro" : "texto",
          ficheiro_path: caminho,
        },
      });
    },
    onSuccess: (resultado) => {
      toast.success("Documento processado", {
        description: `${resultado.partes} partes disponíveis para o assistente.`,
      });
      setTitulo("");
      setConteudo("");
      setFicheiro(null);
      void clienteQuery.invalidateQueries({ queryKey: ["documentos"] });
      void clienteQuery.invalidateQueries({ queryKey: ["relatorio"] });
    },
    onError: (erro: Error) =>
      toast.error("Falha ao processar o documento", { description: erro.message }),
  });

  const apagar = useMutation({
    mutationFn: (id: string) => remover({ data: { id } }),
    onSuccess: () => {
      toast.success("Documento removido.");
      void clienteQuery.invalidateQueries({ queryKey: ["documentos"] });
    },
    onError: (erro: Error) => toast.error("Não foi possível remover", { description: erro.message }),
  });

  async function sair() {
    await clienteQuery.cancelQueries();
    clienteQuery.clear();
    await supabase.auth.signOut();
  }

  return (
    <div className="min-h-screen bg-background">
      <Toaster />
      <header className="bg-gradient-institucional text-primary-foreground">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-3 px-4 py-4">
          <Marca tamanho={44} />
          <div className="mr-auto">
            <h1 className="font-display text-lg font-semibold">Administração</h1>
            <p className="text-xs opacity-80">Base de conhecimento do ISPOTEC AI</p>
          </div>
          <Button asChild variant="ghost" className="hover:bg-white/15">
            <Link to="/">Ver assistente</Link>
          </Button>
          <Button variant="ghost" className="hover:bg-white/15" onClick={sair}>
            <LogOut className="mr-2 size-4" /> Sair
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
        {!souAdmin && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="size-5 text-gold" /> Acesso de administrador
              </CardTitle>
              <CardDescription>
                {estado.data?.existeAdmin
                  ? "Esta conta não tem permissões de administração. Solicite acesso ao administrador da plataforma."
                  : "Ainda não existe nenhum administrador. Pode assumir esse papel agora."}
              </CardDescription>
            </CardHeader>
            {!estado.data?.existeAdmin && (
              <CardContent>
                <Button
                  onClick={() => assumirPapel.mutate()}
                  disabled={assumirPapel.isPending}
                >
                  Tornar-me administrador
                </Button>
              </CardContent>
            )}
          </Card>
        )}

        {souAdmin && (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Documentos na base</CardDescription>
                  <CardTitle className="text-3xl">
                    {relatorio.data?.totalDocumentos ?? "—"}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Mensagens trocadas</CardDescription>
                  <CardTitle className="text-3xl">
                    {relatorio.data?.totalMensagens ?? "—"}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Categorias</CardDescription>
                  <CardTitle className="text-3xl">{categorias.data?.length ?? "—"}</CardTitle>
                </CardHeader>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="size-5 text-gold" /> Adicionar conhecimento
                </CardTitle>
                <CardDescription>
                  Carregue um ficheiro (PDF, TXT ou MD) ou cole directamente o texto. O
                  conteúdo é dividido e preparado para pesquisa inteligente.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  className="space-y-4"
                  onSubmit={(evento) => {
                    evento.preventDefault();
                    enviarDocumento.mutate();
                  }}
                >
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="titulo">Título</Label>
                      <Input
                        id="titulo"
                        required
                        maxLength={200}
                        placeholder="Regulamento Académico 2026"
                        value={titulo}
                        onChange={(e) => setTitulo(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Categoria</Label>
                      <Select value={categoriaId} onValueChange={setCategoriaId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Escolher" />
                        </SelectTrigger>
                        <SelectContent>
                          {(categorias.data ?? []).map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Tipo de acesso</Label>
                      <Select
                        value={acesso}
                        onValueChange={(valor) => setAcesso(valor as "publico" | "interno")}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="publico">
                            Público — usado nas respostas a todos
                          </SelectItem>
                          <SelectItem value="interno">
                            Interno — guardado, não usado no chat público
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ficheiro">Documento (opcional)</Label>
                      <Input
                        id="ficheiro"
                        type="file"
                        accept=".pdf,.txt,.md"
                        onChange={(e) => setFicheiro(e.target.files?.[0] ?? null)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="conteudo">Texto (use quando não tiver ficheiro)</Label>
                    <Textarea
                      id="conteudo"
                      rows={6}
                      placeholder="Ex.: A biblioteca funciona no Bloco B, piso 1, das 08h00 às 18h00..."
                      value={conteudo}
                      onChange={(e) => setConteudo(e.target.value)}
                    />
                  </div>

                  <Button type="submit" disabled={enviarDocumento.isPending}>
                    {enviarDocumento.isPending ? "A processar..." : "Processar documento"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="size-5 text-gold" /> Base de conhecimento
                </CardTitle>
                <CardDescription>Documentos disponíveis para o assistente.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {(documentos.data ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Ainda não existem documentos. Adicione o primeiro acima.
                  </p>
                )}
                {(documentos.data ?? []).map((documento) => (
                  <div
                    key={documento.id}
                    className="flex flex-wrap items-center gap-3 rounded-lg border bg-surface px-3 py-3"
                  >
                    <div className="mr-auto">
                      <p className="text-sm font-medium">{documento.titulo}</p>
                      <p className="text-xs text-muted-foreground">
                        {documento.categorias?.nome ?? "Sem categoria"} ·{" "}
                        {documento.acesso === "publico" ? "Público" : "Interno"} ·{" "}
                        {documento.total_partes} partes ·{" "}
                        {documento.estado === "pronto"
                          ? "Pronto"
                          : documento.estado === "erro"
                            ? `Erro: ${documento.erro ?? ""}`
                            : "A processar"}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remover ${documento.titulo}`}
                      onClick={() => apagar.mutate(documento.id)}
                      disabled={apagar.isPending}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Perguntas recentes</CardTitle>
                <CardDescription>
                  Ajuda a identificar informação que falta na base de conhecimento.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {(relatorio.data?.perguntasRecentes ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground">Ainda não há perguntas.</p>
                )}
                {(relatorio.data?.perguntasRecentes ?? []).map((pergunta) => (
                  <p key={pergunta.id} className="rounded-md bg-surface px-3 py-2 text-sm">
                    {pergunta.conteudo}
                  </p>
                ))}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
