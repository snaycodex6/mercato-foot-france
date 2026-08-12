export const officialSourceDomains = [
  "fff.fr", "fifa.com", "uefa.com", "ligue1.fr", "lfp.fr",
  "psg.fr", "om.fr", "ol.fr", "asmonaco.com", "losc.fr", "rclens.fr",
  "realmadrid.com", "fcbarcelona.com", "mancity.com", "manutd.com", "liverpoolfc.com",
  "arsenal.com", "chelseafc.com", "fcbayern.com", "bvb.de", "juventus.com", "inter.it", "acmilan.com",
];

export const recognizedSourceDomains = [
  "lequipe.fr", "rmcsport.bfmtv.com", "eurosport.fr", "franceinfo.fr", "francetvinfo.fr",
  "lemonde.fr", "lefigaro.fr", "ouest-france.fr", "20minutes.fr", "footmercato.net",
  "sofoot.com", "goal.com", "beinsports.com", "francebleu.fr", "radiofrance.fr",
];

export const suspiciousImagePattern = /(logo|favicon|avatar|author|profile|placeholder|default|fallback|sprite|blank|transparent|tracking[_-]?pixel)/i;

export const titleStopWords = new Set([
  "a", "au", "aux", "avec", "ce", "ces", "dans", "de", "des", "du", "elle", "en", "et",
  "est", "il", "la", "le", "les", "mais", "ne", "ou", "par", "pas", "pour", "que", "qui",
  "se", "son", "sur", "un", "une", "vers", "mercato", "football", "foot", "transfert", "transferts",
]);

export const footballPattern = /\b(football|foot|soccer|mercato|transferts?|ligue [12]|ligue des champions|champions league|premier league|la ?liga|serie a|bundesliga|europa league|ligue europa|conference league|coupe du monde|mondial des clubs|euro 20\d{2}|can 20\d{2}|fegafoot|psg|paris saint-germain|montpellier fc|bar[çc]a|barcelone|real madrid|arsenal|liverpool|chelsea|juventus|bayern|manchester city|manchester united|fenerbah[çc]e)\b/i;
export const clubAcronymPattern = /(?:^|[^\p{L}\p{N}])(OM|OL)(?=$|[^\p{L}\p{N}])/u;
export const excludedPattern = /\b(euromillions?|keno|loto|fdj|paris sportifs?|casino|jackpot|tirage gagnant|guide achat|code promo|streaming gratuit|marijuana|cocaïne|drogues?)\b/i;
export const excludedURLPattern = /\/(guide-achat|bons-plans|pronostics?|paris-sportifs?)\//i;
export const rumorPattern = /\b(rumeurs?|gossip|pourrait|piste|vise|cible|intérêt|proche de|pressenti|vers (un|le) départ)\b/i;
export const transferPattern = /\b(transferts?|mercato|signe|signé|prêt|recrue|recrute|rejoint|quitte|départ|accord|engage|officialise|officiel)\b|s[’']offre/i;
export const officialPattern = /\b(officiel|officialisé|confirmé|a signé|annonce|communiqué)\b/i;

export const teamAliases = [
  ["psg", ["psg", "paris saint-germain"]],
  ["om", ["olympique de marseille", "marseille"]],
  ["ol", ["olympique lyonnais", "lyon"]],
  ["monaco", ["as monaco", "monaco"]],
  ["lille", ["losc", "lille"]],
  ["lens", ["rc lens", "lens"]],
  ["rennes", ["stade rennais", "rennes"]],
  ["nice", ["ogc nice", "nice"]],
  ["nantes", ["fc nantes", "nantes"]],
  ["strasbourg", ["rc strasbourg", "strasbourg"]],
  ["brest", ["stade brestois", "brest"]],
  ["auxerre", ["aj auxerre", "auxerre"]],
  ["real-madrid", ["real madrid"]],
  ["barcelona", ["fc barcelone", "barcelone", "barça"]],
  ["atletico", ["atlético de madrid", "atletico madrid"]],
  ["man-city", ["manchester city", "man city"]],
  ["man-united", ["manchester united", "man united"]],
  ["liverpool", ["liverpool"]],
  ["arsenal", ["arsenal"]],
  ["chelsea", ["chelsea"]],
  ["tottenham", ["tottenham", "spurs"]],
  ["newcastle", ["newcastle"]],
  ["bayern", ["bayern munich"]],
  ["dortmund", ["borussia dortmund", "dortmund"]],
  ["leverkusen", ["bayer leverkusen", "leverkusen"]],
  ["juventus", ["juventus", "juve"]],
  ["inter", ["inter milan", "internazionale"]],
  ["ac-milan", ["ac milan"]],
  ["napoli", ["napoli", "naples"]],
  ["roma", ["as roma", "roma"]],
  ["benfica", ["benfica"]],
  ["porto", ["fc porto", "porto"]],
  ["sporting", ["sporting cp", "sporting portugal"]],
  ["ajax", ["ajax amsterdam", "ajax"]],
  ["feyenoord", ["feyenoord"]],
  ["psv", ["psv eindhoven", "psv"]],
  ["galatasaray", ["galatasaray"]],
  ["fenerbahce", ["fenerbahçe", "fenerbahce"]],
  ["al-hilal", ["al-hilal", "al hilal"]],
  ["inter-miami", ["inter miami"]],
];

export const competitionAliases = [
  ["ligue-1", ["ligue 1"]],
  ["ligue-2", ["ligue 2"]],
  ["premier-league", ["premier league"]],
  ["la-liga", ["laliga", "la liga"]],
  ["serie-a", ["serie a"]],
  ["bundesliga", ["bundesliga"]],
  ["liga-portugal", ["liga portugal"]],
  ["eredivisie", ["eredivisie"]],
  ["champions-league", ["ligue des champions", "champions league"]],
  ["europa-league", ["ligue europa", "europa league"]],
  ["conference-league", ["ligue conférence", "conference league"]],
  ["club-world-cup", ["mondial des clubs", "coupe du monde des clubs"]],
];

export const nationAliases = [
  ["france", ["équipe de france", "bleus", "les bleues"]],
  ["belgium", ["équipe de belgique", "diables rouges"]],
  ["switzerland", ["équipe de suisse", "nati"]],
  ["morocco", ["équipe du maroc", "lions de l'atlas"]],
  ["algeria", ["équipe d'algérie", "fennecs"]],
  ["senegal", ["équipe du sénégal", "lions de la teranga"]],
  ["ivory-coast", ["équipe de côte d'ivoire", "éléphants"]],
  ["cameroon", ["équipe du cameroun", "lions indomptables"]],
  ["england", ["équipe d'angleterre", "three lions"]],
  ["spain", ["équipe d'espagne", "la roja"]],
  ["italy", ["équipe d'italie", "squadra azzurra"]],
  ["germany", ["équipe d'allemagne", "mannschaft"]],
  ["portugal", ["équipe du portugal", "seleção portugaise"]],
  ["netherlands", ["équipe des pays-bas", "oranje"]],
  ["brazil", ["équipe du brésil", "seleção brésilienne"]],
  ["argentina", ["équipe d'argentine", "albiceleste"]],
  ["uruguay", ["équipe d'uruguay", "celeste"]],
  ["usa", ["équipe des états-unis", "team usa"]],
  ["japan", ["équipe du japon", "samurai blue"]],
  ["south-korea", ["équipe de corée du sud"]],
];

// Nom officiel/complet de chaque club, compétition et sélection déjà cataloguée
// ci-dessus, utilisé pour détecter qu'un titre parle de football même sans les
// mots génériques ("football", "mercato"...). On prend la première variante de
// chaque entrée : elle est toujours la plus explicite (jamais un simple nom de
// ville ou de pays isolé), pour éviter les faux positifs.
export const topicGatePhrases = [
  ...teamAliases.map(([, aliases]) => aliases[0]),
  ...competitionAliases.map(([, aliases]) => aliases[0]),
  ...nationAliases.map(([, aliases]) => aliases[0]),
];
