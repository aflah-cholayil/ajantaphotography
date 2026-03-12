do $$
declare
  v_user_id uuid;
  v_email text := 'aflahcholayil@gmail.com';
  v_temp_password text := 'Owner@2026!Ajanta';
begin
  select id into v_user_id
  from auth.users
  where lower(email) = lower(v_email)
  limit 1;

  if v_user_id is null then
    v_user_id := gen_random_uuid();

    insert into auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token
    )
    values (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      v_email,
      extensions.crypt(v_temp_password, extensions.gen_salt('bf')),
      now(),
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
      jsonb_build_object('name', split_part(v_email, '@', 1), 'role', 'owner'),
      now(),
      now(),
      '',
      ''
    );

    if not exists (
      select 1
      from auth.identities
      where provider = 'email'
        and provider_id = v_user_id::text
    ) then
      insert into auth.identities (
        id,
        user_id,
        identity_data,
        provider,
        provider_id,
        last_sign_in_at,
        created_at,
        updated_at
      )
      values (
        gen_random_uuid(),
        v_user_id,
        jsonb_build_object('sub', v_user_id::text, 'email', v_email),
        'email',
        v_user_id::text,
        now(),
        now(),
        now()
      );
    end if;
  end if;

  update public.profiles
  set
    name = split_part(v_email, '@', 1),
    email = v_email,
    must_change_password = true
  where user_id = v_user_id;

  if not found then
    insert into public.profiles (user_id, name, email, must_change_password)
    values (v_user_id, split_part(v_email, '@', 1), v_email, true);
  end if;

  update public.user_roles
  set role = 'owner'::public.app_role
  where user_id = v_user_id;

  if not found then
    insert into public.user_roles (user_id, role)
    values (v_user_id, 'owner'::public.app_role);
  end if;
end $$;
