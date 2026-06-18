import { config } from './config.js';
import { estimateParlayAmerican } from './sportsgameodds.js';

function fmtOdds(n) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return 'N/A';
  return Number(n) > 0 ? `+${Number(n)}` : String(Number(n));
}

export function buildReply(parsed, results) {
  const found = results.filter(r => r.best);
  const lines = [];
  lines.push(parsed.isParlay ? '💰 **HR Parlay Optimizer**' : '🔥 **HR Slip Links**');
  if (parsed.postedOdds) lines.push(`Posted odds: **${parsed.postedOdds}**`);
  lines.push('');

  for (const r of results) {
    if (!r.best) {
      lines.push(`❌ **${r.player}** — no HR line found`);
      continue;
    }
    const link = r.best.link ? ` — ${r.best.link}` : '';
    lines.push(`✅ **${r.player} HR** — **${fmtOdds(r.best.price)}** at **${r.best.book}**${link}`);
  }

  if (config.postParlayEstimate && parsed.isParlay && found.length === results.length) {
    const est = estimateParlayAmerican(found.map(x => x.best));
    if (est) lines.push(`\nBest same-leg estimate: **${fmtOdds(est)}**`);
    lines.push('_Parlay deep link depends on whether SportsGameOdds returns a book betslip URL for those selections. If no betslip URL appears, this posts individual leg links._');
  }

  return lines.join('\n').slice(0, 1900);
}
