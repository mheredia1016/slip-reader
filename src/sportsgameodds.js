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
  url.searchParams.set('includeAltLines', 'true');
  url.searchParams.set('limit', '1');

  const events = await getJson(url, 'events');

  console.log('FULL SAMPLE EVENT:');
  console.log(JSON.stringify(events[0], null, 2).slice(0, 12000));

  return events;
}

export async function findHrOddsForPlayers(players) {
  const events = await fetchMlbEvents();

  console.log(`SportsGameOdds events loaded: ${events.length}`);
  console.log('DEBUG MODE: not searching props yet');

  return players.map(player => ({
    player,
    matches: [],
    best: null
  }));
}

export function estimateParlayAmerican(bestLegs) {
  const decimals = bestLegs
    .map(l => americanToDecimal(l?.price))
    .filter(Boolean);

  if (!decimals.length || decimals.length !== bestLegs.length) {
    return null;
  }

  return decimalToAmerican(decimals.reduce((a, b) => a * b, 1));
}
