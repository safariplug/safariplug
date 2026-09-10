-- Quarantine previously approved AI-scout events that fail the same minimum fields
-- required by the publishing gate. This is intentionally reversible: records remain
-- in the events table for admin review rather than being deleted.
update public.events
set status = 'pending',
    verified = false,
    verified_at = null
where source_type = 'AI_SCOUT'
  and status = 'approved'
  and start_at >= now()
  and (
    title is null or btrim(title) = ''
    or description is null or btrim(description) = ''
    or venue_name is null or btrim(venue_name) = ''
    or source_url is null or btrim(source_url) = ''
  );
