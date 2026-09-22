import { createFileRoute } from "@tanstack/react-router";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
  type LanguageModel,
  type ModelMessage,
  type UIMessage,
} from "ai";

import {
  chaveGoogle,
  chaveGroq,
  createGoogleProvider,
  createGroqProvider,
  createLovableAiGatewayProvider,
  MODELO_GOOGLE,
  MODELO_GROQ,
  MODELO_GROQ_ALT,
} from "@/lib/ai-gateway.server";

import { construirContexto, instrucoesSistema, procurarConhecimento } from "@/lib/rag.server";
import { respostaOffline } from "@/lib/resposta-offline.server";

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

type Motor = {
  nome: string;
  modelo: LanguageModel;
  opcoes?: Record<string, Record<string, string>>;
};

/** Ordem de tentativa: GroqCloud → Google Gemini → Gateway Lovable. */
function motores(): Motor[] {
  const lista: Motor[] = [];
  const groq = chaveGroq();
  if (groq) {
    const provedor = createGroqProvider(groq);
    lista.push({
      nome: `groq:${MODELO_GROQ}`,
      modelo: provedor(MODELO_GROQ),
      opcoes: { groq: { reasoning_effort: "low" } },
    });
    lista.push({ nome: `groq:${MODELO_GROQ_ALT}`, modelo: provedor(MODELO_GROQ_ALT) });
  }
  const google = chaveGoogle();
  if (google) {
    lista.push({ nome: `google:${MODELO_GOOGLE}`, modelo: createGoogleProvider(google)(MODELO_GOOGLE) });
  }
  const lovable = process.env["LOVABLE_API_KEY"];
  if (lovable) {
    lista.push({
      nome: "lovable:openai/gpt-6-astra",
      modelo: createLovableAiGatewayProvider(lovable)("openai/gpt-6-astra"),
    });
  }
  return lista;
}

/** Tenta cada motor por ordem; devolve o texto do primeiro que responder. */
async function gerarTexto(
  system: string,
  messages: ModelMessage[],
): Promise<{ texto: string; motor: string } | null> {
  for (const motor of motores()) {
    try {
      const resultado = streamText({
        model: motor.modelo,
        system,
        messages,
        ...(motor.opcoes ? { providerOptions: motor.opcoes } : {}),
      });
      const texto = (await resultado.text).trim();
      if (texto.length > 0) return { texto, motor: motor.nome };
      console.error(`Motor ${motor.nome} devolveu resposta vazia.`);
    } catch (erro) {
      console.error(`Motor ${motor.nome} falhou:`, erro);
    }
  }
  return null;
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

        const resultado = await gerarTexto(
          instrucoesSistema(perfil, construirContexto(relevantes)),
          await convertToModelMessages(mensagens),
        );

        // Sem nenhum serviço de IA disponível, responde localmente com os documentos.
        const texto = resultado?.texto ?? respostaOffline(pergunta, relevantes);
        console.log(`Resposta gerada por: ${resultado?.motor ?? "modo offline (documentos)"}`);

        const stream = createUIMessageStream({
          execute: async ({ writer }) => {
            const id = crypto.randomUUID();
            writer.write({ type: "text-start", id });
            writer.write({ type: "text-delta", id, delta: texto });
            writer.write({ type: "text-end", id });
          },
          onFinish: async () => {
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
                { conversa_id: conversaId, papel: "assistente", conteudo: texto, fontes },
              ]);
            } catch (erro) {
              console.error("Não foi possível guardar a conversa:", erro);
            }
          },
        });

        return createUIMessageStreamResponse({ stream });
      },
    },
  },
});
