do $$
declare
  v_email text := 'aflahcholayil@gmail.com';
  v_user_id uuid;
begin
  select id into v_user_id
  from auth.users
  where lower(email) = lower(v_email)
  limit 1;

  if v_user_id is null then
    raise exception 'Owner user not found for %', v_email;
  end if;

  update auth.users
  set
    email_confirmed_at = coalesce(email_confirmed_at, now()),
    updated_at = now()
  where id = v_user_id;

  update public.user_roles
  set role = 'owner'::public.app_role
  where user_id = v_user_id;

  if not found then
    insert into public.user_roles (user_id, role)
    values (v_user_id, 'owner'::public.app_role);
  end if;

  update public.profiles
  set
    email = v_email,
    name = coalesce(name, split_part(v_email, '@', 1)),
    must_change_password = false
  where user_id = v_user_id;

  if not found then
    insert into public.profiles (user_id, name, email, must_change_password)
    values (v_user_id, split_part(v_email, '@', 1), v_email, false);
  end if;
end $$;
