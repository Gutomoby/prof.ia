-- "Resumo" do produto agora é por módulo da trilha, não por tópico livre —
-- summaries já existia (criada antes de modules existir como tabela formal)
-- mas só tinha `topic` texto solto, sem ligação real com um módulo.
alter table summaries
  add column module_id uuid references modules (id) on delete cascade;

create index summaries_module_id_idx on summaries (module_id);
