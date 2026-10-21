# Planet in progress: tiles

![Planet in progress, dark](logo-dark.png)

A planet that's still being built, for a company that's still growing. The sphere is made of flat-shaded tiles. The side facing the build direction is already laid, the rest is still bare scaffolding, and a dotted outline marks the full sphere. Three orange tiles are flying in toward their dashed sockets along the build edge. The wordmark underneath is set in Sora Bold.

The script places a latitude/longitude grid on a sphere and projects it straight onto the page. Each cell is then marked as laid or scaffold by how far it faces the build direction, plus some random jitter so the edge comes out ragged. Laid tiles are shaded by how much they face the light. Laid tiles on the far side are drawn darker, so gaps in the shell show its inside. [opentype.js](https://github.com/opentypejs/opentype.js) turns the wordmark into outlines, and [resvg](https://github.com/thx/resvg-js) renders the PNGs.

```sh
bun install
bun run build
```

| file | what |
| --- | --- |
| `logo-dark.svg` / `logo-dark.png` | sphere + wordmark on navy |
| `logo-light.svg` / `logo-light.png` | sphere + wordmark on off-white |
| `mark.svg` / `mark.png` | sphere only, transparent, works on light and dark |

The settings at the top of `index.js` control the camera tilt (`T`), spin (`YAW`), tile size (`STEP`), build direction (`B`), light (`L`), tile gaps (`GAP`), how ragged the build edge is (`JITTER`) and how far each incoming tile still has to travel (`FLIGHTS`). The random seed is fixed, so every build comes out the same.
