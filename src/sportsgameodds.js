import { config } from './config.js';

function americanToDecimal(american) {
  const n = Number(american);
  if (!Number.isFinite(n) || n === 0) return null;
  return n > 0 ? 1 + n / 100 : 1 + 100 / Math.abs(n);
}

function decimalToAmerican(decimal) {
  if (!Number.isFinite(decimal) || decimal <= 1) return null;
  return decimal >= 2
    ? Math.round((decimal - 1) * 100)
    : Math.round(-100 / (decimal - 1));
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
  return (
    obj.deepLink ||
    obj.deeplink ||
    obj.betLink ||
    obj.link ||
    obj.url ||
    obj.sportsbookUrl ||
    obj.sportsbookURL ||
    obj.selectionLink ||
    null
  );
}

function getBook(obj = {}) {
  return (
    obj.bookmakerID ||
    obj.bookmakerId ||
    obj.bookID ||
    obj.bookId ||
    obj.sportsbook ||
    obj.sportsbookID ||
    obj.sportsbookId ||
    obj.book ||
    'Book'
  );
}

function getPrice(obj = {}) {
  return (
    obj.odds ??
    obj.price ??
    obj.americanOdds ??
    obj.american ??
    obj.moneyline ??
    obj.value
  );
}

async function getJson(url, label) {
  const res = await fetch(url, {
    headers: {
      'x-api-key': config.apiKey,
      accept: 'application/json'
    }
  });

  const text = await res.text();

  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`${label}: non-JSON response`);
  }

  if (!res.ok) {
    throw new Error(`${label}: ${res.status}`);
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
    url.searchParams.set(
      'bookmakerID',
      config.bookmakerIds.join(',')
    );
  }

  return getJson(url, 'events');
}

function flattenCandidates(value, out = []) {
  if (!value) return out;

  if (Array.isArray(value)) {
    for (const item of value) {
      flattenCandidates(item, out);
    }
    return out;
  }

  if (typeof value !== 'object') {
    return out;
  }

  const player =
    value.playerName ||
    value.participantName ||
    value.selectionName ||
    value.outcomeName ||
    '';

  const market =
    (
      value.marketName ||
      value.market ||
      value.statName ||
      value.description ||
      ''
    ).toLowerCase();

  const outcome =
    (
      value.selectionName ||
      value.outcomeName ||
      value.outcome ||
      value.name ||
      ''
    ).toLowerCase();

  const price = getPrice(value);

  const isHrMarket =
    market.includes('home run') ||
    market.includes('homer') ||
    market.includes('player home runs') ||
    market.includes('batter home runs');

  const isOver =
    outcome.includes('over') ||
    outcome.includes('to hit') ||
    outcome.includes('yes') ||
    outcome.includes('0.5');

  if (
    player &&
    isHrMarket &&
    isOver &&
    price !== undefined &&
    price !== null
  ) {
    out.push({
      player,
      book: getBook(value),
      price: Number(price),
      link: getDeepLink(value),
      raw: value
    });
  }

  for (const child of Object.values(value)) {
    if (child && typeof child === 'object') {
      flattenCandidates(child, out);
    }
  }

  return out;
}

export async function findHrOddsForPlayers(players) {
  const events = await fetchMlbEvents();
  const all = flattenCandidates(events);

  console.log(`SportsGameOdds events loaded: ${events.length}`);
  console.log(`HR player props found: ${all.length}`);

  if (all.length) {
    console.log(
      'Sample HR prop:',
      JSON.stringify(all[0], null, 2).slice(0, 1500)
    );
  }

  return players.map(player => {
    const target = cleanName(player);

    const matches = all.filter(prop => {
      const candidate = cleanName(prop.player);

      return (
        candidate === target ||
        candidate.includes(target) ||
        target.includes(candidate)
      );
    });

    matches.sort((a, b) => b.price - a.price);

    console.log(
      `Searching ${player}: ${matches.length} player prop matches`
    );

    return {
      player,
      matches,
      best: matches[0] || null
    };
  });
}

export function estimateParlayAmerican(bestLegs) {
  const decimals = bestLegs
    .map(l => americanToDecimal(l?.price))
    .filter(Boolean);

  if (!decimals.length || decimals.length !== bestLegs.length) {
    return null;
  }

  return decimalToAmerican(
    decimals.reduce((a, b) => a * b, 1)
  );
}
