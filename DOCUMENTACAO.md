# ISPOTEC AI — Assistente Inteligente Institucional

Documentação do sistema: o que é, como funciona, qual é o fluxo de funcionamento e quais são as vantagens.

---

## 1. O que é

O **ISPOTEC AI** é um assistente institucional que responde a perguntas sobre o Instituto
Superior Politécnico e de Tecnologias **apenas com base nos documentos oficiais carregados**
pela instituição (regulamentos, planos curriculares, manuais, FAQs, procedimentos,
documentos da DAF, etc.).

Princípios:

- Responde sempre em **português**.
- **Nunca inventa** informação. Se os documentos não responderem, di-lo e indica o sector
  responsável (Secretaria / Atendimento ao Estudante, DAF, Direcção Pedagógica ou Biblioteca).
- **Interpreta** o conteúdo (resume e explica por palavras próprias) em vez de copiar blocos de texto.
- Indica sempre a origem da resposta: `📄 Fonte: <título do documento>`.
- Não revela dados pessoais, notas ou dívidas de estudantes — essa consulta faz-se no
  sistema académico com credenciais próprias.

---

## 2. Quem usa

| Utilizador | Acesso | O que faz |
|---|---|---|
| Estudante, Docente, DAF, Secretaria, Direcção Pedagógica | Página inicial `/`, sem conta | Faz perguntas ao assistente, escolhendo o seu perfil |
| Administrador | `/admin`, com email e palavra-passe | Carrega documentos, define categorias e nível de acesso, vê estatísticas e perguntas recentes |

O visitante escolhe o **perfil** antes de perguntar; isso ajusta o tom e o enquadramento da resposta.

---

## 3. Duas áreas do sistema

### 3.1 Chat público (`/`)

- Selector de perfil e sugestões de perguntas.
- Resposta em tempo real (streaming), com a fonte no final.
- Não exige conta. Cada visitante tem uma "sessão" própria guardada no navegador, para o
  histórico ficar organizado.
- Só consulta documentos marcados como **públicos**.

### 3.2 Painel de administração (`/admin`)

- Entrada com email e palavra-passe.
- Estatísticas: total de documentos, total de mensagens, categorias disponíveis.
- Carregamento de conteúdo, de duas formas:
  - **Ficheiro** — PDF, TXT ou MD (o texto do PDF é extraído automaticamente);
  - **Texto colado** — escrever ou colar directamente o conteúdo.
- Cada documento tem: título, categoria e nível de acesso (**público** ou **interno**).
- Lista de documentos com o estado do processamento e opção de remover.
- Lista das perguntas mais recentes feitas ao assistente.

---

## 4. Fluxo de funcionamento

### 4.1 Carregar conhecimento (administrador)

```text
Administrador entra em /admin
        │
        ▼
Escolhe ficheiro (PDF/TXT/MD) ou cola texto
        │
        ▼
Define título, categoria e acesso (público / interno)
        │
        ▼
Sistema extrai o texto e guarda o documento (estado: a processar)
        │
        ▼
O texto é dividido em trechos com sobreposição
        │
        ▼
Cada trecho recebe uma "impressão digital" de significado (vector)
        │
        ▼
Trechos e vectores são guardados na base de conhecimento
        │
        ▼
Documento fica com estado: pronto   (ou erro, com a causa indicada)
```

### 4.2 Responder a uma pergunta (visitante)

```text
Visitante escolhe o perfil e escreve a pergunta
        │
        ▼
A pergunta é convertida em vector de significado
        │
        ▼
Pesquisa semântica encontra os trechos mais parecidos
   (o chat público só considera documentos públicos)
        │
        ▼
Os melhores trechos são reunidos como "informação institucional"
        │
        ▼
O modelo de IA recebe: perfil + regras + trechos + pergunta
        │
        ▼
Resposta interpretada, em português, com 📄 Fonte indicada
        │
        ├──► se não houver suporte nos documentos:
        │     "Não encontrei informação suficiente…" + sector indicado
        ▼
Pergunta e resposta ficam guardadas no histórico (com as fontes usadas)
```

---

## 5. Como funciona por dentro (nota técnica)

O sistema usa a técnica **RAG** (*Retrieval-Augmented Generation*): primeiro procura, só
depois responde — por isso as respostas ficam presas aos documentos da instituição.

- **Interface**: TanStack Start + React + Tailwind, com a identidade visual ISPOTEC
  (azul institucional e dourado, logótipo, tipografia Sora + Plus Jakarta Sans).
- **Backend e base de dados**: Lovable Cloud. Tabelas principais:
  - `categorias` — áreas temáticas (Académico, Financeiro, Biblioteca, Regulamentos, Sistemas, Estudantes, DAF, Pedagógico, Administrativo);
  - `documentos` — título, categoria, acesso, origem, estado, número de trechos;
  - `partes_documento` — trechos de texto + vector de significado (pesquisa por índice HNSW);
  - `conversas` / `mensagens` — histórico das perguntas e respostas, com as fontes;
  - `funcoes_utilizador` — quem é administrador (papel guardado em tabela separada, por segurança).
- **Segurança**: acesso por linha (RLS) em todas as tabelas; a verificação de administrador
  é feita no servidor; os ficheiros ficam num espaço de armazenamento **privado**, acessível
  apenas a administradores.
- **IA**: pesquisa semântica com embeddings e geração de resposta através do gateway de IA
  da plataforma; a pesquisa e a escrita da resposta correm sempre no servidor, nunca no navegador.
- **Ficheiros principais**:
  - `src/routes/index.tsx` — chat público
  - `src/routes/admin.tsx` — painel de administração
  - `src/routes/api/chat.ts` — recebe a pergunta, faz a pesquisa e devolve a resposta
  - `src/lib/rag.server.ts` — pesquisa nos documentos e regras do assistente
  - `src/lib/ai-gateway.server.ts` — divisão de texto e criação de vectores
  - `src/lib/conhecimento.functions.ts` — operações de administração (guardar, listar, apagar, relatório)

---

## 6. Vantagens

**Para a instituição**

- Respostas **consistentes e oficiais**: todos recebem a mesma informação, tirada dos mesmos documentos.
- **Menos carga** na Secretaria, DAF e Direcção Pedagógica em perguntas repetidas.
- **Controlo total do conteúdo**: quem publica é a instituição; nada entra sem passar pelo painel.
- Distinção entre informação **pública** e **interna**, no mesmo sistema.
- **Visibilidade**: as perguntas recentes mostram o que a comunidade realmente precisa de saber.

**Para os utilizadores**

- Disponível **24 horas por dia**, sem filas nem horário de expediente.
- Resposta **imediata**, em português claro, com o **documento de origem indicado** — dá para confirmar.
- Orientação **passo a passo** em procedimentos (matrícula, inscrição, pagamentos, declarações).
- Sem necessidade de criar conta para perguntar.

**Do ponto de vista técnico**

- **Fiabilidade**: o assistente não inventa; quando não sabe, encaminha para o sector certo.
- **Fácil de actualizar**: publicar um regulamento novo é carregar um ficheiro — não há programação envolvida.
- **Privacidade**: não expõe notas, dívidas nem dados pessoais.
- **Escalável**: novas categorias e documentos entram sem alterar o sistema.

---

## 7. Limitações actuais (Fase 1 — MVP)

- Não está ligado aos sistemas académico ou financeiro: não consulta notas, dívidas nem matrículas individuais.
- O conhecimento é o que estiver carregado — documentos desactualizados dão respostas desactualizadas.
- PDFs digitalizados como imagem (sem texto) não são lidos; é preciso colar o texto.
- Apenas um nível de administração (sem perfis intermédios de gestão de conteúdo).

## 8. Evolução prevista

- Integração com o sistema académico para consultas pessoais autenticadas.
- Área interna com login por perfil (DAF, Secretaria, Pedagógica) para documentos internos.
- Avaliação das respostas pelos utilizadores, para melhoria contínua.
- Relatórios mais completos de utilização e de temas mais procurados.
