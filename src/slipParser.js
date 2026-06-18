const IGNORE = new Set(['hr','hits','hit','home','run','runs','total','over','under','parlay','straight','mlb','bet','odds']);

function norm(s = '') {
  return String(s).replace(/\r/g, '\n').replace(/[’']/g, '').replace(/\s+/g, ' ').trim();
}

function titleCase(s) {
  return s.toLowerCase().split(' ').filter(Boolean).map(w => w[0]?.toUpperCase() + w.slice(1)).join(' ');
}

export function parseSlipText(input = '') {
  const text = norm(input);
  const lines = input.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const players = new Set();
  const oddsMatch = text.match(/[+−-]\s?\d{3,5}/);
  const postedOdds = oddsMatch ? oddsMatch[0].replace(/\s/g, '').replace('−','-') : null;

  const patterns = [
    /([A-Z][a-z]+(?:\s+[A-Z]\.)?\s+[A-Z][a-z]+)\s+(?:to hit a )?(?:home run|hr)/gi,
    /([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){1,2}).{0,60}(?:over\s*0\.5|total home runs|home run)/gi
  ];

  for (const re of patterns) {
    let m;
    while ((m = re.exec(text))) {
      const p = titleCase(m[1].replace(/[^a-zA-Z.' -]/g, ' '));
      if (p.split(' ').some(w => IGNORE.has(w.toLowerCase()))) continue;
      players.add(p);
    }
  }

  for (const line of lines) {
    if (/home run|hr|over\s*0\.5|total home runs/i.test(line)) {
      const cleaned = line.replace(/\b(to hit a|home runs?|total|hit|over|under|0\.5|hr|odds boost|boost)\b/gi, ' ')
        .replace(/[+−-]?\d{2,5}/g, ' ')
        .replace(/[^a-zA-Z.' -]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const m = cleaned.match(/([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){1,2})/);
      if (m) players.add(titleCase(m[1]));
    }
  }

  return { players: [...players], postedOdds, isParlay: players.size >= 2 || /parlay/i.test(text), rawText: input };
}
