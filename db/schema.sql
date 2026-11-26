-- Hello Capo Beach: version 1 database for Azure SQL Database
-- Replaces the two Supabase files (seed_neighborhoods.sql, schema_v1.sql).
-- Safe to run more than once. No GO separators, so it runs in the Azure portal query editor.
--
-- Access rules are NOT in this file. On Azure they live in the API (Azure Functions).
-- The API connects with one login and enforces: nobody sees anything until an admin approves them.

-- ---------------------------------------------------------------
-- 1. Neighborhoods, streets, landmarks
-- ---------------------------------------------------------------
if object_id('dbo.neighborhoods') is null
create table dbo.neighborhoods (
  id             smallint      not null primary key,
  slug           varchar(40)   not null unique,
  name           nvarchar(80)  not null,
  name_confirmed bit           not null default 0,  -- 0 = working label, not yet confirmed
  is_open        bit           not null default 0,  -- 1 = shows on the sign-up pick list
  sort_order     smallint      not null
);

if object_id('dbo.streets') is null
create table dbo.streets (
  id              int identity(1,1) primary key,
  neighborhood_id smallint      not null references dbo.neighborhoods (id),
  name            nvarchar(80)  not null unique,
  city            nvarchar(60)  null,
  zip             varchar(10)   null,
  label_verified  bit           not null default 1   -- 0 = map label was unclear, hidden from sign-up
);

if object_id('dbo.landmarks') is null
create table dbo.landmarks (
  id      int identity(1,1) primary key,
  name    nvarchar(120) not null unique,
  kind    varchar(20)   not null,
  address nvarchar(200) null
);

-- ---------------------------------------------------------------
-- 2. Members and invite codes
-- ---------------------------------------------------------------
if object_id('dbo.invite_codes') is null
create table dbo.invite_codes (
  code       nvarchar(40)  not null primary key,
  note       nvarchar(200) null,
  is_active  bit           not null default 1,
  created_at datetime2(0)  not null default sysutcdatetime()
);

if object_id('dbo.members') is null
create table dbo.members (
  id                uniqueidentifier not null default newid() primary key,
  auth_subject      nvarchar(128) not null unique,   -- the sign-in account id from Entra External ID
  email             nvarchar(254) not null unique,
  full_name         nvarchar(80)  not null,
  street_id         int           null references dbo.streets (id),
  street_other      nvarchar(80)  null,
  house_number      nvarchar(12)  not null,
  phone             nvarchar(30)  null,
  -- Privacy switches. Name and street always show to approved neighbors.
  show_phone        bit not null default 0,
  show_email        bit not null default 0,
  show_house_number bit not null default 0,
  in_directory      bit not null default 0,
  invite_code       nvarchar(40)  not null,
  status            varchar(10)   not null default 'pending'
                    check (status in ('pending', 'approved', 'declined', 'removed')),
  role              varchar(10)   not null default 'resident'
                    check (role in ('resident', 'admin')),
  created_at        datetime2(0)  not null default sysutcdatetime(),
  approved_at       datetime2(0)  null,
  approved_by       uniqueidentifier null references dbo.members (id),
  constraint members_has_street check (street_id is not null or street_other is not null),
  constraint members_name_length check (len(ltrim(rtrim(full_name))) >= 2)
);

-- ---------------------------------------------------------------
-- 3. Feed, comments, events, marketplace
-- ---------------------------------------------------------------
-- photo_paths holds a JSON list of Blob Storage paths, for example ["abc/cat.jpg"].
if object_id('dbo.posts') is null
create table dbo.posts (
  id          uniqueidentifier not null default newid() primary key,
  author_id   uniqueidentifier not null references dbo.members (id),
  category    varchar(20)   not null default 'general'
              check (category in ('general', 'safety', 'lost_found', 'recommendations')),
  title       nvarchar(140) not null,
  body        nvarchar(max) null,
  photo_paths nvarchar(max) not null default '[]' check (isjson(photo_paths) = 1),
  is_pinned   bit           not null default 0,
  created_at  datetime2(0)  not null default sysutcdatetime(),
  removed_at  datetime2(0)  null,
  removed_by  uniqueidentifier null references dbo.members (id)
);

-- One level of replies. parent_id is null for a top-level comment.
if object_id('dbo.comments') is null
create table dbo.comments (
  id         uniqueidentifier not null default newid() primary key,
  post_id    uniqueidentifier not null references dbo.posts (id) on delete cascade,
  author_id  uniqueidentifier not null references dbo.members (id),
  parent_id  uniqueidentifier null references dbo.comments (id),
  body       nvarchar(2000) not null,
  created_at datetime2(0)   not null default sysutcdatetime(),
  removed_at datetime2(0)   null,
  removed_by uniqueidentifier null references dbo.members (id)
);

if object_id('dbo.events') is null
create table dbo.events (
  id         uniqueidentifier not null default newid() primary key,
  created_by uniqueidentifier not null references dbo.members (id),
  title      nvarchar(140) not null,
  details    nvarchar(max) null,
  place      nvarchar(200) not null,
  starts_at  datetimeoffset(0) not null,
  created_at datetime2(0)  not null default sysutcdatetime(),
  removed_at datetime2(0)  null,
  removed_by uniqueidentifier null references dbo.members (id)
);

if object_id('dbo.event_rsvps') is null
create table dbo.event_rsvps (
  event_id   uniqueidentifier not null references dbo.events (id) on delete cascade,
  member_id  uniqueidentifier not null references dbo.members (id),
  created_at datetime2(0) not null default sysutcdatetime(),
  primary key (event_id, member_id)
);

if object_id('dbo.listings') is null
create table dbo.listings (
  id            uniqueidentifier not null default newid() primary key,
  seller_id     uniqueidentifier not null references dbo.members (id),
  kind          varchar(10)   not null check (kind in ('for_sale', 'free', 'wanted')),
  title         nvarchar(140) not null,
  details       nvarchar(max) null,
  price_cents   int           null check (price_cents is null or price_cents >= 0),
  photo_paths   nvarchar(max) not null default '[]' check (isjson(photo_paths) = 1),
  -- Shown on the listing so a buyer can reach the seller. At least one is required.
  contact_phone nvarchar(30)  null,
  contact_email nvarchar(254) null,
  is_sold       bit           not null default 0,
  created_at    datetime2(0)  not null default sysutcdatetime(),
  removed_at    datetime2(0)  null,
  removed_by    uniqueidentifier null references dbo.members (id),
  constraint listings_has_contact check (contact_phone is not null or contact_email is not null)
);

if not exists (select 1 from sys.indexes where name = 'posts_feed_idx')
  create index posts_feed_idx on dbo.posts (is_pinned desc, created_at desc);
if not exists (select 1 from sys.indexes where name = 'comments_post_idx')
  create index comments_post_idx on dbo.comments (post_id, created_at);
if not exists (select 1 from sys.indexes where name = 'events_start_idx')
  create index events_start_idx on dbo.events (starts_at);
if not exists (select 1 from sys.indexes where name = 'listings_feed_idx')
  create index listings_feed_idx on dbo.listings (kind, created_at desc);
if not exists (select 1 from sys.indexes where name = 'members_status_idx')
  create index members_status_idx on dbo.members (status);

-- ---------------------------------------------------------------
-- 4. Views the API reads
-- ---------------------------------------------------------------
-- Sign-up pick list. Picking a street sets the neighborhood.
exec(N'
create or alter view dbo.signup_street_options as
select s.id as street_id, s.name as street, n.id as neighborhood_id, n.name as neighborhood, n.sort_order
from dbo.streets s
join dbo.neighborhoods n on n.id = s.neighborhood_id
where n.is_open = 1 and s.label_verified = 1;
');

-- What neighbors see of each other. Contact details are blank unless switched on.
-- The API must only serve this to approved members.
exec(N'
create or alter view dbo.neighbors as
select m.id,
       m.full_name,
       coalesce(s.name, m.street_other) as street,
       n.name as neighborhood,
       m.in_directory,
       case when m.show_house_number = 1 then m.house_number end as house_number,
       case when m.show_phone = 1 then m.phone end as phone,
       case when m.show_email = 1 then m.email end as email,
       cast(case when m.role = ''admin'' then 1 else 0 end as bit) as is_admin
from dbo.members m
left join dbo.streets s on s.id = m.street_id
left join dbo.neighborhoods n on n.id = s.neighborhood_id
where m.status = ''approved'';
');

-- ---------------------------------------------------------------
-- 5. Delete my account (removes the member and everything they posted)
-- ---------------------------------------------------------------
exec(N'
create or alter procedure dbo.delete_member @member_id uniqueidentifier as
begin
  set nocount on;
  set xact_abort on;
  begin transaction;

  delete from dbo.event_rsvps
   where member_id = @member_id
      or event_id in (select id from dbo.events where created_by = @member_id);

  -- replies first, then the comments they hang from
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

  delete from dbo.members where id = @member_id;
  commit transaction;
end
');

-- ---------------------------------------------------------------
-- 6. Starting data. Only Harbor Estates is open at launch.
-- ---------------------------------------------------------------
insert into dbo.neighborhoods (id, slug, name, name_confirmed, is_open, sort_order)
select v.id, v.slug, v.name, v.name_confirmed, v.is_open, v.sort_order
from (values
  (1, 'harbor-estates', N'Harbor Estates',        1, 1, 1),
  (2, 'sunset-park',    N'Sunset Park area',      0, 0, 2),
  (3, 'la-quinta',      N'La Quinta',             0, 0, 3),
  (4, 'reservoir-east', N'East of the reservoir', 0, 0, 4)
) v (id, slug, name, name_confirmed, is_open, sort_order)
where not exists (select 1 from dbo.neighborhoods n where n.id = v.id);

insert into dbo.streets (neighborhood_id, name, city, zip, label_verified)
select v.neighborhood_id, v.name, v.city, v.zip, v.label_verified
from (values
  (1, N'Calle Abril',      N'San Clemente', '92673', 1),
  (1, N'Calle Andalucia',  N'San Clemente', '92673', 1),
  (1, N'Calle Bienvenido', N'San Clemente', '92673', 1),
  (1, N'Calle Juno',       N'San Clemente', '92673', 1),
  (1, N'Calle Los Alamos', N'San Clemente', '92673', 1),
  (1, N'Calle Mayo',       N'San Clemente', '92673', 1),
  (1, N'Calle Monterey',   N'San Clemente', '92673', 1),
  (1, N'Calle Real',       N'San Clemente', '92673', 1),
  (1, N'Calle Velez',      N'San Clemente', '92673', 1),
  (1, N'Paseo Activo',     N'San Clemente', '92673', 1),
  (1, N'Via Del Campo',    N'San Clemente', '92673', 1),
  (1, N'Via Manzana',      N'San Clemente', '92673', 1),
  (1, N'Via Sacramento',   N'San Clemente', '92673', 1),
  (1, N'Via Velez',        N'San Clemente', '92673', 1),
  (2, N'Calle Alta Vista', null, null, 1),
  (2, N'Calle Carmelita',  null, null, 1),
  (2, N'Calle Juanita',    null, null, 1),
  (2, N'Calle Naranja',    null, null, 1),
  (2, N'Calle Paloma',     null, null, 1),
  (2, N'Calle Portola',    null, null, 1),
  (2, N'Camino El Molino', null, null, 1),
  (2, N'Calle Toga',       null, null, 0),
  (3, N'Calle La Quinta',  null, null, 1),
  (3, N'Calle Perlino',    null, null, 0),
  (4, N'Calle Agua',       null, null, 1),
  (4, N'Campanilla',       null, null, 1),
  (4, N'Cresta Del Sol',   null, null, 1),
  (4, N'Madrigal',         null, null, 1),
  (4, N'Marbella',         null, null, 1),
  (4, N'Mariana',          null, null, 1),
  (4, N'Merced',           null, null, 1),
  (4, N'Tesoro',           null, null, 1),
  (4, N'Mar Del Rey',      null, null, 0),
  (4, N'Via Cancha',       null, null, 0),
  (4, N'Via Montes',       null, null, 0)
) v (neighborhood_id, name, city, zip, label_verified)
where not exists (select 1 from dbo.streets s where s.name = v.name);

insert into dbo.landmarks (name, kind, address)
select v.name, v.kind, v.address
from (values
  (N'Sunset Park',                 'park',       N'34345 Calle Naranja, Dana Point, CA 92624'),
  (N'Calle Paloma Park',           'park',       null),
  (N'Acu Canyon Park',             'park',       N'27999 Camino Las Ramblas, San Juan Capistrano, CA 92675'),
  (N'Pines Park',                  'park',       N'34941 Camino Capistrano, Capistrano Beach, CA 92624'),
  (N'Palisades Reservoir',         'open space', null),
  (N'Folsom Ridge',                'open space', null),
  (N'Reservoir Canyon',            'open space', null),
  (N'Palisades Elementary School', 'school',     null)
) v (name, kind, address)
where not exists (select 1 from dbo.landmarks l where l.name = v.name);

-- ---------------------------------------------------------------
-- 7. After running this file
-- ---------------------------------------------------------------
-- a) Run db/migrations/002_member_invites.sql (member invites, 5 per member).
-- b) Create your own first invite code so you can sign up (pick your own word):
--      insert into dbo.invite_codes (code, note) values (N'YOURCODE', N'First admin');
-- c) Sign up through the app once, then make yourself the first admin:
--      update dbo.members set status = 'approved', role = 'admin', approved_at = sysutcdatetime()
--      where email = N'you@example.com';
