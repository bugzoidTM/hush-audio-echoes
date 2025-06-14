
-- Create storage bucket for audio files
insert into storage.buckets (id, name, public) 
values ('audio-files', 'audio-files', true);

-- Create RLS policies for storage
create policy "Allow authenticated users to upload audio files" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'audio-files');

create policy "Allow public access to audio files" on storage.objects
  for select to public
  using (bucket_id = 'audio-files');

create policy "Allow users to delete their own audio files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'audio-files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Enable RLS on all tables
alter table profiles enable row level security;
alter table audio_posts enable row level security;
alter table likes enable row level security;

-- Create RLS policies for profiles
create policy "Users can view all profiles" on profiles
  for select to authenticated
  using (true);

create policy "Users can update their own profile" on profiles
  for update to authenticated
  using (auth.uid() = id);

-- Create RLS policies for audio_posts
create policy "Users can view all active audio posts" on audio_posts
  for select to authenticated
  using (status = 'active');

create policy "Users can create their own audio posts" on audio_posts
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own audio posts" on audio_posts
  for update to authenticated
  using (auth.uid() = user_id);

-- Create RLS policies for likes
create policy "Users can view all likes" on likes
  for select to authenticated
  using (true);

create policy "Users can create likes" on likes
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users can delete their own likes" on likes
  for delete to authenticated
  using (auth.uid() = user_id);
