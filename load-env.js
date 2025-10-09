const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local if it exists
const envPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

// Export environment variables to be used by Angular build process
process.env['NG_APP_STARTGG_API_TOKEN'] = process.env['NG_APP_STARTGG_API_TOKEN'] || '';

module.exports = {
  startggApiToken: process.env['NG_APP_STARTGG_API_TOKEN']
};
