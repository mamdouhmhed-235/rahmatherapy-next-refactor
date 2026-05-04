create policy "Authenticated staff can read own staff_profile status"
on public.staff_profiles for select
to authenticated
using (auth_user_id = auth.uid());
