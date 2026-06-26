// the one spot audio actually plays. worker sends play / stop / level here. a
// short crossfade keeps tab switches from being a jump-cut.

const stream = document.getElementById("stream");
stream.loop = true; // never run out
let goallevel = 0.5;
let ramp = null;
let wanturl = ""; // what we should be playing, kept for reconnects

// streams drop sometimes. if it errors or ends while we still want sound, retry.
function reconnect() {
  if (!wanturl) return;
  setTimeout(() => {
    stream.src = wanturl;
    stream.play().catch(() => {});
  }, 1500);
}
stream.addEventListener("error", reconnect);
stream.addEventListener("ended", reconnect);

// ease the real volume toward a goal over ~half a second
function glide(to, done) {
  if (ramp) clearInterval(ramp);
  ramp = setInterval(() => {
    const gap = to - stream.volume;
    if (Math.abs(gap) < 0.04) {
      stream.volume = to;
      clearInterval(ramp);
      ramp = null;
      if (done) done();
    } else {
      stream.volume = Math.min(1, Math.max(0, stream.volume + gap * 0.2));
    }
  }, 30);
}

async function start(url, level) {
  goallevel = level;
  wanturl = url;

  // already on this stream? just settle the level.
  if (stream.src === url && !stream.paused) {
    glide(level);
    return;
  }
  // new stream: fade the old one down, swap, fade up.
  glide(0, async () => {
    stream.src = url;
    stream.volume = 0;
    try {
      await stream.play();
      glide(goallevel);
    } catch (e) {
      // autoplay blocked - let the worker know so the panel can prompt
      chrome.runtime.sendMessage({ type: "autoplayoff" }).catch(() => {});
    }
  });
}

function halt() {
  wanturl = ""; // deliberate stop, don't reconnect
  glide(0, () => stream.pause());
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.to !== "player") return;
  if (msg.type === "play") start(msg.url, msg.level);
  else if (msg.type === "stop") halt();
  else if (msg.type === "level") glide(msg.level);
});

// linear version of glide - fixed step instead of easing toward the goal. the
// eased one above sounds smoother, kept it.
// function glide_linear(to, done) {
//   if (ramp) clearInterval(ramp);
//   const step = to > stream.volume ? 0.03 : -0.03;
//   ramp = setInterval(() => {
//     stream.volume = Math.min(1, Math.max(0, stream.volume + step));
//     if ((step > 0 && stream.volume >= to) || (step < 0 && stream.volume <= to)) {
//       stream.volume = to; clearInterval(ramp); ramp = null; if (done) done();
//     }
//   }, 30);
// }

// hard cut instead of a crossfade. snappier but jarring between tabs. unused.
// function start_hard(url, level) {
//   wanturl = url; stream.src = url; stream.volume = level;
//   stream.play().catch(() => chrome.runtime.sendMessage({ type: "autoplayoff" }));
// }
