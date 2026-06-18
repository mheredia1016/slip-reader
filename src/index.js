import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { config, validateConfig } from './config.js';
import { parseSlipText } from './slipParser.js';
import { ocrImage } from './ocr.js';
import { findHrOddsForPlayers } from './sportsgameodds.js';
import { buildReply } from './slipReply.js';

validateConfig();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Channel, Partials.Message]
});

async function getMessageText(message) {
  let text = message.content || '';
  const images = [...message.attachments.values()].filter(a => (a.contentType || '').startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(a.url));
  if (config.ocrEnabled && images.length) {
    for (const img of images.slice(0, 2)) {
      try { text += `\n${await ocrImage(img.url)}`; }
      catch (e) { console.error('OCR failed:', e.message); }
    }
  }
  return text;
}

client.once('ready', () => console.log(`HR slip link bot logged in as ${client.user.tag}`));

client.on('messageCreate', async message => {
  try {
    if (message.author.bot) return;
    if (message.channelId !== config.slipChannelId) return;

    const text = await getMessageText(message);
    const parsed = parseSlipText(text);
    if (parsed.players.length < config.minConfidencePlayers) return;

    const results = await findHrOddsForPlayers(parsed.players);
    const reply = buildReply(parsed, results);

    if (config.replyMode === 'thread' && message.startThread) {
      const thread = await message.startThread({ name: 'HR slip links', autoArchiveDuration: 60 });
      await thread.send(reply);
    } else {
      await message.reply({ content: reply, allowedMentions: { repliedUser: false } });
    }
  } catch (err) {
    console.error('Slip handling failed:', err);
    try { await message.reply({ content: `Could not process slip: ${err.message}`, allowedMentions: { repliedUser: false } }); } catch {}
  }
});

client.login(config.discordToken);
