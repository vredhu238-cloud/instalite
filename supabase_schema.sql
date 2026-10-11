-- InstaLite schema. Supabase > SQL Editor > New query > paste > Run

create table profiles(
  id uuid primary key references auth.users on delete cascade,
  username text unique not null check (username ~ '^[a-z0-9_.]{3,20}$'),
  bio text default '',
  created_at timestamptz default now());

create table posts(
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  image_url text not null,
  caption text default '',
  filter text default 'Normal',
  created_at timestamptz default now());

create table likes(
  post_id bigint references posts(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (post_id, user_id));

create table comments(
  id bigint generated always as identity primary key,
  post_id bigint not null references posts(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  body text not null check (length(body) between 1 and 200),
  created_at timestamptz default now());

create table follows(
  follower_id uuid references profiles(id) on delete cascade,
  following_id uuid references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id));

-- Signup hote hi profile apne aap ban jaye
create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles(id, username) values (new.id, lower(new.raw_user_meta_data->>'username'));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- Row Level Security: sab dekh sakte hain, likhna sirf apna
alter table profiles enable row level security;
alter table posts    enable row level security;
alter table likes    enable row level security;
alter table comments enable row level security;
alter table follows  enable row level security;

create policy "read profiles" on profiles for select using (true);
create policy "read posts"    on posts    for select using (true);
create policy "read likes"    on likes    for select using (true);
create policy "read comments" on comments for select using (true);
create policy "read follows"  on follows  for select using (true);

create policy "edit own profile" on profiles for update using (id = auth.uid());
create policy "add own post"     on posts    for insert with check (user_id = auth.uid());
create policy "delete own post"  on posts    for delete using (user_id = auth.uid());
create policy "add own like"     on likes    for insert with check (user_id = auth.uid());
create policy "delete own like"  on likes    for delete using (user_id = auth.uid());
create policy "add own comment"  on comments for insert with check (user_id = auth.uid());
create policy "delete own comment" on comments for delete using (user_id = auth.uid());
create policy "follow"           on follows  for insert with check (follower_id = auth.uid());
create policy "unfollow"         on follows  for delete using (follower_id = auth.uid());

-- Photo storage (public bucket "posts", har user sirf apne folder mein upload kare)
insert into storage.buckets(id, name, public) values ('posts', 'posts', true) on conflict do nothing;
create policy "view photos" on storage.objects for select using (bucket_id = 'posts');
create policy "upload own photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'posts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "delete own photos" on storage.objects for delete to authenticated
  using (bucket_id = 'posts' and (storage.foldername(name))[1] = auth.uid()::text);
