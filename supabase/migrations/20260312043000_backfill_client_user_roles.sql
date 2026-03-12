insert into public.user_roles (user_id, role)
select c.user_id, 'client'::public.app_role
from public.clients c
left join public.user_roles ur on ur.user_id = c.user_id
where c.user_id is not null
  and ur.user_id is null;
