import type { ParteEncontrada } from "./rag.server";

const VAZIAS = new Set([
  "a","o","as","os","de","da","do","das","dos","e","em","no","na","nos","nas","um","uma","que",
  "para","por","com","como","qual","quais","quanto","quantos","quando","onde","se","ao","aos",
  "à","às","é","são","ser","sobre","posso","pode","tenho","meu","minha","sua","seu","mais","dos",
  "informacao","informação","me","eu","nao","não","the","of","and",
]);

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function palavrasChave(pergunta: string): string[] {
  return normalizar(pergunta)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((p) => p.length > 3 && !VAZIAS.has(p));
}

function frases(texto: string): string[] {
  return texto
    .replace(/\s+/g, " ")
    .split(/(?<=[.;:!?])\s+/)
    .map((f) => f.trim())
    .filter((f) => f.length > 40);
}

/**
 * Resposta construída localmente, sem qualquer serviço de IA externo.
 * Selecciona as frases dos documentos institucionais mais próximas da pergunta.
 * Usada quando todas as APIs falham (créditos/cotas esgotados ou serviço em baixo).
 */
export function respostaOffline(pergunta: string, partes: ParteEncontrada[]): string {
  if (partes.length === 0) {
    return [
      "Não encontrei informação suficiente nos documentos disponíveis para responder a esta questão.",
      "",
      "Sugiro contactar o sector indicado: Secretaria / Atendimento ao Estudante (matrículas, inscrições, declarações), DAF (propinas e pagamentos), Direcção Pedagógica (avaliações e planos curriculares) ou a Biblioteca.",
    ].join("\n");
  }

  const chaves = palavrasChave(pergunta);
  type Candidata = { frase: string; titulo: string; pontos: number };
  const candidatas: Candidata[] = [];

  for (const parte of partes) {
    for (const frase of frases(parte.conteudo)) {
      const alvo = normalizar(frase);
      let pontos = parte.similaridade;
      for (const chave of chaves) if (alvo.includes(chave)) pontos += 1;
      candidatas.push({ frase, titulo: parte.titulo, pontos });
    }
  }

  const escolhidas: Candidata[] = [];
  const vistas = new Set<string>();
  for (const c of candidatas.sort((a, b) => b.pontos - a.pontos)) {
    const chave = c.frase.slice(0, 60);
    if (vistas.has(chave)) continue;
    vistas.add(chave);
    escolhidas.push(c);
    if (escolhidas.length >= 6) break;
  }

  const fontes = [...new Set(escolhidas.map((c) => c.titulo))];

  return [
    "Os serviços de IA estão momentaneamente indisponíveis (cota ou créditos esgotados), por isso respondo em **modo offline**, citando directamente os documentos institucionais:",
    "",
    ...escolhidas.map((c) => `• ${c.frase}`),
    "",
    `📄 Fonte: ${fontes.join(" | ")}`,
    "",
    "Se precisar de uma explicação mais detalhada, volte a perguntar mais tarde ou contacte a Secretaria / Atendimento ao Estudante, a DAF ou a Direcção Pedagógica.",
  ].join("\n");
}
