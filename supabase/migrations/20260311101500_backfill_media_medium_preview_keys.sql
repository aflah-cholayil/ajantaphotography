update public.media
set
  s3_medium_key = case
    when s3_medium_key is not null then s3_medium_key
    when s3_key is null or btrim(s3_key) = '' then null
    when s3_key ~ '^[^/]+/originals/' then
      regexp_replace(replace(s3_key, '/originals/', '/medium/'), '\.[^.]+$', '.webp')
    when s3_key ~ '^[^/]+/' then
      regexp_replace(regexp_replace(s3_key, '^([^/]+)/', '\1/medium/'), '\.[^.]+$', '.webp')
    else null
  end,
  s3_preview_key = case
    when s3_preview_key is not null then s3_preview_key
    when s3_key is null or btrim(s3_key) = '' then null
    when s3_key ~ '^[^/]+/originals/' then
      regexp_replace(replace(s3_key, '/originals/', '/previews/'), '\.[^.]+$', '.webp')
    when s3_key ~ '^[^/]+/' then
      regexp_replace(regexp_replace(s3_key, '^([^/]+)/', '\1/previews/'), '\.[^.]+$', '.webp')
    else null
  end
where
  s3_key is not null
  and (s3_medium_key is null or s3_preview_key is null);

