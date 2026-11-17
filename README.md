# AB Media — landing page, version 2

Same purpose, content, media and Rust server as `abmedia-site`, with a new design:
night, tungsten and REC red, no 3D, every section with its own animation.

| Section | Animation |
|---|---|
| Opening | film leader 3-2-1; the film plays inside the AB MEDIA letters under a projector beam; scrolling zooms through the "I" into the film, then "Be known. Be trusted." |
| Manifesto | 100 people: 88 fade as the ad is forgotten, the story lights 21 back up and 6 start to trust |
| Numbers | odometer digits roll in, the row drifts with the scroll |
| Customer journey | one ribbon of people narrows at each stage; lost people sink away; the story campaign widens it |
| Ads vs story | red and tungsten lines glow as a playhead runs; one red flash at the ad peak |
| Work | client names lean with scroll speed; films develop from a negative; two films, the rest behind "More films" |
| What we fix | the problem is struck out, the fix decodes in its place |
| Abror | the photo opens through blinds |
| Process | the big step number rolls to the step in view |
| Planner | the answer is a storyboard with a light running along it |
| Request | three frames open like an iris |
| Footer | the wordmark lights up under the cursor |

Pinned scenes move one step per scroll, slow or fast.

## Run

```
cargo run --release            # http://127.0.0.1:8090
cargo run --release -- export  # writes index.html for static hosting (Vercel)
```

Numbers and contacts live in `src/content.rs` (values marked `TAXMINIY` are estimates).
Texts in four languages are in `static/i18n.js`.
