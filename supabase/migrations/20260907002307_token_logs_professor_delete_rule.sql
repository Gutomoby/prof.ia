-- Apagar um professor quebrava com "violates foreign key constraint
-- token_logs_professor_id_fkey" sempre que havia log de custo de IA
-- (quiz/módulo/plano) associado a ele — bastava ter gerado UM quiz.
--
-- Toda outra tabela que referencia professors (documents, chunks,
-- chat_sessions, activity_results, summaries, study_plans,
-- calendar_events, modules) já tem `on delete cascade`; só token_logs
-- ficou de fora quando foi criada em 20260811041446_admin_token_tracking.sql.
--
-- Cascade não é o certo aqui, ao contrário das outras: token_logs é
-- registro financeiro/auditoria (painel /admin/financeiro), agregado
-- principalmente por user_id — apagar o professor não deveria apagar
-- histórico de custo já incorrido. professor_id já é nullable (log de
-- plano/chat também não tem professor), então `set null` preserva o log
-- e só desassocia a matéria apagada.
alter table token_logs
  drop constraint token_logs_professor_id_fkey,
  add constraint token_logs_professor_id_fkey
    foreign key (professor_id) references professors (id) on delete set null;
