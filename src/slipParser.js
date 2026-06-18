const IGNORE = new Set([
  'hr','hits','hit','home','run','runs','total','over','under',
  'parlay','straight','mlb','bet','odds','guardians','brewers',
  'blue','jays','red','sox','twins','rangers','mets','phillies',
  'yankees','white','cubs','dodgers','padres','giants','mariners',
  'athletics','orioles','rays','tigers','royals','angels','astros',
  'braves','nationals','marlins','reds','pirates','cardinals',
  'rockies','diamondbacks'
]);

const TEAM_WORDS = /\b(guardians|brewers|blue jays|red sox|white sox|twins|rangers|mets|phillies|yankees|cubs|dodgers|padres|giants|mariners|athletics|orioles|rays|tigers|royals|angels|astros|braves|nationals|marlins|reds|pirates|cardinals|rockies|diamondbacks|cleveland|milwaukee|toronto|boston|minnesota|texas|new york|philadelphia|chicago|los angeles|san diego|san francisco|seattle|baltimore|tampa bay|detroit|kansas city|houston|atlanta|washington|miami|cincinnati|pittsburgh|st louis|colorado|arizona)\b/i;

function norm(s = '') {
  return String(s).replace(/\r/g, '\n').replace(/[’']/g, '').replace(/\s+/g, ' ').trim();
}

function titleCase(s) {
  return s
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map(w => w[0]?.toUpperCase() + w.slice(1))
    .join(' ');
}

function cleanName(s = '') {
  return String(s)
    .replace(/[+−-]?\d{2,5}/g, ' ')
    .replace(/\b(to hit a|home runs?|total|hit|over|under|0\.5|hr|odds boost|boost)\b/gi, ' ')
    .replace(/[^a-zA-Z.' -]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function looksLikePlayer(line = '') {
  const cleaned = cleanName(line);
  if (!cleaned) return null;
  if (TEAM_WORDS.test(cleaned)) return null;

  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 3) return null;
  if (words.some(w => IGNORE.has(w.toLowerCase()))) return null;

  return titleCase(cleaned);
}

export function parseSlipText(input = '') {
  const text = norm(input);
  const lines = input.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  const players = new Set();
  const oddsMatch = text.match(/[+−-]\s?\d{3,5}/);
  const postedOdds = oddsMatch ? oddsMatch[0].replace(/\s/g, '').replace('−', '-') : null;

  for (let i = 0; i < lines.length; i++) {
    if (/to hit a home run|home run|hr|over\s*0\.5|total home runs/i.test(lines[i])) {
      const sameLine = looksLikePlayer(lines[i]);
      if (sameLine) players.add(sameLine);

      for (let j = i - 1; j >= Math.max(0, i - 3); j--) {
        const above = looksLikePlayer(lines[j]);
        if (above) {
          players.add(above);
          break;
        }
      }
    }
  }

  const patterns = [
    /([A-Z][A-Za-z.'-]+(?:\s+[A-Z]\.)?\s+[A-Z][A-Za-z.'-]+)\s+(?:to hit a )?(?:home run|hr)/gi,
    /([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){1,2}).{0,40}(?:over\s*0\.5|total home runs|home run)/gi
  ];

  for (const re of patterns) {
    let m;
    while ((m = re.exec(text))) {
      const p = looksLikePlayer(m[1]);
      if (p) players.add(p);
    }
  }

  return {
    players: [...players],
    postedOdds,
    isParlay: players.size >= 2 || /parlay/i.test(text),
    rawText: input
  };
}
