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
| `hdri/home.hdr` (or `.exr`) | Image-based lighting | Any single `.hdr`/`.exr` works; `home.*` wins. 1k–2k is plenty for lighting. |

Animation clips are matched **by name pattern** (`src/lib/clips.ts`): `Idle_Loop`, `Walk_Loop`, `Jog_Fwd_Loop`/`Sprint_Loop`,
`Jump_Start`, `Jump_Loop`, `Jump_Land`; and `Interact` / `PickUp…` for gestures. Check names with the
[Quaternius animation viewer](https://quaternius.com/animviewer.html) and extend the patterns if a clip is missed.

## Recommended sources

- **House** — a furnished apartment/house GLB (e.g. Sketchfab "Modern apartment interior" by Katydid, ~60k tris). Check the license is CC-BY and **not** NC, then credit it in `CREDITS.md` + `src/data/credits.ts`. Sketchfab downloads need a free account.
- **Character + animations** — Quaternius [Universal Base Characters](https://quaternius.com/packs/universalbasecharacters.html) + [Universal Animation Library](https://quaternius.com/packs/universalanimationlibrary.html) (+ [2](https://quaternius.com/packs/universalanimationlibrary2.html)). CC0, shared humanoid rig.
- **HDRI, props, textures** — [Poly Haven](https://polyhaven.com), CC0.

## Pipeline

```bash
# 1. put raw downloads (final names) in src/assets/models/raw/  — git-ignored
#      raw/house.glb  raw/character.glb  raw/animations.glb  raw/props/sofa.glb
# 2. compress: meshopt geometry + WebP textures (2048 px max)
npm run assets:optimize
# 3. Poly Haven HDRI straight into the project (needs network):
# pick an id on https://polyhaven.com/hdris (an indoor/studio one suits a house)
npm run assets:hdri -- hdri <hdri-id> --res 2k --as home
npm run dev
```

GitHub limits: 100 MB per file (warning at 50 MB), ~1 GB per repo and Pages site. Past that, use Git LFS or host the models on a CDN
(Cloudflare R2) and point `registry.ts` at the URLs.
