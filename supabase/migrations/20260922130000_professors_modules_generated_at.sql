-- Marca quando a trilha (modules) foi gerada pela última vez para um
-- professor, comparado com o documento mais recente enviado — permite pular
-- a chamada ao Sonnet (Cloud Run) quando não há material novo desde a
-- última geração, em vez de reprocessar o material inteiro à toa.
alter table public.professors
  add column if not exists modules_generated_at timestamptz;
