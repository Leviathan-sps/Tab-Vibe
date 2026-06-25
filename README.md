# Tab Vibe

Open a tab, get a soundtrack. That's the whole idea.

News sites go cinematic. Documentation goes quiet, the kind of quiet you can actually think in. Social feeds get something playful, and dev sites land on this retro-lounge thing I'm weirdly fond of. You don't pick any of it. Tab Vibe reads the page and chooses for you, and when it gets one wrong (it will, sometimes) you just pin a station you like or hit shuffle and let it roll the dice.

I built it because I always wanted music while I worked but never wanted to stop and go find it. Decision fatigue, over a playlist. A bit silly, but here we are.

## How it figures out the vibe

Two ways, really.

Most of the big sites it just knows. Wikipedia, BBC, GitHub, Amazon, YouTube, Spotify, that crowd. They sit in a little table that maps straight to a vibe, so there's nothing to work out.

For everything else it takes a quick look at the page itself, the title, the headings, some meta tags, a chunk of the body text, the og:type if the site bothered to set one. Then it counts keywords and makes a guess. So a shop it's never seen before still tends to end up on the shopping station. It's not clever, it's just pattern matching, but it's right more often than I expected it to be.

When it recognizes the site, it trusts that. The only time it talks itself out of the guess is when the page text is very loudly saying something else.

## Which vibe plays what

| Vibe | When it shows up | Station |
|------|------|---------|
| headlines | news | The Trip |
| markets | finance | Mission Control |
| docs | wikis, docs | n5MD Radio |
| feed | social | PopTron |
| arcade | gaming | Dubstep Beyond |
| cart | shopping | Indie Pop Rocks |
| screen | video | Underground 80s |
| forge | code, dev | Illinois St Lounge |
| stage | music | Covers |
| longform | blogs, and the fallback | Left Coast 70s |

They're all SomaFM stations, streaming around the clock, so nothing ever really ends.

## The panel

Click the icon and the controls are right there. One switch for on and off. A now-playing card with a tiny equalizer that actually moves while sound is going, which is a small thing but I like it.

Don't trust its pick on some site? The dropdown lets you take over: force Auto, hush that site for good, lock a whole vibe, or pin one exact station. Shuffle's next to it if you'd rather be surprised. Volume, mute, the usual stuff.

The part I actually use most is step back. The moment a tab starts making its own noise, a YouTube video, a song, whatever, Tab Vibe goes quiet on its own and comes back once the sound stops. Nothing fighting over your ears.

## Getting it running

It's not on a store yet, so you load it by hand:

1. Open chrome://extensions (brave://extensions works too).
2. Turn on Developer mode.
3. Load unpacked, and point it at the Tab-Vibe folder.

Chrome, Brave, Edge, any Chromium browser will take it.

## What's in here

- manifest.json - the MV3 manifest
- worker.js - the service worker, runs the show
- vibes.js - the brain: stations, the site map, the keyword scorer
- sniffer.js - reads each page and reports back what it found
- player.html / player.js - the hidden audio player that crossfades between stations
- panel.html / panel.css / panel.js - the popup you click
