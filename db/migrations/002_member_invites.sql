-- Hello Capo Beach: member invites
-- Every approved member can hand out up to 5 invite codes. Admins have no limit.
-- Each code works for one sign-up and records who gave it out.
-- The 5-code limit is enforced in the API, not here.
-- Safe to run more than once. No GO separators.

if col_length('dbo.invite_codes', 'created_by') is null
  alter table dbo.invite_codes add created_by uniqueidentifier null
    constraint fk_invite_codes_created_by references dbo.members (id);

if col_length('dbo.invite_codes', 'used_by') is null
  alter table dbo.invite_codes add used_by uniqueidentifier null
    constraint fk_invite_codes_used_by references dbo.members (id);

if col_length('dbo.invite_codes', 'used_at') is null
  alter table dbo.invite_codes add used_at datetime2(0) null;

exec(N'
if not exists (select 1 from sys.indexes where name = ''invite_codes_created_by_idx'')
  create index invite_codes_created_by_idx on dbo.invite_codes (created_by);
');

-- Who invited whom, for the admin screen.
exec(N'
create or alter view dbo.member_invites as
select c.code,
       c.created_by as inviter_id,
       i.full_name  as inviter_name,
       c.used_by    as invitee_id,
       u.full_name  as invitee_name,
       c.used_at,
       c.is_active,
       c.created_at
from dbo.invite_codes c
left join dbo.members i on i.id = c.created_by
left join dbo.members u on u.id = c.used_by;
');

-- Deleting an account now also clears that member from invite records
-- and switches off any codes they had not yet given out.
exec(N'
create or alter procedure dbo.delete_member @member_id uniqueidentifier as
begin
  set nocount on;
  set xact_abort on;
  begin transaction;

  delete from dbo.event_rsvps
   where member_id = @member_id
      or event_id in (select id from dbo.events where created_by = @member_id);

  delete from dbo.comments
   where parent_id is not null
     and (author_id = @member_id
          or parent_id in (select id from dbo.comments where author_id = @member_id)
          or post_id in (select id from dbo.posts where author_id = @member_id));
  delete from dbo.comments
   where author_id = @member_id
      or post_id in (select id from dbo.posts where author_id = @member_id);

  delete from dbo.posts    where author_id  = @member_id;
  delete from dbo.events   where created_by = @member_id;
  delete from dbo.listings where seller_id  = @member_id;

  update dbo.posts    set removed_by  = null where removed_by  = @member_id;
  update dbo.comments set removed_by  = null where removed_by  = @member_id;
  update dbo.events   set removed_by  = null where removed_by  = @member_id;
  update dbo.listings set removed_by  = null where removed_by  = @member_id;
  update dbo.members  set approved_by = null where approved_by = @member_id;

  update dbo.invite_codes set is_active = 0 where created_by = @member_id and used_by is null;
  update dbo.invite_codes set created_by = null where created_by = @member_id;
  update dbo.invite_codes set used_by = null where used_by = @member_id;

  delete from dbo.members where id = @member_id;
  commit transaction;
end
');
