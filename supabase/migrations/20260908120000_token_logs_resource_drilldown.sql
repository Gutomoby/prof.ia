-- Custo por atividade individual (drill-down): token_logs não tinha nenhuma
-- referência à linha que disparou a chamada (activity_results/summaries/
-- chat_sessions) — só dava pra ver custo agregado por operação/modelo/dia,
-- nunca "quanto custou ESTE quiz" ou "quanto essa sessão de chat já gastou".
--
-- Sem FK de propósito: é polimórfico (aponta pra activity_results.id em
-- quiz/prova, summaries.id em resumo, chat_sessions.id em chat) — a coluna
-- `operation` já diz qual tabela. Uma FK exigiria 3 colunas nullable
-- separadas pra ganhar uma garantia que não vale muito aqui: o log é
-- informacional (a própria função já trata falha de log como não-crítica).
alter table token_logs add column resource_id uuid null;

comment on column token_logs.resource_id is
  'Aponta pra activity_results.id (quiz/prova), summaries.id (resumo) ou chat_sessions.id (chat) — sem FK, polimórfico. Nulo em logs antigos (antes desta coluna existir).';

create index if not exists token_logs_resource_id_idx
  on token_logs (resource_id)
  where resource_id is not null;

-- "prova" nunca esteve na lista — routers/atividades.py::generateJsonClaude
-- sempre logou como "quiz" mesmo quando a atividade era prova, então hoje é
-- impossível separar o custo de uma coisa da outra nos relatórios.
alter table token_logs drop constraint token_logs_operation_check;
alter table token_logs add constraint token_logs_operation_check
  check (operation = any (array['quiz', 'prova', 'module', 'plan', 'chat', 'resumo', 'other']));
