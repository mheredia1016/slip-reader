# HR Slip Link Bot

Discord bot that watches a slip channel, OCRs screenshots, extracts MLB home-run legs, checks SportsGameOdds, and replies with best odds + links.

## GitHub setup

1. Create a new GitHub repo named `hr-slip-link-bot`.
2. Upload these files.
3. Commit to `main`.

## Railway setup

1. Railway → New Project → Deploy from GitHub repo.
2. Select `hr-slip-link-bot`.
3. Add variables from `.env.example`.
4. Start command is automatic: `npm start`.

## Discord setup

Developer Portal → Bot → enable:

- Message Content Intent

Invite permissions:

- View Channel
- Send Messages
- Read Message History
- Create Public Threads
- Send Messages in Threads
- Embed Links

Get channel ID: Discord Settings → Advanced → Developer Mode ON → right-click channel → Copy Channel ID.

## Notes

This posts individual selection links when SportsGameOdds returns them. True parlay betslip links require SportsGameOdds to return a same-book betslip/parlay URL for selections.
