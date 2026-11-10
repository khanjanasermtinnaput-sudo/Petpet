#!/usr/bin/env node
// Generates a provisioning token for a shuttle launcher and prints the SQL that
// registers it. Only the sha256 hash goes in the database; the plaintext token
// is shown once here and belongs in the machine's firmware config (gitignored).
//
//   node scripts/provision-launcher.mjs [DEVICE_ID] [label]
import { createHash, randomBytes } from "node:crypto";

const deviceId = process.argv[2] ?? "SHUTTLE-001";
const label = process.argv[3] ?? "";
if (!/^[A-Za-z0-9_-]{3,40}$/.test(deviceId)) {
  console.error("device id must be 3-40 chars of A-Z a-z 0-9 _ -");
  process.exit(1);
}

const token = randomBytes(32).toString("hex"); // 256 bits
const hash = createHash("sha256").update(token, "utf8").digest("hex");
const sqlLabel = label.replace(/'/g, "''");

console.log(`-- Run this in the Supabase SQL editor (or via MCP execute_sql):
insert into launcher_devices (device_id, label, secret_hash)
values ('${deviceId}', '${sqlLabel}', '${hash}')
on conflict (device_id) do update set secret_hash = excluded.secret_hash;

DEVICE_ID    = ${deviceId}
DEVICE_SECRET= ${token}

Keep DEVICE_SECRET out of git. Re-running this rotates the secret (the old one stops working).`);
