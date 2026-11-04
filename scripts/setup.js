const { randomBytes } = require('node:crypto');
const fs = require('node:fs');
if (!fs.existsSync('.env')) {
  fs.writeFileSync('.env', `JWT_SECRET=${randomBytes(48).toString('hex')}\nINTERNAL_API_KEY=${randomBytes(32).toString('hex')}\nSEED_DEMO=true\n`, { mode: 0o600 });
  console.log('Created .env with random secrets.');
} else console.log('Existing .env preserved.');
