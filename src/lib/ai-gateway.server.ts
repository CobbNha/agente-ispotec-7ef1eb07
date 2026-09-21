import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

const LOVABLE_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1";
const OPENROUTER_URL = "https://openrouter.ai/api/v1";
const GEMINI_OPENAI_URL = "https://generativelanguage.googleapis.com/v1beta/openai";

export type AIProvider = "openrouter" | "gemini" | "lovable";

export function getAIProvider(): AIProvider {
  const configured = (process.env["AI_PROVIDER"] ?? "openrouter").toLowerCase();
  if (configured === "gemini" && process.env["GEMINI_API_KEY"]) return "gemini";
  if (configured === "lovable" && process.env["LOVABLE_API_KEY"]) return "lovable";
  if (configured === "openrouter" && process.env["OPENROUTER_API_KEY"]) return "openrouter";
  if (process.env["OPENROUTER_API_KEY"]) return "openrouter";
  if (process.env["GEMINI_API_KEY"]) return "gemini";
  if (process.env["LOVABLE_API_KEY"]) return "lovable";
  throw new Error("Nenhum provedor de IA configurado. Defina OPENROUTER_API_KEY ou GEMINI_API_KEY.");
}

export function createAIProvider(): ReturnType<typeof createOpenAICompatible> {
  const provider = getAIProvider();
  if (provider === "openrouter") return createOpenAICompatible({
    name: "openrouter", baseURL: OPENROUTER_URL, apiKey: process.env["OPENROUTER_API_KEY"],
    headers: { "HTTP-Referer": process.env["APP_URL"] ?? "https://agente-ispotec.lovable.app", "X-Title": "ISPOTEC AI" },
  });
  if (provider === "gemini") return createOpenAICompatible({ name: "gemini", baseURL: GEMINI_OPENAI_URL, apiKey: process.env["GEMINI_API_KEY"] });
  return createOpenAICompatible({ name: "lovable", baseURL: LOVABLE_GATEWAY_URL, headers: { "Lovable-API-Key": process.env["LOVABLE_API_KEY"]!, "X-Lovable-AIG-SDK": "vercel-ai-sdk" } });
}

export function getAIModel(): string {
  const provider = getAIProvider();
  if (provider === "openrouter") return process.env["OPENROUTER_MODEL"] ?? "openrouter/free";
  if (provider === "gemini") return process.env["GEMINI_MODEL"] ?? "gemini-2.5-flash-lite";
  return process.env["LOVABLE_MODEL"] ?? "openai/gpt-6-astra";
}

export function dividirTexto(texto: string, tamanho = 1200, sobreposicao = 150): string[] {
  const limpo = texto.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!limpo) return [];
  const partes: string[] = []; let inicio = 0;
  while (inicio < limpo.length) {
    let fim = Math.min(inicio + tamanho, limpo.length);
    if (fim < limpo.length) { const corte = limpo.lastIndexOf("\n", fim); const corteFrase = limpo.lastIndexOf(". ", fim); const melhor = Math.max(corte, corteFrase); if (melhor > inicio + tamanho * 0.5) fim = melhor + 1; }
    const parte = limpo.slice(inicio, fim).trim(); if (parte.length > 20) partes.push(parte);
    if (fim >= limpo.length) break; inicio = Math.max(fim - sobreposicao, inicio + 1);
  } return partes;
}

export async function criarEmbeddings(textos: string[]): Promise<number[][]> {
  const apiKey = process.env["GEMINI_API_KEY"];
  if (!apiKey) throw new Error("Falta GEMINI_API_KEY para a pesquisa semântica.");
  const resultados: number[][] = []; const lote = 20;
  for (let i = 0; i < textos.length; i += lote) {
    const bloco = textos.slice(i, i + lote);
    const resposta = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:batchEmbedContents", {
      method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({ requests: bloco.map((content) => ({ model: "models/gemini-embedding-2", content: { parts: [{ text: content }] }, outputDimensionality: 3072 })) }),
    });
    if (!resposta.ok) { const detalhe = await resposta.text(); throw new Error(`Falha nos embeddings Gemini (${resposta.status}): ${detalhe.slice(0, 300)}`); }
    const json = (await resposta.json()) as { embeddings: { values: number[] }[] };
    for (const item of json.embeddings) resultados.push(item.values);
  } return resultados;
}