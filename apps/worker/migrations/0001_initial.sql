create table if not exists users (
  id text primary key,
  github_user_id text not null unique,
  github_login text not null,
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp
);

create table if not exists github_installations (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  installation_id text not null unique,
  account_login text not null,
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp
);

create table if not exists repositories (
  id text primary key,
  installation_id text not null references github_installations(id) on delete cascade,
  github_repository_id text not null unique,
  owner text not null,
  name text not null,
  default_branch text not null default 'main',
  visibility text not null,
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp
);

create table if not exists pr_flow_sessions (
  id text primary key,
  user_id text references users(id) on delete set null,
  repository_id text references repositories(id) on delete set null,
  github_installation_id text,
  repository text not null,
  branch text not null,
  base_branch text not null default 'main',
  branch_goal_summary text,
  status text not null default 'active',
  pr_url text,
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp
);

create table if not exists ai_actions (
  id text primary key,
  session_id text not null references pr_flow_sessions(id) on delete cascade,
  action_type text not null,
  model_provider text not null,
  model_id text,
  result_summary text,
  created_at text not null default current_timestamp
);

create table if not exists patch_proposals (
  id text primary key,
  session_id text not null references pr_flow_sessions(id) on delete cascade,
  title text not null,
  status text not null,
  safety_status text not null,
  created_at text not null default current_timestamp
);

create table if not exists safety_gate_results (
  id text primary key,
  session_id text not null references pr_flow_sessions(id) on delete cascade,
  tests_status text not null,
  runtime_status text not null,
  risk_review_status text not null,
  unresolved_warning_count integer not null default 0,
  created_at text not null default current_timestamp
);

create table if not exists created_prs (
  id text primary key,
  session_id text not null references pr_flow_sessions(id) on delete cascade,
  github_pr_number integer not null,
  pr_url text not null,
  title text not null,
  created_at text not null default current_timestamp
);

create index if not exists idx_pr_flow_sessions_user_id on pr_flow_sessions(user_id);
create index if not exists idx_pr_flow_sessions_repository_id on pr_flow_sessions(repository_id);
create index if not exists idx_ai_actions_session_id on ai_actions(session_id);
create index if not exists idx_patch_proposals_session_id on patch_proposals(session_id);
create index if not exists idx_safety_gate_results_session_id on safety_gate_results(session_id);
