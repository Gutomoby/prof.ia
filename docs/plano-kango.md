# Plano de migração para o Kango

Repaginação do prof.ia para a identidade Kango, por fases. Cada fase é
entregável sozinha: o app fica coerente ao fim dela, nunca meio migrado.

Base: `design_handoff_kango_ui/` (fora do repo, ver `.gitignore`) — 81 telas em
`Kango estilos.dc.html`, tokens em `Kango identidade visual.dc.html`.

**Regras que valem para todas as fases**
- A copy em português das telas está final. Não reescrever.
- Não existem vidas, energia, moedas nem loja. Errar não custa nada.
- Corte de nota: ≥70% verde, <40% vermelho, resto neutro (`scoreBadgeVariant`
  em `lib/utils.ts` / `toneDaNota` em `components/ui/metric-text.tsx`).
- Métrica sempre em `MetricText`. Palavra nunca entra em mono.
- Cor de matéria só como ponto de 7–10px, nunca como fundo de cartão.

---

## Fase 0 — Tokens e primitivos ✅ concluída

`globals.css`, `tailwind.config.ts`, `app/layout.tsx`, `components/ui/{inset-list,
capsule,segmented,gauge,glass-card,metric-text,topic-node}.tsx`, rota
`/design-system`.

Dois efeitos colaterais globais já em produção que as fases seguintes precisam
absorver: `font-sans` virou SF Pro/system-ui, e `font-medium`/`font-semibold`
foram remapeados de 500/600 para 510/590. **As telas atuais já estão num estado
visual intermediário** — é isso que dita a ordem abaixo.

---

## Duas decisões que mudam a ordem sugerida do README

**1. Desktop entra em cada fase, não numa fase própria.**
O README põe desktop como etapa 7. Mas este repo é desktop-first hoje
(`components/layout/Sidebar.tsx` de 158 linhas), e as telas de computador são
33 das 81. Deixar desktop por último manteria metade do produto quebrada por
todo o percurso. Cada fase abaixo entrega celular **e** computador da mesma
tela.

**2. A casca de navegação vem antes de qualquer tela.**
Todas as telas moram dentro dela, e o modelo muda: o design usa barra de abas
(Estudar · Biblioteca · Calendário · Perfil) no celular e sidebar de 296px no
desktop, enquanto o repo tem sidebar com lista de professores + `MobileNav`.
Migrar tela por tela dentro da casca velha é retrabalho garantido.

---

## Fase A — Casca

Papel de parede, barra de abas em vidro, sidebar de 296px, cabeçalhos.

| Arquivo | O que muda |
|---|---|
| `app/(app)/layout.tsx` | root com `.papel-de-parede` + `overflow-hidden` |
| `components/layout/MobileNav.tsx` | vira barra de abas em vidro .74, 4 itens fixos, 52px |
| `components/layout/Sidebar.tsx` | 296px, vidro .55, item ativo índigo a 10% + barra de 3px |
| `components/layout/PageHeader.tsx` | large title 34/41 |
| `components/layout/ProfessorHeader.tsx` | ponto de cor + título + segmented |
| `components/layout/Brand.tsx` | "Kango" em SF Pro 700 índigo, "K" em quadrado raio 12 |

**Novo:** rota `/perfil` (mesmo que só com o esqueleto), senão a quarta aba não
existe. A lista de professores sai da navegação e vira conteúdo de "Estudar".

**Risco:** é a única fase que toca o enquadramento de todas as telas de uma vez.
Sem dependência de backend — dá para fazer inteira hoje.

---

## Fase B — Estudar

Home com HUD de sequência e nível, próximo passo, meta de hoje, minhas matérias.

| Arquivo | O que muda |
|---|---|
| `app/(app)/dashboard/page.tsx` (235 l.) | vira "Estudar"; cards de matéria viram `InsetList` |
| `components/progress/ProgressStrip.tsx` | vira pílula de HUD em vidro .80 |
| `components/progress/TodayCard.tsx` | cartão de próximo passo, título 22/27 |
| `components/progress/MiniCalendar.tsx` | mantém, repagina |

Reaproveita `lib/global-next-step.ts` inteiro. `UserProgress` já entrega
`current_streak`, `longest_streak`, `level`, `xp_no_nivel`, `xp_do_nivel`.

**Falta no backend:** a meta diária do design é **2 lições**, e
`GET /progresso` entrega `daily_goal_xp` / `xp_hoje` (XP). Ou o design passa a
mostrar XP, ou `progresso.py` ganha contagem de lições do dia. Decisão de
produto — vale resolver antes de codar a tela.

---

## Fase C — Sala do professor

Visão geral, trilha de tópicos, progresso, plano de estudos.

| Arquivo | O que muda |
|---|---|
| `app/(app)/professor/[id]/page.tsx` (100 l.) | sala do professor |
| `app/(app)/professor/[id]/inicio/page.tsx` (269 l.) | progresso + plano de estudos |
| `components/professor/TopicTrail.tsx` (59 l.) | passa a usar `TopicNode` |
| `components/professor/NextStepCard.tsx` | cartão de próximo passo |
| `components/score/ScoreTrendChart.tsx` | recharts com tokens Kango |

**Falta no backend:** `TopicStat.status` só tem `dominado | pendente`. A trilha
com desbloqueio precisa de `bloqueado` + ordem dos tópicos, e o nó bloqueado
tem que dizer o motivo. Hoje o app não sabe quais tópicos existem antes do
primeiro quiz — `services/scoring.py` deriva tópicos das tentativas. A ponte
provável são os **módulos** (`routers/modulos.py` já gera capítulos com
`topics: string[]`): a ordem do módulo vira a ordem da trilha.

Sem isso, `TopicNode` fica com dois dos três estados.

---

## Fase D — Lição, resultado, revisão

O ciclo que gera todo o dado de domínio. A fase mais pesada.

| Arquivo | O que muda |
|---|---|
| `app/(app)/professor/[id]/quiz/page.tsx` (357 l.) | maior arquivo do app; lição + resultado |
| `components/quiz/QuizOption.tsx` | letra em círculo 24px, fundo tonal 10%, risco no errado |
| `components/quiz/QuizReview.tsx` | revisão da tentativa |
| `components/quiz/DifficultyPicker.tsx` | vira `Segmented` |
| `components/quiz/ModuleList.tsx` (137 l.) | vira `InsetList` |
| `.../quiz/historico/[activityId]/page.tsx` | revisão; tabela no desktop |

Modo foco no desktop: sem sidebar, só a tela e uma saída. `QuizGuardContext`
já resolve a saída com quiz em andamento.

**Falta no backend:** `QuizQuestion` não tem **fórmula** nem **trecho de origem
com arquivo e página** — e "toda resposta cita arquivo e página" é regra de
produto, não enfeite. `services/rag.py` já tem `search_chunks`; falta devolver a
citação junto da questão em `atividades.py`. O **combo de acertos** também não
existe em `ActivitySubmitResult` (é derivável no cliente).

---

## Fase E — Material e biblioteca

| Arquivo | O que muda |
|---|---|
| `app/(app)/professor/[id]/configurar/page.tsx` (211 l.) | upload guiado + indexação |
| `app/(app)/biblioteca/page.tsx` (153 l.) | agrupada por professor; tabela no desktop |
| `app/(app)/professor/novo/page.tsx` (106 l.) | novo professor |

**Falta no backend:** `DocumentItem` tem só `id/name/type/created_at`. O design
mostra **páginas, palavras lidas e status de indexação**, e o estado de erro
"PDF sem texto" é comum o bastante para ter tela própria. `services/pdf.py`
(`extract_text`) e `rag.py` (`index_document` já devolve nº de chunks) têm a
informação; falta persistir e expor.

---

## Fase F — Chat

| Arquivo | O que muda |
|---|---|
| `app/(app)/professor/[id]/chat/page.tsx` (10 l., stub) | conversa em tela cheia |
| **novo** painel de 372px (⌘J) | desktop, em vidro |

**Correção ao handoff:** o `github.md` diz que o chat está em
`backend/routers/chat.py` com `stream_chat`. **Não está** — `chat.py` tem só um
`/ping`. `stream_chat` existe em `services/claude.py:157` e `search_chunks` em
`rag.py:157`, mas **não há endpoint de chat**. Esta fase é metade backend.

Precisa: `POST /chat/send` com SSE, sessões/histórico, e citação obrigatória de
arquivo e página. Mais a recusa honesta quando a pergunta sai do material, com
as três saídas do design.

---

## Fase G — Gamificação e perfil

Perfil, todas as conquistas, configurações, compartilhar progresso.

**Falta no backend, quase tudo:** `achievements` (9 no total) não existe em
lugar nenhum — nem tabela, nem rota, nem tipo. `reminderTime` / `reminderEnabled`
(20:00) e `theme` idem. `progresso.py` tem `PATCH /meta`, que é o começo.

É a fase com maior proporção de backend novo. Se o objetivo for mostrar o Kango
funcionando antes, ela pode trocar de lugar com a F.

---

## Fase H — Onboarding, vazios e erros

Por último, quando o resto já tem forma — é a recomendação do README e ela se
sustenta: as telas de primeiro acesso só ficam certas depois que o destino delas
existe.

- Primeiro acesso (6 telas): boas-vindas → escolher matéria → ensinar o Kango →
  lendo seu material → permissão de notificação → professor pronto → diagnóstico.
- Vazios: sem matéria ainda, matéria sem material, biblioteca vazia, busca sem
  resultado.
- Erros: falha ao gerar, PDF sem texto, sequência perdida, offline. Todos com
  ícone em quadrado de 76px raio 26, título 30px, uma frase de causa, lista de
  saídas e código técnico em mono 12px no pé.
- Skeletons: pulsar de 1 a .45 em 2s, no tamanho final, só no que vem da API.

Componentes: `components/ui/{empty-state,inline-alert,skeleton}.tsx`.

---

## Fase avulsa — Conta

`app/(auth)/{login,criar-conta,recuperar-senha,atualizar-senha}/page.tsx` já
existem e são isolados (têm `layout.tsx` próprio, não herdam a casca). Podem
entrar em qualquer momento sem bloquear nada. Falta o botão da Apple e o "G"
colorido do brand kit do Google — a diretriz deles não aceita o monocromático.

---

## Backend, consolidado

O que precisa existir para as telas fecharem, em ordem de quem bloqueia mais:

| # | O quê | Bloqueia | Onde |
|---|---|---|---|
| 1 | Endpoint de chat com SSE + citações | Fase F inteira | `routers/chat.py` |
| 2 | Conquistas (tabela + rota + tipo) | Fase G | novo |
| 3 | Citação (arquivo + página) e fórmula na questão | Fase D | `routers/atividades.py`, `services/rag.py` |
| 4 | Tópico `bloqueado` + ordem da trilha | Fase C | `services/scoring.py`, `routers/modulos.py` |
| 5 | Metadados de documento (páginas, palavras, status) | Fase E | `routers/documentos.py`, `services/pdf.py` |
| 6 | Meta diária em lições, não em XP | Fase B | `routers/progresso.py` |
| 7 | `reminderTime` / `reminderEnabled` / `theme` | Fase G | `routers/progresso.py` |

Nada disso bloqueia a **Fase A**, que é puramente de frontend.

---

## Pendências de design

- **Modo escuro não foi desenhado.** As 81 telas são claras e os tokens Kango
  não respondem a `prefers-color-scheme`. O repo tem tema escuro completo nos
  tokens shadcn. Enquanto as duas camadas convivem, o escuro só vale nas telas
  ainda não migradas — e some quando a última migrar. Se for para manter, é
  preciso pedir as telas.
- **Ligas e ranking** foram descartados; a barra de abas é a de quatro itens.
- **Simulado, reforço e prova** seguem "em breve" (`prova`, `reforco`,
  `simulado`, `score` são stubs de 8 linhas).
- **Mascote e logo não existem.** Placeholder listrado a 135°; a marca é a
  palavra "Kango" em SF Pro 700 índigo.
