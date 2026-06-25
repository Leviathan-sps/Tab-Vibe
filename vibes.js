// shared brain. stations, the host->vibe table, and a tiny text scorer for sites
// we don't know. plain script so the sniffer and the worker can both load it.

// somafm streams. id is what we store, url is what the audio element plays.
const stations = [
  { id: "thetrip",        name: "The Trip",            feel: "cinematic, moody",         url: "https://ice.somafm.com/thetrip-128-mp3" },
  { id: "missioncontrol", name: "Mission Control",     feel: "focused, spacey",          url: "https://ice.somafm.com/missioncontrol-128-mp3" },
  { id: "n5md",           name: "n5MD Radio",          feel: "heads-down experimental",  url: "https://ice.somafm.com/n5md-128-mp3" },
  { id: "poptron",        name: "PopTron",             feel: "playful electro-pop",      url: "https://ice.somafm.com/poptron-128-mp3" },
  { id: "dubstep",        name: "Dubstep Beyond",      feel: "bassy, game-ready",        url: "https://ice.somafm.com/dubstep-128-mp3" },
  { id: "indiepop",       name: "Indie Pop Rocks",     feel: "upbeat indie",             url: "https://ice.somafm.com/indiepop-128-mp3" },
  { id: "u80s",           name: "Underground 80s",     feel: "neon synth",               url: "https://ice.somafm.com/u80s-128-mp3" },
  { id: "illstreet",      name: "Illinois Street Lounge", feel: "retro lounge",          url: "https://ice.somafm.com/illstreet-128-mp3" },
  { id: "seventies",      name: "Left Coast 70s",      feel: "mellow, sunlit",           url: "https://ice.somafm.com/seventies-128-mp3" },
  { id: "covers",         name: "Covers",              feel: "familiar, reimagined",     url: "https://ice.somafm.com/covers-128-mp3" },
  { id: "suburbsofgoa",   name: "Suburbs of Goa",      feel: "world, wandering",         url: "https://ice.somafm.com/suburbsofgoa-128-mp3" },
  { id: "bootliquor",     name: "Boot Liquor",         feel: "americana dust",           url: "https://ice.somafm.com/bootliquor-128-mp3" },
];

// each vibe points at a station id
const vibestation = {
  headlines: "thetrip",        // news
  markets:   "missioncontrol", // finance
  docs:      "n5md",           // wikis / docs
  feed:      "poptron",        // social
  arcade:    "dubstep",        // gaming
  cart:      "indiepop",       // shopping
  screen:    "u80s",           // video
  forge:     "illstreet",      // code / dev
  stage:     "covers",         // music
  longform:  "seventies",      // blogs, the default
};

// known hosts -> vibe. matched by exact host, subdomain or substring.
const hostvibe = {
  "wikipedia.org": "docs", "wiktionary.org": "docs", "arxiv.org": "docs",
  "developer.mozilla.org": "forge", "stackoverflow.com": "forge", "github.com": "forge",
  "gitlab.com": "forge", "npmjs.com": "forge",
  "nytimes.com": "headlines", "bbc.com": "headlines", "bbc.co.uk": "headlines",
  "cnn.com": "headlines", "theguardian.com": "headlines", "reuters.com": "headlines",
  "apnews.com": "headlines",
  "bloomberg.com": "markets", "wsj.com": "markets", "tradingview.com": "markets",
  "coinbase.com": "markets", "finance.yahoo.com": "markets",
  "twitter.com": "feed", "x.com": "feed", "reddit.com": "feed",
  "facebook.com": "feed", "instagram.com": "feed", "tiktok.com": "feed",
  "mastodon.social": "feed", "bsky.app": "feed",
  "amazon.com": "cart", "ebay.com": "cart", "etsy.com": "cart",
  "aliexpress.com": "cart", "walmart.com": "cart",
  "youtube.com": "screen", "netflix.com": "screen", "twitch.tv": "screen", "vimeo.com": "screen",
  "spotify.com": "stage", "soundcloud.com": "stage", "bandcamp.com": "stage",
  "store.steampowered.com": "arcade", "ign.com": "arcade", "chess.com": "arcade",
};

// keyword buckets for the content read when the host is unknown
const lexicon = {
  headlines: ["breaking", "reporter", "headline", "published", "associated press", "correspondent", "developing story"],
  markets:   ["stock", "earnings", "market cap", "portfolio", "nasdaq", "ticker", "dividend", "crypto", "interest rate"],
  docs:      ["encyclopedia", "documentation", "reference", "definition", "according to", "citation", "cite", "wiki"],
  feed:      ["follow", "followers", "like", "retweet", "comment", "your feed", "trending", "post", "share this"],
  arcade:    ["gameplay", "level up", "achievement", "multiplayer", "respawn", "loot", "speedrun", "boss fight"],
  cart:      ["add to cart", "checkout", "buy now", "free shipping", "in stock", "add to bag", "price", "best seller"],
  screen:    ["watch", "episode", "subscribe", "views", "playlist", "now playing", "stream", "trailer"],
  forge:     ["function", "repository", "commit", "npm install", "api", "compile", "stack trace", "const ", "git clone"],
  stage:     ["album", "tracklist", "listen", "discography", "artist", "lyrics", "playlist"],
  longform:  ["read more", "minute read", "posted on", "by the author", "blog", "newsletter", "subscribe to read"],
};

// host -> vibe, or null if we don't know it
function vibeforhost(host) {
  const h = (host || "").toLowerCase();
  const domains = Object.keys(hostvibe);
  let i = 0;
  while (i < domains.length) {
    const d = domains[i];
    if (h === d || h.endsWith("." + d) || h.includes(d)) return hostvibe[d];
    i += 1;
  }
  return null;
}

// tally the page text into vibe buckets, og:type gives a nudge
function scoretext(text, ogtype) {
  const t = (text || "").toLowerCase();
  const tally = {};
  const cats = Object.keys(lexicon);

  let i = 0;
  while (i < cats.length) {
    const cat = cats[i];
    const words = lexicon[cat];
    let hits = 0;
    let j = 0;
    while (j < words.length) {
      if (t.includes(words[j])) hits += 1;
      j += 1;
    }
    tally[cat] = hits;
    i += 1;
  }

  const og = (ogtype || "").toLowerCase();
  if (og.includes("article")) tally.headlines += 2;
  if (og.includes("video")) tally.screen += 3;
  if (og.includes("product")) tally.cart += 3;
  if (og.includes("music") || og.includes("song")) tally.stage += 3;
  if (og.includes("profile")) tally.feed += 2;

  let best = "longform";
  let top = 0;
  const keys = Object.keys(tally);
  let k = 0;
  while (k < keys.length) {
    if (tally[keys[k]] > top) { top = tally[keys[k]]; best = keys[k]; }
    k += 1;
  }
  return { vibe: best, tally };
}

// blend host + content. host wins when known unless the text shouts otherwise.
function pickvibe(host, text, ogtype) {
  const fromhost = vibeforhost(host);
  const r = scoretext(text, ogtype);

  if (fromhost) {
    if (r.tally[r.vibe] >= 4 && r.vibe !== fromhost) return r.vibe;
    return fromhost;
  }
  return r.vibe;
}

function stationforvibe(vibe) {
  return vibestation[vibe] || "seventies";
}

function stationbyid(id) {
  let i = 0;
  while (i < stations.length) {
    if (stations[i].id === id) return stations[i];
    i += 1;
  }
  return stations[0];
}

// nudge the vibe darker late at night. didn't love it, leaving it off.
// function nighttint(vibe) {
//   const hour = new Date().getHours();
//   if (hour >= 23 || hour < 5) return "longform";
//   return vibe;
// }

// second mapping that sent the calmer vibes to different stations. a/b'd it,
// kept the one above.
// const vibestation_alt = {
//   headlines: "thetrip", markets: "n5md", docs: "missioncontrol",
//   feed: "indiepop", arcade: "dubstep", cart: "poptron",
//   screen: "thetrip", forge: "n5md", stage: "covers", longform: "illstreet",
// };

// earlier vibeforhost that matched on regex instead of substring. substring won.
// function vibeforhost_re(host) {
//   const h = (host || "").toLowerCase();
//   for (const d in hostvibe) {
//     if (new RegExp("(^|\\.)" + d.replace(/\./g, "\\.") + "$").test(h)) return hostvibe[d];
//   }
//   return null;
// }

globalThis.tabvibe = {
  stations, vibestation, hostvibe, lexicon,
  vibeforhost, scoretext, pickvibe, stationforvibe, stationbyid,
};
