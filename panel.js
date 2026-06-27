// panel wiring. pulls the current picture from the worker and lets you pin or
// shuffle a station for this site, set the level, hush, or switch vibes off.

const el = (id) => document.getElementById(id);
let host = null;

// build the pin dropdown: auto, hush, one per vibe, then exact stations
function fillpin(vibestation, stations, current) {
  const sel = el("pin");
  sel.innerHTML = "";

  const opt = (value, label, parent) => {
    const o = document.createElement("option");
    o.value = value;
    o.textContent = label;
    if (value === current) o.selected = true;
    (parent || sel).appendChild(o);
  };

  opt("auto", "Auto - match the tab");
  opt("hush", "Hush this site");

  const byvibe = document.createElement("optgroup");
  byvibe.label = "by vibe";
  const vibes = Object.keys(vibestation);
  let i = 0;
  while (i < vibes.length) {
    opt(vibes[i], vibes[i], byvibe);
    i += 1;
  }
  sel.appendChild(byvibe);

  const bystation = document.createElement("optgroup");
  bystation.label = "pin a station";
  let j = 0;
  while (j < stations.length) {
    opt("station:" + stations[j].id, stations[j].name, bystation);
    j += 1;
  }
  sel.appendChild(bystation);
}

function fillstations(stations, liveid) {
  const ul = el("stations");
  ul.innerHTML = "";
  let i = 0;
  while (i < stations.length) {
    const s = stations[i];
    const li = document.createElement("li");
    if (s.id === liveid) li.className = "live";
    li.innerHTML = `<span>${s.name}</span><span class="f">${s.feel}</span>`;
    ul.appendChild(li);
    i += 1;
  }
}

async function paint() {
  const snap = await chrome.runtime.sendMessage({ type: "snapshot" });
  if (!snap) return;

  host = snap.host;
  el("host").textContent = host || "no tab here";
  el("vibe").textContent = snap.vibe || "—";

  const live = snap.prefs.on && !snap.prefs.hush && snap.station;
  el("card").classList.toggle("playing", !!live);
  el("station").textContent = snap.station ? snap.station.name : "silent";
  el("feel").textContent = (snap.station && live) ? snap.station.feel : "";

  el("on").checked = snap.prefs.on;
  el("yield").checked = snap.prefs.yield;
  el("level").value = Math.round(snap.prefs.level * 100);
  el("hush").classList.toggle("muted", snap.prefs.hush);
  el("warn").hidden = !snap.autoplayOff;

  fillpin(snap.vibeStation, snap.stations, snap.pin);
  fillstations(snap.stations, live ? snap.station.id : null);
}

// ---- wiring ----

el("on").addEventListener("change", async (e) => {
  await chrome.runtime.sendMessage({ type: "tune", patch: { on: e.target.checked } });
  paint();
});

el("hush").addEventListener("click", async () => {
  const muted = el("hush").classList.contains("muted");
  await chrome.runtime.sendMessage({ type: "tune", patch: { hush: !muted } });
  paint();
});

el("yield").addEventListener("change", async (e) => {
  await chrome.runtime.sendMessage({ type: "tune", patch: { yield: e.target.checked } });
  paint();
});

el("level").addEventListener("input", (e) => {
  // fire often while dragging, don't repaint the whole panel each tick
  chrome.runtime.sendMessage({ type: "tune", patch: { level: e.target.value / 100 } });
});

el("pin").addEventListener("change", async (e) => {
  if (!host) return;
  await chrome.runtime.sendMessage({ type: "pin", host, value: e.target.value });
  paint();
});

el("shuffle").addEventListener("click", async () => {
  if (!host) return;
  await chrome.runtime.sendMessage({ type: "shuffle", host });
  paint();
});

el("kick").addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "kick" });
  setTimeout(paint, 300);
});

paint();

// earlier fillstations that grouped the list by vibe with little headers.
// looked busy in a 312px popup, went back to the flat list.
// function fillstations_grouped(stations, vibestation, liveid) {
//   const ul = el("stations");
//   ul.innerHTML = "";
//   for (const vibe in vibestation) {
//     const head = document.createElement("li");
//     head.className = "group";
//     head.textContent = vibe;
//     ul.appendChild(head);
//     const s = stations.find((x) => x.id === vibestation[vibe]);
//     if (!s) continue;
//     const li = document.createElement("li");
//     if (s.id === liveid) li.className = "live";
//     li.innerHTML = `<span>${s.name}</span><span class="f">${s.feel}</span>`;
//     ul.appendChild(li);
//   }
// }

// flipped the pin select for a row of buttons once. select scales better.
// function fillpin_buttons(vibestation, stations, current) { /* ... */ }
