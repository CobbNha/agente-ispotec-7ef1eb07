import { useChat } from "@ai-sdk/react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { DefaultChatTransport } from "ai";
import {
  BookOpen,
  CreditCard,
  GraduationCap,
  Library,
  Lock,
  ScrollText,
  Sparkle,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Marca } from "@/components/ispotec/Marca";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ISPOTEC AI — Assistente Inteligente Institucional" },
      {
        name: "description",
        content:
          "Assistente virtual do ISPOTEC: respostas sobre matrícula, propinas, notas, regulamentos, biblioteca e procedimentos académicos, com base nos documentos oficiais.",
      },
      { property: "og:title", content: "ISPOTEC AI — Assistente Inteligente Institucional" },
      {
        property: "og:description",
        content:
          "Pergunte sobre matrícula, propinas, notas, avaliação, biblioteca e procedimentos do ISPOTEC. Respostas baseadas nos documentos oficiais da instituição.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Assistente,
});

const PERFIS = [
  { valor: "estudante", etiqueta: "Estudante" },
  { valor: "docente", etiqueta: "Docente" },
  { valor: "daf", etiqueta: "DAF / Finanças" },
  { valor: "secretaria", etiqueta: "Atendimento ao Estudante" },
  { valor: "pedagogica", etiqueta: "Direcção Pedagógica" },
];

const SUGESTOES = [
  { icone: Library, texto: "Onde fica a biblioteca e qual é o horário?" },
  { icone: CreditCard, texto: "Como faço o pagamento das propinas?" },
  { icone: GraduationCap, texto: "Como consulto as minhas notas?" },
  { icone: ScrollText, texto: "Como funciona o processo de avaliação?" },
  { icone: BookOpen, texto: "Quais são os cursos disponíveis?" },
];

function usarSessao() {
  const [sessao, setSessao] = useState("");
  useEffect(() => {
    const chave = "ispotec-ai-sessao";
    let valor = window.localStorage.getItem(chave);
    if (!valor) {
      valor = crypto.randomUUID();
      window.localStorage.setItem(chave, valor);
    }
    setSessao(valor);
  }, []);
  return sessao;
}

function Assistente() {
  const sessao = usarSessao();
  const [perfil, setPerfil] = useState("estudante");
  const [texto, setTexto] = useState("");
  const areaTexto = useRef<HTMLTextAreaElement>(null);

  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/chat", body: { perfil, sessao } }),
    [perfil, sessao],
  );

  const { messages, sendMessage, status } = useChat({
    transport,
    onError: (erro) =>
      toast.error("Não foi possível obter a resposta", {
        description: erro.message.includes("402")
          ? "Os créditos de IA do projecto esgotaram. Contacte o administrador."
          : "Tente novamente dentro de alguns instantes.",
      }),
  });

  const aTrabalhar = status === "submitted" || status === "streaming";

  useEffect(() => {
    if (!aTrabalhar) areaTexto.current?.focus();
  }, [aTrabalhar, messages.length]);

  function enviar(pergunta: string) {
    const limpo = pergunta.trim();
    if (!limpo || aTrabalhar) return;
    setTexto("");
    void sendMessage({ text: limpo });
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Toaster />
      <header className="bg-gradient-institucional text-primary-foreground">
        <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center gap-3 px-4 py-4">
          <Marca tamanho={48} />
          <div className="mr-auto">
            <h1 className="font-display text-lg font-semibold leading-tight">
              ISPOTEC AI
            </h1>
            <p className="text-xs opacity-80">Assistente Inteligente Institucional</p>
          </div>
          <Select value={perfil} onValueChange={setPerfil}>
            <SelectTrigger className="w-[210px] border-white/25 bg-white/10 text-primary-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERFIS.map((p) => (
                <SelectItem key={p.valor} value={p.valor}>
                  {p.etiqueta}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button asChild variant="ghost" size="icon" className="hover:bg-white/15">
            <Link to="/admin" aria-label="Área de administração">
              <Lock className="size-4" />
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-6">
        <Conversation className="flex-1">
          <ConversationContent className="gap-6">
            {messages.length === 0 && (
              <div className="rounded-xl border bg-card p-6 shadow-soft">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Sparkle className="size-4 text-gold" />
                  Bem-vindo ao assistente do ISPOTEC
                </div>
                <h2 className="mt-2 text-xl font-semibold">
                  Olá! Em que posso ajudar hoje?
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Respondo com base nos documentos oficiais da instituição: regulamentos,
                  procedimentos, cursos, propinas, biblioteca e serviços académicos.
                </p>
                <div className="mt-5 grid gap-2 sm:grid-cols-2">
                  {SUGESTOES.map(({ icone: Icone, texto: sugestao }) => (
                    <button
                      key={sugestao}
                      type="button"
                      onClick={() => enviar(sugestao)}
                      className="flex items-center gap-3 rounded-lg border bg-surface px-3 py-3 text-left text-sm text-surface-foreground transition-colors hover:border-ring hover:bg-accent"
                    >
                      <Icone className="size-4 shrink-0 text-primary" />
                      {sugestao}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((mensagem) => (
              <Message key={mensagem.id} from={mensagem.role}>
                <MessageContent>
                  {mensagem.parts.map((parte, indice) =>
                    parte.type === "text" ? (
                      <MessageResponse key={indice}>{parte.text}</MessageResponse>
                    ) : null,
                  )}
                </MessageContent>
              </Message>
            ))}

            {status === "submitted" && (
              <Message from="assistant">
                <MessageContent>
                  <Shimmer>A consultar os documentos institucionais...</Shimmer>
                </MessageContent>
              </Message>
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        <PromptInput
          className="mt-4"
          onSubmit={(_mensagem, evento) => {
            evento.preventDefault();
            enviar(texto);
          }}
        >
          <PromptInputTextarea
            ref={areaTexto}
            value={texto}
            onChange={(evento) => setTexto(evento.currentTarget.value)}
            placeholder="Escreva a sua pergunta... por exemplo: como faço a minha inscrição?"
          />
          <PromptInputFooter className="justify-between">
            <span className="text-xs text-muted-foreground">
              As respostas baseiam-se nos documentos carregados pela instituição.
            </span>
            <PromptInputSubmit status={status} disabled={!texto.trim() || aTrabalhar} />
          </PromptInputFooter>
        </PromptInput>
      </main>

      <footer className="border-t bg-surface py-4 text-center text-xs text-muted-foreground">
        ISPOTEC — Instituto Superior Politécnico e de Tecnologias · Assistente Inteligente
        Institucional
      </footer>
    </div>
  );
}
