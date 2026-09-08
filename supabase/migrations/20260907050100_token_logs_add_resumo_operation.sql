-- Resumo por módulo é uma feature nova (2026-09-07) que também chama o
-- Claude - precisa aparecer no /admin/financeiro/custos por operação
-- separado de "plan" (plano de estudos é recomendação de tópico fraco,
-- resumo é conteúdo do módulo - operações diferentes, custos diferentes).
alter table token_logs
  drop constraint token_logs_operation_check,
  add constraint token_logs_operation_check
    check (operation = any (array['quiz', 'module', 'plan', 'chat', 'resumo', 'other']));
