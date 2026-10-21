# Planet Renox logos

Logo designs for Planet Renox, written as code. Each design sits in its own folder under `designs/` and writes its SVG and PNG files next to its script.

```sh
bun install
bun run build
```

## designs/renox-as-planet

![Renox as a planet](designs/renox-as-planet/logo.png)

The word **Renox** is the planet. The script uses [opentype.js](https://github.com/opentypejs/opentype.js) to turn the word, set in Unbounded Black, into vector outlines, and splits every curve into many short segments. It then wraps each point around a 3D sphere with an orthographic projection. That way the letters curve over the globe and get squeezed toward its edges like real continents. Stacked shells raise the letters off the surface, and gradients light the whole planet from one light source. Clouds, an ice cap, an atmosphere glow, a few islands, a ring and a moon finish it off. [resvg](https://github.com/thx/resvg-js) renders the PNGs.

| file | what |
| --- | --- |
| `logo.svg` / `logo.png` | on a deep-space background |
| `logo-transparent.svg` / `logo-transparent.png` | planet only, transparent background |

The settings at the top of `index.js` control the camera tilt (`T`), how far the word wraps around the planet (`SPAN`), how high the letters rise (`RISE`), the letter spacing (`TRACK`), the light direction (`L`) and the ring bands (`RINGS`).
