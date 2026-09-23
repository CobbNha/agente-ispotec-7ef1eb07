import { useChat } from "@ai-sdk/react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { DefaultChatTransport } from "ai";
import {
  BadgeHelp,
  BookOpen,
  Building2,
  ChevronRight,
  CreditCard,
  GraduationCap,
  Landmark,
  MessageCircle,
  Library,
  Lock,
  ReceiptText,
  ScrollText,
  Sparkle,
  UserRoundCheck,
  UsersRound,
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

type Artigo = { titulo: string; resumo: string; pergunta: string; icone: typeof BookOpen };
type Area = {
  valor: string;
  etiqueta: string;
  nome: string;
  descricao: string;
  icone: typeof GraduationCap;
  artigos: Artigo[];
};

const AREAS: Area[] = [
  {
    valor: "estudante",
    etiqueta: "Estudante",
    nome: "Área do Estudante",
    descricao: "Matrícula, avaliações, cursos e vida académica",
    icone: GraduationCap,
    artigos: [
      { titulo: "Matrícula e renovação", resumo: "Regras, documentos e confirmação anual.", pergunta: "Como funciona a matrícula e a sua confirmação anual?", icone: ScrollText },
      { titulo: "Propinas e pagamentos", resumo: "Prestações, prazos e benefícios aplicáveis.", pergunta: "Como funcionam as propinas, os prazos e os descontos?", icone: CreditCard },
      { titulo: "Avaliação e aprovação", resumo: "Notas, exames e condições de aprovação.", pergunta: "Quais são as regras de avaliação, exame e aprovação?", icone: UserRoundCheck },
      { titulo: "Cursos disponíveis", resumo: "Licenciaturas, pós-graduações e mestrados.", pergunta: "Quais são os cursos disponíveis no ISPOTEC?", icone: BookOpen },
      { titulo: "Biblioteca", resumo: "Acesso, localização e serviços disponíveis.", pergunta: "Onde fica a biblioteca, qual é o horário e que serviços oferece?", icone: Library },
      { titulo: "Anulação da matrícula", resumo: "Condições e procedimentos regulamentares.", pergunta: "Como posso anular a matrícula e quais são as consequências?", icone: BadgeHelp },
    ],
  },
  {
    valor: "daf",
    etiqueta: "DAF / Finanças",
    nome: "Direcção Administrativa e Financeira",
    descricao: "Propinas, taxas, comprovativos e assuntos financeiros",
    icone: Landmark,
    artigos: [
      { titulo: "Calendário de propinas", resumo: "Prazos das prestações mensais.", pergunta: "Qual é o calendário e o prazo mensal para pagar propinas?", icone: CreditCard },
      { titulo: "Pagamento a pronto", resumo: "Condições e benefício aplicável.", pergunta: "Existe desconto ou isenção no pagamento integral das propinas?", icone: ReceiptText },
      { titulo: "Desconto familiar", resumo: "Benefícios para familiares directos.", pergunta: "Como funciona o desconto de propinas para familiares directos?", icone: UsersRound },
      { titulo: "Taxas de matrícula", resumo: "Valores de inscrição e matrícula por curso.", pergunta: "Quais são os valores de inscrição e matrícula dos cursos?", icone: ScrollText },
      { titulo: "Comprovativo de pagamento", resumo: "Orientação para validar pagamentos.", pergunta: "Como devo apresentar ou validar um comprovativo de pagamento?", icone: ReceiptText },
      { titulo: "Propina em atraso", resumo: "Regras aplicáveis a pagamentos fora do prazo.", pergunta: "O que acontece quando a propina é paga depois do prazo?", icone: BadgeHelp },
    ],
  },
  {
    valor: "secretaria",
    etiqueta: "Atendimento / Secretaria",
    nome: "Atendimento ao Estudante",
    descricao: "Inscrições, declarações e procedimentos académicos",
    icone: Building2,
    artigos: [
      { titulo: "Primeira inscrição", resumo: "Passos para novos estudantes.", pergunta: "Quais são os passos e documentos para a primeira inscrição?", icone: ScrollText },
      { titulo: "Confirmação de matrícula", resumo: "Procedimento realizado em cada ano lectivo.", pergunta: "Como faço a confirmação anual da matrícula?", icone: UserRoundCheck },
      { titulo: "Declarações", resumo: "Pedidos de documentos académicos.", pergunta: "Como posso pedir uma declaração de estudante?", icone: BookOpen },
      { titulo: "Consulta de notas", resumo: "Forma segura de consultar resultados.", pergunta: "Como posso consultar as minhas notas?", icone: GraduationCap },
      { titulo: "Mudança e reingresso", resumo: "Regras para retomar ou alterar estudos.", pergunta: "Quais são as regras para reingresso ou mudança de curso?", icone: BadgeHelp },
      { titulo: "Contactos e localização", resumo: "Canais oficiais de atendimento.", pergunta: "Quais são os contactos e a localização do ISPOTEC?", icone: Building2 },
    ],
  },
  {
    valor: "pedagogica",
    etiqueta: "Direcção Pedagógica",
    nome: "Direcção Pedagógica",
    descricao: "Regulamento, avaliação e acompanhamento académico",
    icone: ScrollText,
    artigos: [
      { titulo: "Sistema de avaliação", resumo: "Classificação e componentes de avaliação.", pergunta: "Como está organizado o sistema de avaliação académica?", icone: UserRoundCheck },
      { titulo: "Admissão a exame", resumo: "Nota mínima e demais condições.", pergunta: "Qual é a nota mínima e quais são as condições de admissão a exame?", icone: ScrollText },
      { titulo: "Exames", resumo: "Duração, ponderação e funcionamento.", pergunta: "Qual é a duração dos exames e como é calculada a nota final?", icone: BookOpen },
      { titulo: "Revisão de prova", resumo: "Prazo e procedimento para solicitar revisão.", pergunta: "Como e em que prazo posso pedir revisão de uma prova?", icone: BadgeHelp },
      { titulo: "Assiduidade", resumo: "Presenças mínimas e efeitos das faltas.", pergunta: "Quais são as regras de assiduidade e faltas?", icone: UsersRound },
      { titulo: "Conclusão do curso", resumo: "Requisitos, monografia e encerramento.", pergunta: "Quais são os requisitos para concluir o curso?", icone: GraduationCap },
    ],
  },
  {
    valor: "docente",
    etiqueta: "Docente",
    nome: "Área do Docente",
    descricao: "Avaliação, assiduidade e procedimentos lectivos",
    icone: UsersRound,
    artigos: [
      { titulo: "Avaliação contínua", resumo: "Organização das avaliações ao longo do semestre.", pergunta: "Quais são as regras para a avaliação contínua?", icone: UserRoundCheck },
      { titulo: "Provas parcelares", resumo: "Duração e aplicação regulamentar.", pergunta: "Como devem funcionar as provas parcelares e qual é a sua duração?", icone: ScrollText },
      { titulo: "Lançamento de notas", resumo: "Orientações institucionais disponíveis.", pergunta: "Que orientações existem para o lançamento e comunicação de notas?", icone: GraduationCap },
      { titulo: "Controlo de presenças", resumo: "Assiduidade dos estudantes e faltas.", pergunta: "Como deve ser feito o controlo de assiduidade dos estudantes?", icone: UsersRound },
      { titulo: "Revisão de avaliação", resumo: "Responsabilidades e prazos aplicáveis.", pergunta: "Como funciona a revisão de uma avaliação solicitada pelo estudante?", icone: BadgeHelp },
      { titulo: "Regulamento académico", resumo: "Normas essenciais para a actividade docente.", pergunta: "Quais são as principais regras académicas que um docente deve conhecer?", icone: BookOpen },
    ],
  },
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
  const areaActiva = AREAS.find((area) => area.valor === perfil) ?? AREAS[0]!;

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
    <div className="min-h-screen bg-background lg:p-5">
      <Toaster />
      <div className="mx-auto flex min-h-[calc(100vh-2.5rem)] w-full max-w-[1440px] overflow-hidden border bg-card shadow-panel lg:rounded-lg">
        <aside className="hidden w-72 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
          <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-5">
            <Marca tamanho={48} />
            <div className="min-w-0">
              <h1 className="font-display text-lg font-semibold">ISPOTEC AI</h1>
              <p className="truncate text-xs text-sidebar-foreground/65">Assistente Institucional</p>
            </div>
          </div>
          <nav className="flex-1 space-y-1 p-3" aria-label="Áreas institucionais">
            <p className="px-3 pb-2 pt-1 text-xs font-semibold uppercase text-sidebar-foreground/50">Escolha a sua área</p>
            {AREAS.map((area) => {
              const Icone = area.icone;
              const activo = area.valor === perfil;
              return (
                <Button
                  key={area.valor}
                  type="button"
                  variant="ghost"
                  onClick={() => setPerfil(area.valor)}
                  className={`h-auto w-full justify-start gap-3 px-3 py-3 text-left ${activo ? "bg-sidebar-accent text-sidebar-primary" : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground"}`}
                >
                  <Icone className="size-5 shrink-0" />
                  <span className="min-w-0 whitespace-normal leading-tight">{area.etiqueta}</span>
                  {activo && <ChevronRight className="ml-auto size-4 shrink-0" />}
                </Button>
              );
            })}
          </nav>
          <div className="border-t border-sidebar-border p-4 space-y-1">
            <Button asChild variant="ghost" className="w-full justify-start gap-3 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground">
              <a href="https://cdn.botpress.cloud/webchat/v3.5/shareable.html?configUrl=https://files.bpcontent.cloud/2026/01/25/21/20260125215138-GUF14096.json" target="_blank" rel="noopener noreferrer"><MessageCircle className="size-4" /> ISPOTEC Chatbot</a>
            </Button>
            <Button asChild variant="ghost" className="w-full justify-start gap-3 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground">
              <Link to="/admin"><Lock className="size-4" /> Administração</Link>
            </Button>
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col bg-background">
          <header className="border-b bg-card px-4 py-4 sm:px-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase text-primary">Portal de conhecimento</p>
                <h2 className="mt-1 text-xl font-semibold sm:text-2xl">{areaActiva.nome}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{areaActiva.descricao}</p>
              </div>
              <Button asChild variant="outline" size="icon" className="shrink-0 md:hidden">
                <a href="https://cdn.botpress.cloud/webchat/v3.5/shareable.html?configUrl=https://files.bpcontent.cloud/2026/01/25/21/20260125215138-GUF14096.json" target="_blank" rel="noopener noreferrer" aria-label="ISPOTEC Chatbot"><MessageCircle className="size-4" /></a>
              </Button>
              <Button asChild variant="outline" size="icon" className="shrink-0 md:hidden">
                <Link to="/admin" aria-label="Área de administração"><Lock className="size-4" /></Link>
              </Button>
            </div>
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1 md:hidden">
              {AREAS.map((area) => {
                const Icone = area.icone;
                return (
                  <Button key={area.valor} type="button" size="sm" variant={area.valor === perfil ? "default" : "outline"} onClick={() => setPerfil(area.valor)} className="shrink-0 gap-2">
                    <Icone className="size-4" />{area.etiqueta}
                  </Button>
                );
              })}
            </div>
          </header>

          {messages.length === 0 && (
            <section className="border-b bg-card px-4 py-5 sm:px-6" aria-labelledby="artigos-titulo">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 id="artigos-titulo" className="font-display font-semibold">Artigos e perguntas frequentes</h3>
                  <p className="text-xs text-muted-foreground">Seleccione uma questão para consultar os documentos oficiais.</p>
                </div>
                <span className="shrink-0 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">{areaActiva.artigos.length} artigos</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {areaActiva.artigos.map((artigo) => {
                  const Icone = artigo.icone;
                  return (
                    <Button key={artigo.titulo} type="button" variant="outline" onClick={() => enviar(artigo.pergunta)} className="group h-auto min-h-24 items-start justify-start gap-3 whitespace-normal bg-background p-4 text-left hover:border-ring hover:bg-accent/40">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-secondary text-primary"><Icone className="size-4" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-foreground">{artigo.titulo}</span>
                        <span className="mt-1 block text-xs font-normal leading-relaxed text-muted-foreground">{artigo.resumo}</span>
                      </span>
                      <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </Button>
                  );
                })}
              </div>
            </section>
          )}

          <div className="flex min-h-[360px] flex-1 flex-col px-4 py-5 sm:px-6">
            <Conversation className="flex-1">
              <ConversationContent className="mx-auto w-full max-w-4xl gap-6">
            {messages.length === 0 && (
              <div className="flex items-start gap-3 border-l-2 border-gold py-1 pl-4">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground"><Sparkle className="size-4" /></span>
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Sparkle className="size-4 text-gold" />
                  Bem-vindo ao assistente do ISPOTEC
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">Escolha um artigo acima ou escreva a sua pergunta. A resposta será baseada nos documentos da instituição.</p>
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
          className="mx-auto mt-4 w-full max-w-4xl bg-card shadow-soft"
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
            <p className="mx-auto mt-3 w-full max-w-4xl text-center text-xs text-muted-foreground">ISPOTEC — respostas baseadas nos documentos oficiais da instituição.</p>
          </div>
        </main>
      </div>
    </div>
  );
}
