import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1";
const GOOGLE_URL = "https://generativelanguage.googleapis.com/v1beta";

/** Chave gratuita do Google (Gemini), quando configurada. */
export function chaveGoogle(): string | undefined {
  return process.env["GOOGLE_GEMINI_API_KEY"] || undefined;
}

export const MODELO_GOOGLE = "gemini-3.5-flash-lite";
export const MODELO_EMBEDDINGS_GOOGLE = "gemini-embedding-001";

const GROQ_URL = "https://api.groq.com/openai/v1";

/** Modelo principal pedido: openai/gpt-oss-120b na GroqCloud. */
export const MODELO_GROQ = "openai/gpt-oss-120b";
/** Contingência dentro da própria GroqCloud. */
export const MODELO_GROQ_ALT = "llama-3.3-70b-versatile";

/** Chave da GroqCloud, quando configurada. */
export function chaveGroq(): string | undefined {
  return process.env["GROQ_API_KEY"] || undefined;
}

/** Provedor que fala com a GroqCloud (compatível com OpenAI). */
export function createGroqProvider(apiKey: string) {
  return createOpenAICompatible({
    name: "groq",
    baseURL: GROQ_URL,
    apiKey,
  });
}


/** Provedor que fala com a API gratuita do Google (compatível com OpenAI). */
export function createGoogleProvider(apiKey: string) {
  return createOpenAICompatible({
    name: "google",
    baseURL: `${GOOGLE_URL}/openai`,
    apiKey,
  });
}

export function createLovableAiGatewayProvider(apiKey: string) {
  return createOpenAICompatible({
    name: "lovable",
    baseURL: GATEWAY_URL,
    headers: {
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
  });
}


/** Divide um texto longo em partes com sobreposição, para pesquisa semântica. */
export function dividirTexto(texto: string, tamanho = 1200, sobreposicao = 150): string[] {
  const limpo = texto.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!limpo) return [];
  const partes: string[] = [];
  let inicio = 0;
  while (inicio < limpo.length) {
    let fim = Math.min(inicio + tamanho, limpo.length);
    if (fim < limpo.length) {
      const corte = limpo.lastIndexOf("\n", fim);
      const corteFrase = limpo.lastIndexOf(". ", fim);
      const melhor = Math.max(corte, corteFrase);
      if (melhor > inicio + tamanho * 0.5) fim = melhor + 1;
    }
    const parte = limpo.slice(inicio, fim).trim();
    if (parte.length > 20) partes.push(parte);
    if (fim >= limpo.length) break;
    inicio = Math.max(fim - sobreposicao, inicio + 1);
  }
  return partes;
}

/** Cria embeddings (vectores) para um conjunto de textos, em lotes seguros. */
export async function criarEmbeddings(apiKey: string, textos: string[]): Promise<number[][]> {
  const google = chaveGoogle();
  if (google) return criarEmbeddingsGoogle(google, textos);

  const resultados: number[][] = [];
  const lote = 20;
  for (let i = 0; i < textos.length; i += lote) {
    const bloco = textos.slice(i, i + lote);
    const resposta = await fetch(`${GATEWAY_URL}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
      },
      body: JSON.stringify({ model: "google/gemini-embedding-2", input: bloco }),
    });
    if (!resposta.ok) {
      const detalhe = await resposta.text();
      throw new Error(`Falha ao criar embeddings (${resposta.status}): ${detalhe.slice(0, 300)}`);
    }
    const json = (await resposta.json()) as {
      data: { index: number; embedding: number[] }[];
    };
    const ordenado = [...json.data].sort((a, b) => a.index - b.index);
    for (const item of ordenado) resultados.push(item.embedding);
  }
  return resultados;
}

/** Embeddings pela API gratuita do Google, com as mesmas 3072 dimensões. */
async function criarEmbeddingsGoogle(apiKey: string, textos: string[]): Promise<number[][]> {
  const resultados: number[][] = [];
  const lote = 20;
  for (let i = 0; i < textos.length; i += lote) {
    const bloco = textos.slice(i, i + lote);
    const resposta = await fetch(
      `${GOOGLE_URL}/models/${MODELO_EMBEDDINGS_GOOGLE}:batchEmbedContents`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          requests: bloco.map((texto) => ({
            model: `models/${MODELO_EMBEDDINGS_GOOGLE}`,
            content: { parts: [{ text: texto }] },
            outputDimensionality: 3072,
          })),
        }),
      },
    );
    if (!resposta.ok) {
      const detalhe = await resposta.text();
      throw new Error(`Falha ao criar embeddings (${resposta.status}): ${detalhe.slice(0, 300)}`);
    }
    const json = (await resposta.json()) as { embeddings: { values: number[] }[] };
    for (const item of json.embeddings ?? []) resultados.push(item.values);
  }
  return resultados;
}

