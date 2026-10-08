# Assets

Everything here is discovered **at build time** (`import.meta.glob`). Drop a file in, rebuild, and the scene uses it.
Leave it out and a built-in placeholder is used instead — so the app always runs.

| File | What | Notes |
|---|---|---|
| `models/house.glb` | The whole house (visual) | Also used for collision unless `house-collision.glb` exists. Floor top at `y = 0`, +z south. |
| `models/house-collision.glb` | _optional_ low-poly physics proxy | Never rendered. Strongly recommended for heavy houses. Meshes named `NoCollide*` are ignored. |
| `models/character.glb` | Rigged humanoid | Auto-scaled to 1.75 m and grounded at its feet, so export scale/origin don't matter. Should face +z. |
| `models/animations.glb` | Animation clips on the **same rig** | If omitted, clips inside `character.glb` are used. |
| `models/props/<id>.glb` | Replaces one placeholder prop | Fitted into the placeholder's collision box. Ids: `sofa coffee-table tv-console plant-living desk chair bookshelf plant-studio counter fridge island stool-a stool-b bed nightstand wardrobe`. |
| `textures/<surface>/*.jpg` | Real PBR maps for a generated surface | Folder = `wood tile carpet plaster fabric grass veneer leather brushed stone paint`. Files by name: `*diff*`/`*color*`/`*albedo*`, `*nor*` (OpenGL), `*rough*` — Poly Haven / ambientCG downloads work as-is. Missing maps keep their generated version. |
| `hdri/home.hdr` (or `.exr`) | Image-based lighting | Any single `.hdr`/`.exr` works; `home.*` wins. 1k–2k is plenty for lighting. Without one the scene lights itself from a generated daylight sky. |

Animation clips are matched **by name pattern** (`src/lib/clips.ts`): `Idle_Loop`, `Walk_Loop`, `Jog_Fwd_Loop`/`Sprint_Loop`,
`Jump_Start`, `Jump_Loop`, `Jump_Land`; and `Interact` / `PickUp…` for gestures. Check names with the
[Quaternius animation viewer](https://quaternius.com/animviewer.html) and extend the patterns if a clip is missed.

## Recommended sources

- **House** — a furnished apartment/house GLB (e.g. Sketchfab "Modern apartment interior" by Katydid, ~60k tris). Check the license is CC-BY and **not** NC, then credit it in `CREDITS.md` + `src/data/credits.ts`. Sketchfab downloads need a free account.
- **Character + animations** — Quaternius [Universal Base Characters](https://quaternius.com/packs/universalbasecharacters.html) + [Universal Animation Library](https://quaternius.com/packs/universalanimationlibrary.html) (+ [2](https://quaternius.com/packs/universalanimationlibrary2.html)). CC0, shared humanoid rig.
- **HDRI, props, textures** — [Poly Haven](https://polyhaven.com), CC0.

## Getting better assets — what works from where

| Route | Needs | What you get |
|---|---|---|
| `npm run assets:fetch` | any host the environment can reach (`raw.githubusercontent.com` works from the cloud sandbox) | Everything in `scripts/assets.manifest.json`: today a Poly Haven HDRI (CC0, via the three.js repo) and three Khronos sample props — a velvet sofa, a slipper chair, a plant. Add rows for more. |
| `npm run assets:hdri -- list/hdri/model/texture …` | `api.polyhaven.com` + `dl.polyhaven.org` | The full Poly Haven catalogue (CC0): HDRIs, ~700 PBR models, ~700 PBR textures. **Blocked in the default cloud environment** — see below. |
| manual download | a browser | Sketchfab house (needs login), Quaternius character + animations (itch.io / quaternius.com), anything else. Drop into `models/raw/…`, then `npm run assets:optimize`. |

**Unblocking the sandbox:** in the session's environment settings (cloud environment menu → Edit → Network access) choose a broader level, or add
`polyhaven.com`, `api.polyhaven.com`, `dl.polyhaven.org`, `quaternius.com`, `ambientcg.com`, `sketchfab.com` under *Allowed domains*, then start a new session.
Poly Haven then needs only: `list models --category furniture`, pick, `model <id> --as sofa`, `npm run assets:optimize`.

Suggested pieces for the placeholders (search terms on polyhaven.com/models): sofa → *sofa*, coffee-table → *coffee table*, tv-console → *cabinet*,
bookshelf → *shelf*, desk → *table* / *desk*, chair → *chair*, bed → *bed*, nightstand → *drawer*, counter/island → kitchen cabinets, plants → *plant*,
plus textures: *wood floor*, *plaster*, *fabric*, *tiles*, *carpet*. Fabric/leather/metal props benefit most; flat walls and floors benefit from textures.

Licences in play: Poly Haven = CC0 (no credit needed, appreciated). Khronos samples vary per model (CC0 or CC-BY 4.0) — the manifest records each, and CC-BY ones
**must** stay credited in `CREDITS.md` and `src/data/credits.ts`.

## Pipeline

```bash
# 1. put raw downloads (final names) in src/assets/models/raw/  — git-ignored
#      raw/house.glb  raw/character.glb  raw/animations.glb  raw/props/sofa.glb
# 2. compress: meshopt geometry + WebP textures (2048 px max)
npm run assets:optimize
# 3. or fetch from the manifest / Poly Haven (needs network, see above)
npm run assets:fetch
npm run assets:hdri -- hdri <hdri-id> --res 2k --as home
npm run dev
```

GitHub limits: 100 MB per file (warning at 50 MB), ~1 GB per repo and Pages site. Past that, use Git LFS or host the models on a CDN
(Cloudflare R2) and point `registry.ts` at the URLs.
