import { config } from './config.js';
import { estimateParlayAmerican } from './sportsgameodds.js';

const BOOK_NAMES = {
  fanduel: 'FanDuel',
  draftkings: 'DraftKings',
  betmgm: 'BetMGM',
  hardrockbet: 'Hard Rock',
  fanatics: 'Fanatics',
  espnbet: 'ESPN BET'
};

function fmtOdds(n) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return 'N/A';
  return Number(n) > 0 ? `+${Number(n)}` : String(Number(n));
}

function bookName(id) {
  return BOOK_NAMES[String(id).toLowerCase()] || id;
}

function allowedBooks() {
  return (config.bookmakerIds || []).map(b => String(b).toLowerCase());
}

function bestSameBook(results) {
  const allowed = allowedBooks();
  const books = new Set();

  for (const r of results) {
    for (const m of r.matches || []) {
      const book = String(m.book).toLowerCase();
      if (!allowed.length || allowed.includes(book)) books.add(book);
    }
  }

  const options = [];

  for (const book of books) {
    const legs = [];

    for (const r of results) {
      const match = (r.matches || [])
        .filter(m => String(m.book).toLowerCase() === book)
        .sort((a, b) => Number(b.price) - Number(a.price))[0];

      if (!match) break;
      legs.push(match);
    }

    if (legs.length === results.length) {
      const estimate = estimateParlayAmerican(legs);
      if (estimate) options.push({ book, legs, estimate });
    }
  }

  options.sort((a, b) => Number(b.estimate) - Number(a.estimate));
  return options[0] || null;
}

export function buildReply(parsed, results) {
  const lines = [];

  lines.push(parsed.isParlay ? '💰 **HR Parlay Optimizer**' : '🔥 **HR Slip Links**');
  if (parsed.postedOdds) lines.push(`Posted odds: **${parsed.postedOdds}**`);
  lines.push('');

  if (parsed.isParlay) {
    const sameBook = bestSameBook(results);

    if (!sameBook) {
      for (const r of results) {
        lines.push(`❌ **${r.player}** — no same-book HR line found`);
      }
      return lines.join('\n').slice(0, 1900);
    }

    lines.push(`🏆 Best same-book: **${bookName(sameBook.book)} ${fmtOdds(sameBook.estimate)}**`);
    lines.push('');

    sameBook.legs.forEach((leg, i) => {
      const player = results[i]?.player || leg.player;
      const link = leg.link ? ` — ${leg.link}` : '';
      lines.push(`✅ **${player} HR** — **${fmtOdds(leg.price)}**${link}`);
    });

    return lines.join('\n').slice(0, 1900);
  }

  for (const r of results) {
    if (!r.best) {
      lines.push(`❌ **${r.player}** — no HR line found`);
      continue;
    }

    const link = r.best.link ? ` — ${r.best.link}` : '';
    lines.push(`✅ **${r.player} HR** — **${fmtOdds(r.best.price)}** at **${bookName(r.best.book)}**${link}`);
  }

  return lines.join('\n').slice(0, 1900);
}
