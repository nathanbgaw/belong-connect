/**
 * Shared Postgres connection for maintenance scripts (migrate, seed).
 *
 * Supabase's direct host is IPv6-only, which a lot of networks (including WSL)
 * can't reach, so we go through the Supavisor pooler and build the credentials
 * from the project ref rather than trusting the packaged connection strings —
 * the POSTGRES_URL_NON_POOLING that Vercel injects points at a pooler user that
 * doesn't resolve.
 *
 * Also: pg >= 8.16 treats `sslmode=require` as `verify-full`, which rejects
 * Supabase's certificate chain, so ssl is set explicitly instead.
 */
const { Client } = require("pg");

function projectRef() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  return url.replace(/^https:\/\//, "").split(".")[0];
}

async function connect() {
  const ref = projectRef();
  if (!ref) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  const client = new Client({
    host: "aws-0-us-east-1.pooler.supabase.com",
    port: 6543,
    user: `postgres.${ref}`,
    password: process.env.POSTGRES_PASSWORD,
    database: "postgres",
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20000,
    statement_timeout: 120000,
  });
  await client.connect();
  return client;
}

module.exports = { connect, projectRef };
