require('dotenv').config();

const { createBot } = require('./bot');

const token = process.env.BOT_TOKEN;
if (!token || token === 'PASTE_TELEGRAM_BOT_TOKEN_HERE') {
  console.error('Missing BOT_TOKEN. Copy .env.example to .env and set BOT_TOKEN.');
  process.exit(1);
}

const adminIds = (process.env.ADMIN_IDS || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)
  .map(Number)
  .filter(Number.isSafeInteger);

if (adminIds.length === 0) {
  console.error('Missing ADMIN_IDS. Set your numeric Telegram user ID in .env.');
  process.exit(1);
}

const dataDir = process.env.DATA_DIR || './data';
const bot = createBot({ token, adminIds, dataDir });

bot.launch()
  .then(() => console.log('PLAYEROK CONTROL is running.'))
  .catch((error) => {
    console.error('Bot launch failed:', error.message);
    process.exit(1);
  });

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
