import { config } from './config.js';

function americanOdds(value) {
  if (value == null) return null;
  if (typeof value === 'number') return value;
  const raw = String(value).replace(/[+\s]/g, '');
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function americanToDecimal(american) {
  const n = Number(american);
  if (!Number.isFinite(n) || n === 0) return null;
  return n > 0 ? 1 + n / 100 : 1 + 100 / Math.abs(n);
}

function decimalToAmerican(decimal) {
  if (!Number.isFinite(decimal) || decimal <= 1) return null;
  return decimal >= 2 ? Math.round((decimal - 1) * 100) : Math.round(-100 / (decimal - 1));
}

function cleanName(s = '') {
  return String(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function pickDeeplink(node) {
  return node?.deeplink || node?.deepLink || node?.link || node?.url || node?.betLink || node?.sportsbookUrl || null;
}

function pickOdds(node) {
  return americanOdds(node?.odds ?? node?.price ?? node?.americanOdds ?? node?.american ?? node?.value);
}

async function getJson(url, label) {
  const res = await fetch(url, {
    headers: { 'x-api-key': config.apiKey, accept: 'application/json' }
  });

  const text = await res.text();
  let json;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`${label}: non-JSON response ${text.slice(0, 500)}`);
  }

  if (!res.ok) {
    throw new Error(`${label}: ${res.status} ${JSON.stringify(json).slice(0, 800)}`);
  }

  if (Array.isArray(json)) return json;
  return json?.data || json?.events || json?.response || [];
}

export async function fetchMlbEvents() {
  const url = new URL(`${config.apiBase}/events`);
  url.searchParams.set('leagueID', config.leagueId);
  url.searchParams.set('oddsAvailable', 'true');
  url.searchParams.set('includeAltLines', String(config.includeAltLines));
  url.searchParams.set('limit', String(config.eventLimit));

  if (config.bookmakerIds.length) {
    url.searchParams.set('bookmakerID', config.bookmakerIds.join(','));
  }

  return getJson(url, 'events');
}

function entityNameFromEvent(event, statEntityID) {
  if (!statEntityID) return '';

  const id = String(statEntityID);

  if (id === 'home') return event.teams?.home?.names?.long || event.teams?.home?.names?.medium || 'Home';
  if (id === 'away') return event.teams?.away?.names?.long || event.teams?.away?.names?.medium || 'Away';
  if (id === 'all') return 'All';

  const players = event.players;
  if (!players) return '';

  const player = Array.isArray(players)
    ? players.find(p => String(p.playerID || p.id || p.statEntityID) === id)
    : players[id];

  if (!player) return '';

  return player.names?.long || player.names?.medium || player.name || player.fullName || player.displayName || '';
}

function sideLabel(odd) {
  if (odd.sideID === 'over') return 'Over';
  if (odd.sideID === 'under') return 'Under';
  if (odd.sideID === 'yes') return 'Yes';
  if (odd.sideID === 'no') return 'No';

  return odd.sideID || odd.side || odd.selection || odd.outcomeName || odd.outcome || odd.betName || odd.label || '';
}

function lineFromOdd(odd) {
  return odd.line ?? odd.points ?? odd.handicap ?? odd.spread ?? odd.total ?? odd.value ?? odd.statValue ?? '';
}

function isBadHrMarket(market) {
  return (
    market.includes('first') ||
    market.includes('1st') ||
    market.includes('first_home_run') ||
    market.includes('first home run') ||
    market.includes('first team') ||
    market.includes('team to hit') ||
    market.includes('race to') ||
    market.includes('inning') ||
    market.includes('most home runs') ||
    market.includes('team_home_runs') ||
    market.includes('team home runs')
  );
}

function isHrOverOdd(odd) {
  const market = String(
    odd.marketName || odd.marketID || odd.market || odd.statID || ''
  ).toLowerCase();

  if (isBadHrMarket(market)) return false;

  const side = String(sideLabel(odd)).toLowerCase();
  const line = String(lineFromOdd(odd)).toLowerCase();

  const isHr =
    market === 'batting_homeruns' ||
    market === 'batting_homeRuns'.toLowerCase() ||
    market.includes('batting_homeruns') ||
    market.includes('batting_homeruns') ||
    market.includes('batting_home_runs') ||
    market.includes('home run') ||
    market.includes('homer') ||
    market.includes('player_home_runs') ||
    market.includes('batter_home_runs') ||
    market.includes('total_home_runs') ||
    market.includes('home_runs');

  const isOver =
    side === 'over' ||
    side === 'yes' ||
    side.includes('over') ||
    side.includes('yes') ||
    line === '0.5' ||
    line.includes('0.5');

  return isHr && isOver;
}

function extractHrRows(event) {
  const rows = [];

  if (!event.odds || typeof event.odds !== 'object' || Array.isArray(event.odds)) {
    return rows;
  }

  for (const [oddID, odd] of Object.entries(event.odds)) {
    if (!odd || typeof odd !== 'object') continue;
    if (!isHrOverOdd(odd)) continue;

    const statEntityID = odd.statEntityID || odd.entityID || odd.participantID || '';
    const playerName =
      odd.playerName ||
      odd.player ||
      odd.participantName ||
      odd.participant ||
      odd.entityName ||
      entityNameFromEvent(event, statEntityID);

    if (!playerName) continue;

    const byBookmaker = odd.byBookmaker;
    if (!byBookmaker || typeof byBookmaker !== 'object') continue;

    for (const [bookIdRaw, bookNode] of Object.entries(byBookmaker)) {
      const bookId = String(bookIdRaw).toLowerCase();

      if (config.bookmakerIds.length && !config.bookmakerIds.includes(bookId)) continue;
      if (!bookNode || bookNode.available === false) continue;

      const price = pickOdds(bookNode);
      if (price == null) continue;

      const overUnder =
        bookNode.overUnder ??
        bookNode.bookOverUnder ??
        odd.bookOverUnder ??
        odd.overUnder ??
        odd.line ??
        odd.value;

      if (Number(overUnder) !== 0.5) continue;

      rows.push({
        player: playerName,
        book: bookId,
        price,
        link: pickDeeplink(bookNode) || pickDeeplink(odd) || event.links?.bookmakers?.[bookId] || null,
        event: event.name || event.eventName || event.eventID || '',
        raw: odd
      });
    }
  }

  return rows;
}

export async function findHrOddsForPlayers(players) {
  const events = await fetchMlbEvents();
  const all = events.flatMap(extractHrRows);

  console.log(`SportsGameOdds events loaded: ${events.length}`);
  console.log(`HR rows found: ${all.length}`);

  if (all.length) {
    console.log('Sample HR row:', JSON.stringify(all[0], null, 2).slice(0, 1000));
  }

  return players.map(player => {
    const target = cleanName(player);

    const matches = all.filter(row => {
      const candidate = cleanName(row.player);
      return candidate === target || candidate.includes(target) || target.includes(candidate);
    });

    matches.sort((a, b) => b.price - a.price);

    console.log(`Searching ${player}: ${matches.length} HR matches`);

    return {
      player,
      matches,
      best: matches[0] || null
    };
  });
}

export function estimateParlayAmerican(bestLegs) {
  const decimals = bestLegs.map(l => americanToDecimal(l?.price)).filter(Boolean);

  if (!decimals.length || decimals.length !== bestLegs.length) {
    return null;
  }

  return decimalToAmerican(decimals.reduce((a, b) => a * b, 1));
}
