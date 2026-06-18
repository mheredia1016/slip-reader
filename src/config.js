import 'dotenv/config';

function list(name, fallback = '') {
  return (process.env[name] || fallback)
    .split(',')
    .map(x => x.trim())
    .filter(Boolean);
}

export const config = {
  discordToken: process.env.DISCORD_BOT_TOKEN,
  slipChannelId: process.env.SLIP_CHANNEL_ID,
  apiKey: process.env.SPORTSGAMEODDS_API_KEY,
  apiBase: process.env.SPORTSGAMEODDS_API_BASE || 'https://api.sportsgameodds.com/v2',
  leagueId: process.env.LEAGUE_ID || 'MLB',
  bookmakerIds: list('BOOKMAKER_IDS'),
  eventLimit: Number(process.env.EVENT_LIMIT || 100),
  includeAltLines: String(process.env.INCLUDE_ALT_LINES || 'true') === 'true',
  replyMode: process.env.SLIP_REPLY_MODE || 'channel',
  postIndividualLinks: String(process.env.POST_INDIVIDUAL_LINKS || 'true') === 'true',
  postParlayEstimate: String(process.env.POST_PARLAY_ESTIMATE || 'true') === 'true',
  ocrEnabled: String(process.env.OCR_ENABLED || 'true') === 'true',
  minConfidencePlayers: Number(process.env.MIN_CONFIDENCE_PLAYERS || 1)
};

export function validateConfig() {
  const missing = [];
  if (!config.discordToken) missing.push('DISCORD_BOT_TOKEN');
  if (!config.slipChannelId) missing.push('SLIP_CHANNEL_ID');
  if (!config.apiKey) missing.push('SPORTSGAMEODDS_API_KEY');
  if (missing.length) throw new Error(`Missing env vars: ${missing.join(', ')}`);
}
