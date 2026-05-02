grant select, insert
on
  public.clients,
  public.bookings,
  public.booking_participants,
  public.booking_items,
  public.booking_assignments
to service_role;
