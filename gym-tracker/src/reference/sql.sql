-- Users
create table users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);
insert into users (name) values ('Andy'), ('Ali');

-- Exercises (master list)
create table exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  default_tempo text,
  media_url text,
  cue_text text,
  created_at timestamptz default now()
);

-- Schedules (user + day + ordered exercises)
create table schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  day_of_week text not null, -- 'Monday', 'Tuesday', etc.
  exercise_id uuid references exercises(id),
  sort_order integer not null,
  created_at timestamptz default now()
);

-- Exercise config per user
create table exercise_config (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  exercise_id uuid references exercises(id),
  sets integer not null default 3,
  rep_target text not null default '8-12', -- e.g. '8', '8-12', 'Fail'
  tempo text,
  is_main_lift boolean default false,
  rest_seconds integer default 90,
  created_at timestamptz default now(),
  unique(user_id, exercise_id)
);

-- Main lift progression (Andy's 1RM-based lifts)
create table main_lift_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  exercise_id uuid references exercises(id),
  one_rep_max numeric not null,
  cycle_week integer not null default 1, -- 1=8-rep, 2=6-rep, 3=4-rep, 4=deload
  created_at timestamptz default now(),
  unique(user_id, exercise_id)
);

-- Accessory working weights
create table accessory_weights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  exercise_id uuid references exercises(id),
  working_weight numeric not null default 0,
  increase_suggested boolean default false,
  created_at timestamptz default now(),
  unique(user_id, exercise_id)
);

-- Workout logs
create table workout_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  exercise_id uuid references exercises(id),
  logged_at timestamptz default now(),
  set_number integer not null,
  reps_completed integer,
  weight_used numeric
);

-- Enable Row Level Security but allow all for now (no auth needed)
alter table users enable row level security;
alter table exercises enable row level security;
alter table schedules enable row level security;
alter table exercise_config enable row level security;
alter table main_lift_progress enable row level security;
alter table accessory_weights enable row level security;
alter table workout_logs enable row level security;

create policy "Allow all" on users for all using (true);
create policy "Allow all" on exercises for all using (true);
create policy "Allow all" on schedules for all using (true);
create policy "Allow all" on exercise_config for all using (true);
create policy "Allow all" on main_lift_progress for all using (true);
create policy "Allow all" on accessory_weights for all using (true);
create policy "Allow all" on workout_logs for all using (true);