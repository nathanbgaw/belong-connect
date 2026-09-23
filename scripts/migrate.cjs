const fs = require("fs");
const path = require("path");
const { connect } = require("./db.cjs");

(async () => {
  const dir = path.join(__dirname, "..", "supabase", "migrations");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const client = await connect();
  try {
    await client.query(`
      create table if not exists _bc_migrations (
        name text primary key,
        applied_at timestamptz not null default now()
      );
    `);
    const done = new Set(
      (await client.query("select name from _bc_migrations")).rows.map((r) => r.name)
    );

    for (const file of files) {
      if (done.has(file)) {
        console.log("  skip  ", file, "(already applied)");
        continue;
      }
      const sql = fs.readFileSync(path.join(dir, file), "utf8");
      process.stdout.write(`  apply ${file} ... `);
      try {
        await client.query("begin");
        await client.query(sql);
        await client.query("insert into _bc_migrations (name) values ($1)", [file]);
        await client.query("commit");
        console.log("ok");
      } catch (e) {
        await client.query("rollback").catch(() => {});
        console.log("FAILED");
        console.log("\n  " + e.message);
        if (e.position && sql) {
          const upto = sql.slice(0, Number(e.position));
          const line = upto.split("\n").length;
          console.log(`  at line ${line}:`);
          const lines = sql.split("\n");
          for (let i = Math.max(0, line - 3); i < Math.min(lines.length, line + 2); i++) {
            console.log(`    ${String(i + 1).padStart(4)} ${i + 1 === line ? ">" : " "} ${lines[i]}`);
          }
        }
        process.exit(1);
      }
    }
    console.log("\nmigrations up to date");
  } finally {
    await client.end();
  }
})();
