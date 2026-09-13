create or replace function public.sanitize_ai_discovered_event_image()
returns trigger
language plpgsql
set search_path to ''
as $function$
declare
  v text;
begin
  v := lower(coalesce(btrim(new.image_url), ''));

  if v = ''
     or v !~ '^https?://[^/]+/.+'
     or v like '%undefined%'
     or v like '%null%'
     or v like '%og-default%'
     or v like '%default-og%'
     or v like '%placeholder%'
     or v like '%/favicon%'
     or v like '%/logo.%'
     or v like '%/logo/%' then
    new.image_url := null;
    new.image_verified := false;
  end if;

  return new;
end;
$function$;

drop trigger if exists ai_discovered_event_image_sanitize on public.ai_discovered_events;
create trigger ai_discovered_event_image_sanitize
before insert or update of image_url on public.ai_discovered_events
for each row
execute function public.sanitize_ai_discovered_event_image();

update public.ai_discovered_events
set image_url = null,
    image_verified = false,
    review_notes = case
      when review_notes is null then 'Recovered image rejected as generic or malformed; SafariPlug category fallback will be used.'
      when review_notes like '%Official/source image recovered.%' then replace(review_notes, 'Official/source image recovered.', 'Recovered image rejected as generic or malformed; SafariPlug category fallback will be used.')
      else review_notes
    end,
    updated_at = now()
where image_url is not null
  and (
    lower(image_url) like '%undefined%'
    or lower(image_url) like '%null%'
    or lower(image_url) like '%og-default%'
    or lower(image_url) like '%default-og%'
    or lower(image_url) like '%placeholder%'
    or lower(image_url) like '%/favicon%'
    or lower(image_url) like '%/logo.%'
    or lower(image_url) like '%/logo/%'
    or lower(image_url) !~ '^https?://[^/]+/.+'
  );