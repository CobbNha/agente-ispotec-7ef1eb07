import { chaveGoogle, criarEmbeddings } from "./ai-gateway.server";

export type ParteEncontrada = {
  documento_id: string;
  titulo: string;
  categoria: string | null;
  acesso: string;
  conteudo: string;
  similaridade: number;
};

/** Procura as partes de documentos mais relevantes para uma pergunta. */
export async function procurarConhecimento(
  pergunta: string,
  opcoes: { incluirInternos?: boolean; limite?: number } = {},
): Promise<ParteEncontrada[]> {
  const apiKey = chaveGoogle() ?? process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("Falta a configuração da IA (chave do Google ou LOVABLE_API_KEY).");


  const [vector] = await criarEmbeddings(apiKey, [pergunta]);
  if (!vector) return [];

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("procurar_partes", {
    query_embedding: vector as unknown as string,
    match_count: opcoes.limite ?? 6,
    incluir_internos: opcoes.incluirInternos ?? false,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ParteEncontrada[];
}

export function construirContexto(partes: ParteEncontrada[]): string {
  return partes
    .map(
      (p, i) =>
        `[${i + 1}] Documento: ${p.titulo}${p.categoria ? ` (categoria: ${p.categoria})` : ""}\n${p.conteudo}`,
    )
    .join("\n\n---\n\n");
}

export const PERFIS = {
  estudante: "Estudante",
  daf: "DAF / Finanças",
  secretaria: "Atendimento ao Estudante / Secretaria",
  pedagogica: "Direcção Pedagógica",
  docente: "Docente",
} as const;

export type Perfil = keyof typeof PERFIS;

export function instrucoesSistema(perfil: string, contexto: string): string {
  const papel = PERFIS[(perfil as Perfil) ?? "estudante"] ?? "Estudante";
  return `És o Assistente Inteligente Institucional do ISPOTEC (Instituto Superior Politécnico e de Tecnologias).

Responde SEMPRE em português de Moçambique/Portugal, de forma clara, educada e prática.
A pessoa com quem falas identificou-se como: ${papel}.

REGRAS IMPORTANTES:
1. Baseia as respostas exclusivamente na INFORMAÇÃO INSTITUCIONAL fornecida abaixo, mas INTERPRETA-A: lê os extractos com atenção, relaciona-os entre si, resume, explica por palavras tuas e responde directamente ao que foi perguntado (não copies blocos de texto).
2. Nunca invents regulamentos, valores, prazos, horários ou procedimentos que não estejam nos extractos. Se os extractos só responderem em parte, responde ao que é suportado e diz claramente o que falta.
3. Quando usares informação dos documentos, indica a fonte no fim assim: "📄 Fonte: <título do documento>".
4. Se a informação não existir nos documentos, responde exactamente neste espírito: "Não encontrei informação suficiente nos documentos disponíveis para responder a esta questão." e indica o sector mais indicado (Secretaria / Atendimento ao Estudante, DAF, Direcção Pedagógica ou Biblioteca).
5. Dá orientação passo a passo quando a pergunta for sobre um procedimento (matrícula, inscrição, pagamento, declarações, consulta de notas).
6. Nunca reveles dados pessoais, notas ou dívidas de estudantes: explica que essa consulta é feita no sistema académico com as credenciais próprias.
7. Sê breve: no máximo alguns parágrafos curtos ou uma lista.

INFORMAÇÃO INSTITUCIONAL DISPONÍVEL:
${contexto || "(Nenhum documento relevante foi encontrado para esta pergunta.)"}`;
}
