// the coordinator. knows the front tab, its vibe, folds in any per-site pin plus
// the user prefs, and tells the offscreen player what to stream.

importScripts("vibes.js");

// what the sniffer last said per tab: tabid -> { host, vibe }
const seen = {};
let fronttab = null;
let autoplayoff = false; // set when the browser refuses to autoplay

const baseline = { on: true, level: 0.5, hush: false, yield: true };

async function getprefs() {
  const o = await chrome.storage.local.get("prefs");
  return { ...baseline, ...(o.prefs || {}) };
}
async function getpins() {
  const o = await chrome.storage.local.get("pins");
  return o.pins || {};
}

// ---- offscreen player plumbing ----

async function playerlive() {
  const ctx = await chrome.runtime.getContexts({ contextTypes: ["OFFSCREEN_DOCUMENT"] });
  return ctx.length > 0;
}
let spawning = null;
async function ensureplayer() {
  if (await playerlive()) return;
  if (!spawning) {
    spawning = chrome.offscreen.createDocument({
      url: "player.html",
      reasons: ["AUDIO_PLAYBACK"],
      justification: "stream the ambient station for the active tab",
    });
  }
  await spawning;
  spawning = null;
}
function toplayer(msg) {
  chrome.runtime.sendMessage({ to: "player", ...msg }).catch(() => {});
}

// ---- the decision ----

// work out which station (if any) the front tab should hear
async function decide() {
  if (fronttab == null || !seen[fronttab]) return null;
  const { host, vibe } = seen[fronttab];
  const pinned = (await getpins())[host];

  let stationid;
  if (!pinned || pinned === "auto") {
    stationid = tabvibe.stationforvibe(vibe);
  } else if (pinned === "hush") {
    return { host, vibe, station: null };
  } else if (pinned.startsWith("station:")) {
    stationid = pinned.slice(8);
  } else {
    stationid = tabvibe.stationforvibe(pinned); // pinned is a vibe name
  }

  return { host, vibe, station: tabvibe.stationbyid(stationid) };
}

// is the page making its own audio (video, music...)?
async function siteloud() {
  if (fronttab == null) return false;
  try {
    const t = await chrome.tabs.get(fronttab);
    return !!t.audible;
  } catch (e) {
    return false;
  }
}

// push the current decision out to the player
async function apply() {
  const p = await getprefs();
  const d = await decide();
  const stepback = p.yield && (await siteloud());

  if (!p.on || p.hush || stepback || !d || !d.station) {
    toplayer({ type: "stop" });
    return;
  }
  await ensureplayer();
  toplayer({ type: "play", url: d.station.url, level: p.level });
}

// ---- tab tracking ----

chrome.runtime.onStartup.addListener(syncfront);
chrome.runtime.onInstalled.addListener(syncfront);
async function syncfront() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (tab) fronttab = tab.id;
}

chrome.tabs.onActivated.addListener(({ tabId }) => {
  fronttab = tabId;
  autoplayoff = false;
  apply();
});

chrome.windows.onFocusChanged.addListener(async (winid) => {
  if (winid === chrome.windows.WINDOW_ID_NONE) return;
  const [tab] = await chrome.tabs.query({ active: true, windowId: winid });
  if (tab) { fronttab = tab.id; apply(); }
});

chrome.tabs.onUpdated.addListener((tabid, info) => {
  if (tabid !== fronttab) return;
  if (info.url || info.status === "loading") delete seen[tabid]; // stale guess
  if (info.audible !== undefined) apply();                       // duck / un-duck
});

chrome.tabs.onRemoved.addListener((tabid) => {
  delete seen[tabid];
});

// ---- messages ----

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  // a page reported what it is
  if (msg.type === "sniff" && sender.tab) {
    seen[sender.tab.id] = { host: msg.host, vibe: msg.vibe };
    if (sender.tab.id === fronttab) apply();
    return;
  }

  // player says autoplay got blocked
  if (msg.type === "autoplayoff") {
    autoplayoff = true;
    return;
  }

  // panel asking for the current picture
  if (msg.type === "snapshot") {
    (async () => {
      const p = await getprefs();
      const pins = await getpins();
      const d = await decide();
      reply({
        prefs: p,
        autoplayOff: autoplayoff,
        host: d ? d.host : null,
        vibe: d ? d.vibe : null,
        station: d ? d.station : null,
        pin: d ? pins[d.host] || "auto" : "auto",
        stations: tabvibe.stations,
        vibeStation: tabvibe.vibestation,
      });
    })();
    return true;
  }

  // panel changed a pref
  if (msg.type === "tune") {
    (async () => {
      const p = { ...(await getprefs()), ...msg.patch };
      await chrome.storage.local.set({ prefs: p });
      if (msg.patch.level != null) toplayer({ type: "level", level: p.level });
      await apply();
      reply && reply({ ok: true });
    })();
    return true;
  }

  // panel pinned a station / vibe for this host
  if (msg.type === "pin") {
    (async () => {
      const pins = await getpins();
      if (!msg.value || msg.value === "auto") delete pins[msg.host];
      else pins[msg.host] = msg.value;
      await chrome.storage.local.set({ pins });
      await apply();
      reply && reply({ ok: true });
    })();
    return true;
  }

  // panel hit shuffle: pin a random station for this host
  if (msg.type === "shuffle") {
    (async () => {
      const list = tabvibe.stations;
      const choice = list[Math.floor(Math.random() * list.length)];
      const pins = await getpins();
      pins[msg.host] = "station:" + choice.id;
      await chrome.storage.local.set({ pins });
      await apply();
      reply && reply({ ok: true, id: choice.id });
    })();
    return true;
  }

  // user tapped start in the panel (a gesture that beats the autoplay block)
  if (msg.type === "kick") {
    autoplayoff = false;
    apply();
    return;
  }
});

// earlier decide() that ignored pins and always followed the vibe. too blunt,
// people wanted to lock a station per site.
// async function decide_auto() {
//   if (fronttab == null || !seen[fronttab]) return null;
//   const { host, vibe } = seen[fronttab];
//   return { host, vibe, station: tabvibe.stationbyid(tabvibe.stationforvibe(vibe)) };
// }

// variant siteloud that also treated muted-but-playing tabs as loud. dropped,
// muted tabs shouldn't duck us.
// async function siteloud_strict() {
//   if (fronttab == null) return false;
//   try {
//     const t = await chrome.tabs.get(fronttab);
//     return !!t.audible || !!t.mutedInfo?.muted;
//   } catch (e) { return false; }
// }
