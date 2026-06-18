import { config } from './config.js';

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

function getDeepLink(obj = {}) {
  return obj.deepLink || obj.deeplink || obj.betLink || obj.link || obj.url ||
    obj.sportsbookUrl || obj.sportsbookURL || obj.selectionLink || obj.playerPropsLink || null;
}

function getBook(obj = {}) {
  return obj.bookmakerID || obj.bookmakerId || obj.bookID || obj.bookId ||
    obj.sportsbook || obj.sportsbookID || obj.sportsbookId || obj.book || obj.sourceID || 'Book';
}

function getPrice(obj = {}) {
  return obj.odds ?? obj.price ?? obj.americanOdds ?? obj.american ??
    obj.moneyline ?? obj.value ?? obj.closeOdds;
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
    throw new Error(`${label}: non-JSON response ${text.slice(0, 300)}`);
  }

  if (!res.ok) {
    throw new Error(`${label}: ${res.status} ${JSON.stringify(json).slice(0, 500)}`);
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

function allText(obj) {
  try {
    return JSON.stringify(obj).toLowerCase();
  } catch {
    return '';
  }
}

function getPlayerFromObj(obj = {}) {
  return obj.playerName ||
    obj.participantName ||
    obj.selectionName ||
    obj.outcomeName ||
    obj.outcome ||
    obj.name ||
    obj.label ||
    '';
}

function isHrOverCandidate(obj = {}) {
  const t = allText(obj);

  const isHr =
    t.includes('home run') ||
    t.includes('homer') ||
    t.includes('batter home runs') ||
    t.includes('player home runs') ||
    t.includes('total home runs');

  const isOver =
    t.includes('over 0.5') ||
    t.includes('"over"') ||
    t.includes('to hit') ||
    t.includes('hit a home run') ||
    t.includes('yes');

  return isHr && isOver;
}

function flattenCandidates(value, out = [], eventName = '') {
  if (!value) return out;

  if (Array.isArray(value)) {
    for (const item of value) flattenCandidates(item, out, eventName);
    return out;
  }

  if (typeof value !== 'object') return out;

  const thisEventName =
    value.eventName ||
    value.gameName ||
    value.matchup ||
    value.name ||
    eventName ||
    '';

  const price = getPrice(value);

  if (price !== undefined && price !== null && isHrOverCandidate(value)) {
    out.push({
      raw: value,
      player: getPlayerFromObj(value),
      book: getBook(value),
      price: Number(price),
      link: getDeepLink(value),
      event: thisEventName
    });
  }

  for (const child of Object.values(value)) {
    if (child && typeof child === 'object') {
      flattenCandidates(child, out, thisEventName);
    }
  }

  return out;
}

function playerMatches(candidatePlayer, targetPlayer, raw) {
  const candidate = cleanName(candidatePlayer);
  const target = cleanName(targetPlayer);
  const rawText = cleanName(allText(raw));

  if (!target) return false;

  return (
    candidate === target ||
    candidate.includes(target) ||
    target.includes(candidate) ||
    rawText.includes(target)
  );
}

export async function findHrOddsForPlayers(players) {
  const events = await fetchMlbEvents();
  const all = flattenCandidates(events);

  console.log(`SportsGameOdds events loaded: ${events.length}`);
  console.log(`HR candidates found: ${all.length}`);

  if (all.length) {
    console.log('Sample HR candidate:', JSON.stringify(all[0], null, 2).slice(0, 2000));
  } else if (events.length) {
    console.log('Sample event:', JSON.stringify(events[0], null, 2).slice(0, 3000));
  }

  return players.map(player => {
    const matches = all.filter(c => playerMatches(c.player, player, c.raw));

    matches.sort((a, b) => {
      const ap = Number(a.price);
      const bp = Number(b.price);
      return bp - ap;
    });

    console.log(`Searching ${player}: ${matches.length} matches`);

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
