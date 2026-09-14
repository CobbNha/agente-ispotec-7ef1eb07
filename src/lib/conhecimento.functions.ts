import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { criarEmbeddings, dividirTexto } from "./ai-gateway.server";

const NovoDocumento = z.object({
  titulo: z.string().trim().min(3).max(200),
  categoria_id: z.string().uuid().nullable(),
  acesso: z.enum(["publico", "interno"]),
  conteudo: z.string().trim().min(30),
  origem: z.enum(["texto", "ficheiro"]).default("texto"),
  ficheiro_path: z.string().max(500).nullable().default(null),
});

async function garantirAdmin(supabase: {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
}) {
  return supabase;
}

/** Assume o papel de administrador. Só funciona quando ainda não existe nenhum. */
export const assumirAdministrador = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count, error } = await supabaseAdmin
      .from("funcoes_utilizador")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if (error) throw new Error(error.message);
    if ((count ?? 0) > 0) {
      throw new Error("Já existe um administrador. Peça-lhe acesso.");
    }
    const { error: erroInsercao } = await supabaseAdmin
      .from("funcoes_utilizador")
      .insert({ user_id: context.userId, role: "admin" });
    if (erroInsercao) throw new Error(erroInsercao.message);
    return { ok: true };
  });

/** Diz se o utilizador autenticado é administrador e se já existe algum. */
export const estadoAdministrador = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ count }, { data: proprio }] = await Promise.all([
      supabaseAdmin
        .from("funcoes_utilizador")
        .select("id", { count: "exact", head: true })
        .eq("role", "admin"),
      supabaseAdmin
        .from("funcoes_utilizador")
        .select("id")
        .eq("user_id", context.userId)
        .eq("role", "admin")
        .maybeSingle(),
    ]);
    return { existeAdmin: (count ?? 0) > 0, souAdmin: Boolean(proprio) };
  });

/** Lista todos os documentos da base de conhecimento (só administradores). */
export const listarDocumentos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Sem permissão.");
    const { data, error } = await context.supabase
      .from("documentos")
      .select("id, titulo, acesso, origem, estado, erro, total_partes, created_at, categorias(nome)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/** Guarda um documento, divide o texto e cria os vectores de pesquisa. */
export const guardarDocumento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => NovoDocumento.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Sem permissão.");

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("A IA não está configurada neste projecto.");

    const { data: documento, error } = await context.supabase
      .from("documentos")
      .insert({
        titulo: data.titulo,
        categoria_id: data.categoria_id,
        acesso: data.acesso,
        origem: data.origem,
        ficheiro_path: data.ficheiro_path,
        conteudo: data.conteudo,
        estado: "a_processar",
      })
      .select("id")
      .single();
    if (error || !documento) throw new Error(error?.message ?? "Não foi possível guardar.");

    try {
      const partes = dividirTexto(data.conteudo);
      if (partes.length === 0) throw new Error("O documento não tem texto suficiente.");
      const vectores = await criarEmbeddings(apiKey, partes);
      const linhas = partes.map((conteudo, i) => ({
        documento_id: documento.id,
        ordem: i,
        conteudo,
        embedding: JSON.stringify(vectores[i]),
      }));
      for (let i = 0; i < linhas.length; i += 50) {
        const { error: erroPartes } = await context.supabase
          .from("partes_documento")
          .insert(linhas.slice(i, i + 50));
        if (erroPartes) throw new Error(erroPartes.message);
      }
      await context.supabase
        .from("documentos")
        .update({ estado: "pronto", total_partes: partes.length, erro: null })
        .eq("id", documento.id);
      return { id: documento.id, partes: partes.length };
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : "Erro no processamento.";
      await context.supabase
        .from("documentos")
        .update({ estado: "erro", erro: mensagem })
        .eq("id", documento.id);
      throw new Error(mensagem);
    }
  });

/** Apaga um documento e todas as suas partes. */
export const apagarDocumento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Sem permissão.");
    const { data: doc } = await context.supabase
      .from("documentos")
      .select("ficheiro_path")
      .eq("id", data.id)
      .maybeSingle();
    const { error } = await context.supabase.from("documentos").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    if (doc?.ficheiro_path) {
      await context.supabase.storage.from("documentos").remove([doc.ficheiro_path]);
    }
    return { ok: true };
  });

/** Estatísticas e últimas perguntas feitas ao assistente. */
export const relatorioUso = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Sem permissão.");
    const [{ count: totalDocs }, { count: totalMensagens }, { data: recentes }] = await Promise.all([
      context.supabase.from("documentos").select("id", { count: "exact", head: true }),
      context.supabase.from("mensagens").select("id", { count: "exact", head: true }),
      context.supabase
        .from("mensagens")
        .select("id, papel, conteudo, fontes, created_at")
        .eq("papel", "utilizador")
        .order("created_at", { ascending: false })
        .limit(15),
    ]);
    return {
      totalDocumentos: totalDocs ?? 0,
      totalMensagens: totalMensagens ?? 0,
      perguntasRecentes: recentes ?? [],
    };
  });

export { garantirAdmin };
