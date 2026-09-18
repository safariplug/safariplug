-- Restrict privileged driver transfer RPCs to server-side service role only.
-- Traveler/driver-facing actions must go through authenticated server routes that verify actor ownership.

revoke execute on function public.respond_to_driver_transfer_request(uuid,text) from authenticated;
revoke execute on function public.cancel_driver_transfer_request(uuid) from authenticated;

grant execute on function public.respond_to_driver_transfer_request(uuid,text) to service_role;
grant execute on function public.cancel_driver_transfer_request(uuid) to service_role;
