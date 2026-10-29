# PLAYEROK CONTROL — starter project

A Node.js + Telegraf starter for a private Telegram control panel. It includes:
- Cardinal-style button menus;
- admin allowlist using Telegram numeric IDs;
- SQLite persistence for account labels, active account, per-account switches and event logs;
- a small plugin manager with safe, local plugin registration;
- clear placeholders for Playerok integration (no fake live operations).

## Requirements
- Node.js 20+
- A Telegram bot token from `@BotFather`
- Your Telegram numeric user ID
- A host that can run Node.js processes

## Run locally or on a Node.js host
1. Upload/extract the project.
2. Copy `.env.example` to `.env`.
3. Set `BOT_TOKEN` and `ADMIN_IDS` in `.env`.
4. Install dependencies: `npm install`
5. Check syntax: `npm run check`
6. Start: `npm start`

Never send your bot token or Playerok credentials in this chat. Keep `.env` private.

## What currently works
- Main menu and navigation.
- Add/remove account *labels* and switch active account.
- Per-account feature toggles stored in SQLite.
- Status and event log panels.
- Plugin list and plugin toggle demonstration.

## What is not connected yet
This project does not yet log into Playerok or perform purchases, listing changes, chats, delivery, or transactions. The account panel currently stores labels only. A real integration must be implemented and tested against an allowed, supported interface before enabling any live operation. Do not paste session cookies or passwords into Telegram.

## Suggested next step
After the bot starts successfully, add a verified Playerok adapter for read-only account/status data first, then implement supported workflows one at a time with confirmations, limits, and idempotency checks.
