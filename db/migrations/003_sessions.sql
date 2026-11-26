-- Hello Capo Beach: stay signed in
-- After a neighbor signs in with their emailed code, the app remembers that
-- device for 90 days. The browser holds a random token in a cookie that page
-- scripts cannot read. Only a fingerprint (hash) of the token is stored here,
-- so a copy of this table cannot be used to sign in as anyone.
-- Safe to run more than once. No GO separators.

if object_id('dbo.sessions') is null
create table dbo.sessions (
  id           uniqueidentifier not null default newid() primary key,
  token_hash   varbinary(32)  not null unique,
  auth_subject nvarchar(128)  not null,
  email        nvarchar(254)  null,
  user_agent   nvarchar(200)  null,
  created_at   datetime2(0)   not null default sysutcdatetime(),
  last_seen_at datetime2(0)   not null default sysutcdatetime(),
  expires_at   datetime2(0)   not null,
  revoked_at   datetime2(0)   null
);

if not exists (select 1 from sys.indexes where name = 'sessions_subject_idx')
  create index sessions_subject_idx on dbo.sessions (auth_subject);

-- Deleting an account also signs that person out everywhere.
exec(N'
create or alter procedure dbo.delete_member @member_id uniqueidentifier as
begin
  set nocount on;
  set xact_abort on;
  begin transaction;

  delete from dbo.sessions
   where auth_subject = (select auth_subject from dbo.members where id = @member_id);

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
