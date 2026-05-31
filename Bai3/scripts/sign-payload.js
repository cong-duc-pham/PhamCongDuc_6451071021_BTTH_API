const crypto = require("crypto");

const secret = process.argv[2];
const body = process.argv[3];

if (!secret || !body) {
  process.stderr.write("Usage: node scripts/sign-payload.js <app_secret> '<json_body>'\n");
  process.exit(1);
}

const signature = crypto.createHmac("sha256", secret).update(body).digest("hex");
process.stdout.write(`sha256=${signature}\n`);
