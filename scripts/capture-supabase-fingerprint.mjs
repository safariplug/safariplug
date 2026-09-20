import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const outDir = process.argv[2];
if (!outDir) {
  console.error("Usage: node scripts/capture-supabase-fingerprint.mjs <output-dir>");
  process.exit(2);
}

const dbUrl = process.env.DB_URL;
if (!dbUrl) {
  console.error("DB_URL is required.");
  process.exit(2);
}

const projectRef = process.env.BASELINE_PROJECT_REF || "safcizxahjqassrwhrup";
const capturedAt = new Date().toISOString().slice(0, 10);
fs.mkdirSync(outDir, { recursive: true });

function queryRows(sql) {
  const wrapped = `
    select coalesce(json_agg(row_to_json(q)), '[]'::json)
    from (
      ${sql}
    ) q;
  `;
  const output = execFileSync(
    "psql",
    [dbUrl, "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", wrapped],
    { encoding: "utf8" },
  ).trim();
  return output ? JSON.parse(output) : [];
}

function write(name, value) {
  fs.writeFileSync(path.join(outDir, name), JSON.stringify(value, null, 2) + "\n");
}

const columns = queryRows(`
  select
    table_name,
    ordinal_position,
    column_name,
    data_type,
    udt_name,
    is_nullable,
    column_default
  from information_schema.columns
  where table_schema = 'public'
  order by table_name, ordinal_position
`);

const constraintsIndexes = queryRows(`
  select kind, object_name, name, definition
  from (
    select
      'constraint'::text as kind,
      c.relname::text as object_name,
      con.conname::text as name,
      pg_get_constraintdef(con.oid, true)::text as definition
    from pg_constraint con
    join pg_class c on c.oid = con.conrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'

    union all

    select
      'index'::text as kind,
      tablename::text as object_name,
      indexname::text as name,
      indexdef::text as definition
    from pg_indexes
    where schemaname = 'public'
  ) x
  order by kind, object_name, name
`);

const policiesTriggers = queryRows(`
  select kind, object_name, name, definition
  from (
    select
      'policy'::text as kind,
      tablename::text as object_name,
      policyname::text as name,
      (
        'cmd=' || cmd ||
        '; permissive=' || permissive ||
        '; roles=' || roles::text ||
        '; qual=' || coalesce(qual, '') ||
        '; with_check=' || coalesce(with_check, '')
      )::text as definition
    from pg_policies
    where schemaname = 'public'

    union all

    select
      'trigger'::text as kind,
      c.relname::text as object_name,
      t.tgname::text as name,
      pg_get_triggerdef(t.oid, true)::text as definition
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and not t.tgisinternal
  ) x
  order by kind, object_name, name
`);

const functions = queryRows(`
  select
    p.proname::text as name,
    pg_get_function_identity_arguments(p.oid)::text as identity_args,
    pg_get_function_result(p.oid)::text as result_type,
    p.prosecdef as security_definer,
    pg_get_functiondef(p.oid)::text as definition
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
  order by name, identity_args
`);

const apiGrants = queryRows(`
  select
    grantee::text,
    table_name::text,
    privilege_type::text
  from information_schema.role_table_grants
  where table_schema = 'public'
    and grantee in ('anon', 'authenticated', 'service_role')
  order by grantee, table_name, privilege_type
`);

const enums = queryRows(`
  select
    t.typname::text as name,
    e.enumlabel::text as label,
    e.enumsortorder as sort_order
  from pg_type t
  join pg_namespace n on n.oid = t.typnamespace
  join pg_enum e on e.enumtypid = t.oid
  where n.nspname = 'public'
  order by name, sort_order
`);

const views = queryRows(`
  select
    c.relname::text as name,
    pg_get_userbyid(c.relowner)::text as owner,
    pg_get_viewdef(c.oid, false)::text as definition
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'v'
  order by name
`);

const relations = queryRows(`
  select
    c.relkind::text as kind,
    c.relname::text as name,
    pg_get_userbyid(c.relowner)::text as owner,
    c.relforcerowsecurity as rls_forced,
    c.relrowsecurity as rls_enabled
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p', 'v', 'm', 'S')
  order by name
`);

const sequences = queryRows(`
  select
    sequencename::text as name,
    cycle,
    sequenceowner::text as owner,
    data_type::text,
    max_value,
    min_value,
    cache_size,
    start_value,
    increment_by
  from pg_sequences
  where schemaname = 'public'
  order by name
`);

const extensions = queryRows(`
  select
    e.extname::text as name,
    n.nspname::text as schema,
    e.extversion::text as version
  from pg_extension e
  join pg_namespace n on n.oid = e.extnamespace
  order by name
`);

const roleMemberships = queryRows(`
  select
    pg_get_userbyid(m.roleid)::text as role,
    pg_get_userbyid(m.member)::text as member,
    m.admin_option
  from pg_auth_members m
  where pg_get_userbyid(m.member) in (
    'authenticator',
    'postgres',
    'supabase_realtime_admin',
    'cli_login_postgres'
  )
  order by role, member
`);

const defaultPrivileges = queryRows(`
  select
    d.defaclacl::text[] as acl,
    pg_get_userbyid(d.defaclrole)::text as owner,
    n.nspname::text as schema,
    d.defaclobjtype::text as object_type
  from pg_default_acl d
  left join pg_namespace n on n.oid = d.defaclnamespace
  order by owner, schema, object_type
`);

write("columns.json", {
  captured_at_utc: capturedAt,
  project_ref: projectRef,
  rows: columns,
});

write("constraints-indexes.json", {
  captured_at_utc: capturedAt,
  project_ref: projectRef,
  rows: constraintsIndexes,
});

write("policies-triggers.json", {
  captured_at_utc: capturedAt,
  project_ref: projectRef,
  rows: policiesTriggers,
});

write("functions.json", {
  captured_at_utc: capturedAt,
  project_ref: projectRef,
  rows: functions,
});

write("api-grants.json", {
  captured_at_utc: capturedAt,
  project_ref: projectRef,
  rows: apiGrants,
});

write("schema-meta.json", {
  captured_at_utc: capturedAt,
  project_ref: projectRef,
  enums,
  views,
  relations,
  sequences,
  extensions,
  role_memberships: roleMemberships,
  default_privileges: defaultPrivileges,
});

console.log(`Captured schema fingerprint in ${outDir}`);
