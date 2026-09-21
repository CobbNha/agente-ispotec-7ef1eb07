import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";

import {
  chaveGoogle,
  createGoogleProvider,
  createLovableAiGatewayProvider,
  MODELO_GOOGLE,
} from "@/lib/ai-gateway.server";

import { construirContexto, instrucoesSistema, procurarConhecimento } from "@/lib/rag.server";

type CorpoPedido = {
  messages?: UIMessage[];
  perfil?: string;
  sessao?: string;
};

function textoDaMensagem(mensagem: UIMessage | undefined): string {
  if (!mensagem) return "";
  return mensagem.parts
    .map((parte) => (parte.type === "text" ? parte.text : ""))
    .join(" ")
    .trim();
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const corpo = (await request.json()) as CorpoPedido;
        const mensagens = corpo.messages;
        if (!Array.isArray(mensagens) || mensagens.length === 0) {
          return new Response("É necessário enviar uma pergunta.", { status: 400 });
        }

        const google = chaveGoogle();
        const apiKey = google ?? process.env["LOVABLE_API_KEY"];
        if (!apiKey) {
          return new Response("A IA não está configurada neste projecto.", { status: 500 });
        }


        const perfil = corpo.perfil ?? "estudante";
        const pergunta = textoDaMensagem(mensagens[mensagens.length - 1]);

        let partes: Awaited<ReturnType<typeof procurarConhecimento>> = [];
        try {
          if (pergunta) partes = await procurarConhecimento(pergunta, { limite: 12 });
        } catch (erro) {
          console.error("Falha na pesquisa de conhecimento:", erro);
        }

        // Mantém as partes claramente relevantes; se nenhuma passar o limiar,
        // usa as melhores encontradas para o modelo poder interpretar o conteúdo.
        const fortes = partes.filter((p) => p.similaridade > 0.3);
        const relevantes = (fortes.length > 0 ? fortes : partes).slice(0, 8);
        const fontes = [...new Set(relevantes.map((p) => p.titulo))];

        const gateway = createLovableAiGatewayProvider(apiKey);
        const resultado = streamText({
          model: gateway("openai/gpt-6-astra"),
          system: instrucoesSistema(perfil, construirContexto(relevantes)),
          messages: await convertToModelMessages(mensagens),
        });

        return resultado.toUIMessageStreamResponse({
          originalMessages: mensagens,
          onFinish: async ({ responseMessage }) => {
            try {
              const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
              const sessao = corpo.sessao ?? "anonima";
              const { data: existente } = await supabaseAdmin
                .from("conversas")
                .select("id")
                .eq("sessao", sessao)
                .limit(1)
                .maybeSingle();
              let conversaId = existente?.id;
              if (!conversaId) {
                const { data: nova } = await supabaseAdmin
                  .from("conversas")
                  .insert({ sessao, perfil, titulo: pergunta.slice(0, 120) })
                  .select("id")
                  .single();
                conversaId = nova?.id;
              }
              if (!conversaId) return;
              await supabaseAdmin.from("mensagens").insert([
                { conversa_id: conversaId, papel: "utilizador", conteudo: pergunta },
                {
                  conversa_id: conversaId,
                  papel: "assistente",
                  conteudo: textoDaMensagem(responseMessage),
                  fontes,
                },
              ]);
            } catch (erro) {
              console.error("Não foi possível guardar a conversa:", erro);
            }
          },
        });
      },
    },
  },
});
