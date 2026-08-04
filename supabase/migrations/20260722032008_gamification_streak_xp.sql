create table if not exists user_progress (
  user_id             uuid primary key references auth.users,
  current_streak      int not null default 0,
  longest_streak      int not null default 0,
  last_activity_date  date,
  total_xp            int not null default 0,
  updated_at          timestamptz default now()
);

alter table user_progress enable row level security;

drop policy if exists "user sees own progress" on user_progress;
create policy "user sees own progress" on user_progress
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
;
