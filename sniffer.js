// runs on every page. reads a small sample of the page, asks the brain which
// vibe it is, and reports that to the worker.

let lastping = "";

// pull a readable slice of the page without dragging the whole dom along
function sample() {
  const parts = [document.title];

  const desc = document.querySelector('meta[name="description"]');
  if (desc) parts.push(desc.content || "");
  const kw = document.querySelector('meta[name="keywords"]');
  if (kw) parts.push(kw.content || "");

  // headings are dense with meaning for cheap
  const heads = document.querySelectorAll("h1, h2");
  let i = 0;
  while (i < heads.length) {
    parts.push(heads[i].textContent || "");
    i += 1;
  }

  // a capped chunk of body text so we never read a whole novel
  parts.push((document.body ? document.body.innerText : "").slice(0, 4000));

  return parts.join(" ");
}

function ogtype() {
  const m = document.querySelector('meta[property="og:type"]');
  return m ? m.content : "";
}

function ping() {
  const host = location.hostname;
  const vibe = tabvibe.pickvibe(host, sample(), ogtype());

  // don't nag the worker when nothing changed
  const tag = host + "|" + vibe;
  if (tag === lastping) return;
  lastping = tag;

  chrome.runtime.sendMessage({ type: "sniff", host, vibe }).catch(() => {});
}

// first read once the page settles (late text)
setTimeout(ping, 600);

// re-read on focus and visibility
window.addEventListener("focus", ping);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) ping();
});

// cheap spa watch - url changes with no reload
let lasturl = location.href;
setInterval(() => {
  if (location.href !== lasturl) {
    lasturl = location.href;
    lastping = ""; // force a fresh read
    setTimeout(ping, 500);
  }
}, 1500);

// tried reacting to scroll depth too, felt noisy. left out.
// window.addEventListener("scroll", () => { ... });

// lighter sample() that only read the title + headings, no body. missed too many
// content-only sites, so the full read above stayed.
// function sample_light() {
//   const parts = [document.title];
//   document.querySelectorAll("h1, h2, h3").forEach((h) => parts.push(h.textContent || ""));
//   return parts.join(" ");
// }

// version of ping that re-read on a timer instead of on focus/spa. wasteful.
// setInterval(ping, 5000);
