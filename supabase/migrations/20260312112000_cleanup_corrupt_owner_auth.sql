do $$
declare
  v_email text := 'aflahcholayil@gmail.com';
  v_user_ids text[];
begin
  select coalesce(array_agg(id::text), array[]::text[])
  into v_user_ids
  from auth.users
  where lower(email) = lower(v_email);

  delete from auth.mfa_factors
  where user_id::text = any(v_user_ids);

  delete from auth.sessions
  where user_id::text = any(v_user_ids);

  delete from auth.refresh_tokens
  where user_id::text = any(v_user_ids);

  delete from auth.identities
  where user_id::text = any(v_user_ids)
  or lower(coalesce(identity_data->>'email', '')) = lower(v_email);

  delete from public.user_roles
  where user_id::text = any(v_user_ids);

  delete from public.profiles
  where user_id::text = any(v_user_ids);

  delete from auth.users
  where lower(email) = lower(v_email);
end $$;
