// Dummy upcoming-style matches for testing (not real fixtures, not betting advice)

const MATCHES = [
  {
    id: "M1",
    league: "Premier League",
    dayCategory: "today",
    date: "2026-02-09",
    time: "20:00",
    home: "Manchester City",
    away: "Arsenal",
    venue: "Etihad Stadium",
    stats: {
      homeForm: "WWWDW",
      awayForm: "WLDWW",
      headToHead: "City dominated recent H2H",
      attackVsDefence: "City strong attack vs decent Arsenal defence",
      avgGoalsFor: "City 2.6 / Arsenal 1.9",
      avgGoalsAgainst: "City 0.9 / Arsenal 1.2",
      avgCorners: "City 7.1 / Arsenal 5.8",
      avgCards: "City 1.4 / Arsenal 1.9",
      momentum: "High for both, slightly City"
    },
    markets: [
      {
        type: "1x2",
        label: "Home Win (1)",
        selection: "Man City to win",
        probability: 64,
        confidence: "High",
        reasoning: "City strong home record and recent form."
      },
      {
        type: "1x2",
        label: "Double Chance 1X",
        selection: "Man City or Draw",
        probability: 84,
        confidence: "High",
        reasoning: "Arsenal rarely beat City away."
      },
      {
        type: "goals",
        label: "Over 2.5 Goals",
        selection: "Over 2.5 total goals",
        probability: 68,
        confidence: "High",
        reasoning: "Both sides with high xG and attacking style."
      },
      {
        type: "goals",
        label: "BTTS",
        selection: "Both Teams To Score",
        probability: 66,
        confidence: "High",
        reasoning: "Both attacks in form and defences can concede."
      },
      {
        type: "corners",
        label: "Over 9.5 Corners",
        selection: "10+ match corners",
        probability: 61,
        confidence: "Medium",
        reasoning: "Both teams use wide play and overlap fullbacks."
      },
      {
        type: "cards",
        label: "Over 3.5 Cards",
        selection: "4+ total cards",
        probability: 57,
        confidence: "Medium",
        reasoning: "Top-of-table clash, tactical fouls expected."
      }
    ]
  },
  {
    id: "M2",
    league: "La Liga",
    dayCategory: "today",
    date: "2026-02-09",
    time: "22:00",
    home: "Real Madrid",
    away: "Barcelona",
    venue: "Santiago Bernabéu",
    stats: {
      homeForm: "WDWWW",
      awayForm: "WLWWD",
      headToHead: "Mixed, plenty of goals",
      attackVsDefence: "Both strong in attack, open game",
      avgGoalsFor: "Real 2.3 / Barca 2.1",
      avgGoalsAgainst: "Real 1.1 / Barca 1.2",
      avgCorners: "Real 6.8 / Barca 5.9",
      avgCards: "Real 2.0 / Barca 2.1",
      momentum: "High-intensity El Clásico"
    },
    markets: [
      {
        type: "1x2",
        label: "Home Win (1)",
        selection: "Real Madrid to win",
        probability: 46,
        confidence: "Medium",
        reasoning: "Slight home edge but very close."
      },
      {
        type: "1x2",
        label: "Double Chance 1X",
        selection: "Real Madrid or Draw",
        probability: 73,
        confidence: "High",
        reasoning: "Home record and crowd advantage."
      },
      {
        type: "goals",
        label: "Over 2.5 Goals",
        selection: "Over 2.5 total goals",
        probability: 71,
        confidence: "High",
        reasoning: "El Clásico historically full of goals."
      },
      {
        type: "goals",
        label: "BTTS",
        selection: "Both Teams To Score",
        probability: 74,
        confidence: "High",
        reasoning: "Both forward lines in strong form."
      },
      {
        type: "corners",
        label: "Over 8.5 Corners",
        selection: "9+ match corners",
        probability: 58,
        confidence: "Medium",
        reasoning: "Attacking full-backs and wing play."
      },
      {
        type: "cards",
        label: "Over 5.5 Cards",
        selection: "6+ total cards",
        probability: 69,
        confidence: "High",
        reasoning: "High rivalry and pressure fixture."
      }
    ]
  },
  {
    id: "M3",
    league: "Serie A",
    dayCategory: "tomorrow",
    date: "2026-02-10",
    time: "21:00",
    home: "Inter Milan",
    away: "Juventus",
    venue: "San Siro",
    stats: {
      homeForm: "WWLWW",
      awayForm: "WDWDL",
      headToHead: "Tight games, few goals recently",
      attackVsDefence: "Inter balanced, Juve more defensive",
      avgGoalsFor: "Inter 1.9 / Juve 1.4",
      avgGoalsAgainst: "Inter 0.9 / Juve 0.8",
      avgCorners: "Inter 6.4 / Juve 4.9",
      avgCards: "Inter 2.0 / Juve 2.3",
      momentum: "Title race implications"
    },
    markets: [
      {
        type: "1x2",
        label: "Home Win (1)",
        selection: "Inter to win",
        probability: 55,
        confidence: "Medium",
        reasoning: "Home strength and better form."
      },
      {
        type: "1x2",
        label: "Double Chance 1X",
        selection: "Inter or Draw",
        probability: 81,
        confidence: "High",
        reasoning: "Juve rarely dominate away at Inter."
      },
      {
        type: "goals",
        label: "Under 3.5 Goals",
        selection: "Max 3 goals",
        probability: 79,
        confidence: "High",
        reasoning: "Historically tactical and tight."
      },
      {
        type: "goals",
        label: "BTTS – No",
        selection: "At least one team clean sheet",
        probability: 54,
        confidence: "Medium",
        reasoning: "Both defences can shut games down."
      },
      {
        type: "corners",
        label: "Inter Team Corners Over 4.5",
        selection: "Inter 5+ corners",
        probability: 63,
        confidence: "High",
        reasoning: "Inter create wide overloads at home."
      },
      {
        type: "cards",
        label: "Over 4.5 Cards",
        selection: "5+ total cards",
        probability: 72,
        confidence: "High",
        reasoning: "Derby d'Italia is usually fiery."
      }
    ]
  },
  {
    id: "M4",
    league: "UEFA Champions League",
    dayCategory: "weekend",
    date: "2026-02-13",
    time: "21:00",
    home: "Bayern Munich",
    away: "Liverpool",
    venue: "Allianz Arena",
    stats: {
      homeForm: "WLWWW",
      awayForm: "WWDWW",
      headToHead: "Mixed but goals possible",
      attackVsDefence: "Both strong going forward, defences can be exposed",
      avgGoalsFor: "Bayern 2.7 / Liverpool 2.4",
      avgGoalsAgainst: "Bayern 1.1 / Liverpool 1.3",
      avgCorners: "Bayern 7.0 / Liverpool 6.1",
      avgCards: "Bayern 1.8 / Liverpool 1.7",
      momentum: "Knockout stage intensity"
    },
    markets: [
      {
        type: "1x2",
        label: "Home Win (1)",
        selection: "Bayern to win",
        probability: 49,
        confidence: "Medium",
        reasoning: "Home advantage but open tie."
      },
      {
        type: "goals",
        label: "Over 2.5 Goals",
        selection: "Over 2.5 total goals",
        probability: 73,
        confidence: "High",
        reasoning: "Both teams attack-minded with high xG."
      },
      {
        type: "goals",
        label: "BTTS",
        selection: "Both Teams To Score",
        probability: 71,
        confidence: "High",
        reasoning: "Elite forwards on both sides."
      },
      {
        type: "corners",
        label: "Over 9.5 Corners",
        selection: "10+ corners",
        probability: 64,
        confidence: "High",
        reasoning: "High tempo and wing play."
      },
      {
        type: "cards",
        label: "Over 3.5 Cards",
        selection: "4+ total cards",
        probability: 59,
        confidence: "Medium",
        reasoning: "Intense Champions League knockout environment."
      }
    ]
  }
];

// Helper maps for slip generation thresholds
const SLIP_CONFIG = {
  safe: { minProb: 75, maxSelections: 4 },
  medium: { minProb: 65, maxSelections: 6 },
  high: { minProb: 55, maxSelections: 8 }
};