import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

console.log("Connecting to:", url.replace(/:[^:@]+@/, ":****@"));

const client = new pg.Client({ connectionString: url });

const timeout = setTimeout(() => {
  console.error("TIMED OUT after 15s trying to connect");
  process.exit(1);
}, 15000);

try {
  await client.connect();
  console.log("CONNECTED OK");
  const res = await client.query("select current_database(), current_user, version()");
  console.log(res.rows[0]);
  await client.end();
  clearTimeout(timeout);
} catch (err) {
  clearTimeout(timeout);
  console.error("CONNECTION FAILED:");
  console.error(err);
  process.exit(1);
}
