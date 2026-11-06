import "dotenv/config";
import postgres from "postgres";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL belum di-set");
  const sql = postgres(url, { max: 1 });
  await sql.unsafe("DELETE FROM ad_insights_daily; DELETE FROM ad_accounts;");
  console.log("✓ Seluruh data iklan (demo) telah dikosongkan. Akun & workspace tetap aman.");
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

