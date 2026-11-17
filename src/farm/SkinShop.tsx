import { m } from 'motion/react'
import { farmSound, uiClick } from '../audio/sound'
import { playGesture } from '../lib/gestures'
import { useHome } from '../store'
import { art } from '../ui/art'
import { Check, PaintRoller } from '../ui/glyphs'
import { ITEM, POP, SINK, SPRING, STAGGER } from '../ui/motion'
import { Coins, Shell } from '../ui/Shell'
import { useArmed } from '../ui/Sheet'
import type { ToolKind } from './data'
import { skinArtUrl } from './icons'
import type { SkinStyle } from './skins'
import { skinsView, type SkinCard, type SkinsView } from './skinsView'
import { buySkin, farm, toolOwned, useFarm, wearSkin } from './state'
import './SkinShop.css'

// A tool's skins shop (the user's request on the tools' board: each player picks how each tool looks, and buys the
// looks in a shop of their own): the tool's three skins side by side on round stages, each with its picture, its name and
// one button — Worn, Wear, or its price, which opens the card that asks first (its picture big, Cancel, an armed Buy).
// Opened from the tool's panel (its Skins: `openPanel({ kind: 'skins', tool, from })`, its ✕ back there). How it looks
// is SkinShopCard and SkinBuyCard, fed only with ./skinsView.ts; SkinShop reads the farm and does the buying
// (src/farm/state.ts: buySkin, wearSkin).

/** A coins chip, from the view (the purse as the panel was drawn). */
const CoinChip = ({ n }: { n: number }) => (
  <span className="tag">
    <img src={art('coin')} alt="" />
    {n}
  </span>
)

/** A skin's round stage and its picture (the worn one floats a little). */
function Stage({ src, worn, big = false }: { src: string; worn: boolean; big?: boolean }) {
  return (
    <div className={`skin-stage${big ? ' big' : ''}${worn ? ' worn' : ''}`}>
      <m.img
        // (made again as it is put on: it pops into place)
        key={worn ? 'worn' : 'not'}
        className="art skin-pic"
        src={src}
        alt=""
        variants={POP}
        initial="hidden"
        animate={worn ? { opacity: 1, scale: 1, y: [0, -4, 0] } : 'show'}
        transition={worn ? { y: { duration: 2.6, repeat: Infinity, ease: 'easeInOut' }, default: SPRING.pop } : SPRING.pop}
      />
    </div>
  )
}

/** One skin's button: worn already, the farm's to put on, or its price (which opens the card that asks first). */
function SkinButton({ v, s, onWear, onAsk }: { v: SkinsView; s: SkinCard; onWear: (style: SkinStyle) => void; onAsk: (style: SkinStyle) => void }) {
  if (s.state === 'worn')
    return (
      <button className="btn small soft skin-act" disabled aria-pressed="true" aria-label={`${s.name}: worn`}>
        <Check weight="bold" />
        Worn
      </button>
    )
  if (s.state === 'owned')
    return (
      <m.button className="btn small leaf skin-act" {...SINK} onClick={() => onWear(s.style)} aria-label={`Wear the ${s.name.toLowerCase()}`}>
        <PaintRoller weight="fill" />
        Wear
      </m.button>
    )
  return (
    <m.button className={`btn small skin-act${s.can ? '' : ' short'}`} {...SINK} disabled={!v.has} onClick={() => onAsk(s.style)} aria-label={`${s.name}, for ${s.price} coins`}>
      <Coins n={s.price} />
    </m.button>
  )
}

/** The shop: the tool's three skins, what it wears ringed in sun yellow. */
export function SkinShopCard({
  v,
  pic,
  onWear,
  onAsk,
  onClose,
}: {
  v: SkinsView
  /** a skin's picture */
  pic: (style: SkinStyle) => string
  onWear: (style: SkinStyle) => void
  onAsk: (style: SkinStyle) => void
  onClose: () => void
}) {
  return (
    <Shell
      title={`${v.tool} skins`}
      art={art(v.art)}
      sub={
        <>
          <CoinChip n={v.coins} />
          <span className="tag">
            {v.owned} of {v.of} yours
          </span>
        </>
      }
      onClose={onClose}
    >
      <p className="farm-line">{v.has ? `How your ${v.tool.toLowerCase()} looks at its fence.` : `Buy the ${v.tool.toLowerCase()} first, in the farm shop.`}</p>
      <m.div className="skin-shelf" variants={STAGGER} initial="hidden" animate="show">
        {v.skins.map((s) => (
          <m.div key={s.style} variants={ITEM} className={`skin-card ${s.state}`}>
            <Stage src={pic(s.style)} worn={s.state === 'worn'} />
            <span className="skin-name">{s.name}</span>
            <SkinButton v={v} s={s} onWear={onWear} onAsk={onAsk} />
          </m.div>
        ))}
      </m.div>
    </Shell>
  )
}

/** The card that asks before a skin is bought: its picture big, its price and what you have, Cancel, and Buy (armed a
 *  moment after it opens). */
export function SkinBuyCard({ v, style, pic, onBack, onBuy }: { v: SkinsView; style: SkinStyle; pic: string; onBack: () => void; onBuy: () => void }) {
  const armed = useArmed()
  const s = v.skins.find((k) => k.style === style)!
  const owned = s.state !== 'sale'
  return (
    <Shell
      title={s.name}
      art={art(v.art)}
      sub={
        <>
          <CoinChip n={v.coins} />
          <span className="tag">For your {v.tool.toLowerCase()}</span>
        </>
      }
      onClose={onBack}
    >
      <div className="skin-buy">
        <Stage src={pic} worn={false} big />
        <p className="farm-line">{owned ? 'It is yours already.' : `Your ${v.tool.toLowerCase()} wears it at once.`}</p>
      </div>
      <div className="farm-confirm">
        <button className="btn soft" onClick={onBack}>
          Cancel
        </button>
        <button className={`btn farm-buy${armed ? '' : ' arming'}`} disabled={!s.can} aria-disabled={!armed} onClick={() => armed && s.can && onBuy()}>
          {owned ? (
            <>
              <Check weight="bold" />
              Yours
            </>
          ) : s.can || !v.has ? (
            <>
              Buy · <Coins n={s.price} />
            </>
          ) : (
            <>Needs {s.price - v.coins} more</>
          )}
        </button>
      </div>
    </Shell>
  )
}

/** The farm's: the shop of a tool's skins, or (`buy`) the card that asks before one is bought. */
export function SkinShop({ tool, buy }: { tool: ToolKind; buy?: SkinStyle }) {
  useFarm((s) => s.rev)
  const openPanel = useHome((s) => s.openPanel)
  const closePanel = useHome((s) => s.closePanel)
  // opened from another panel (the tool's): its ✕ goes back there
  const from = useHome((s) => (s.panel?.kind === 'skins' ? s.panel.from : undefined))
  const v = skinsView(tool, farm.skins, toolOwned(tool) !== null, farm.coins)
  const shop = () => openPanel({ kind: 'skins', tool, from })
  if (buy)
    return (
      <SkinBuyCard
        v={v}
        style={buy}
        pic={skinArtUrl(tool, buy)}
        onBack={shop}
        onBuy={() => {
          if (!buySkin(tool, buy)) return
          farmSound('build')
          playGesture('interact')
          shop()
        }}
      />
    )
  return (
    <SkinShopCard
      v={v}
      pic={(style) => skinArtUrl(tool, style)}
      onWear={(style) => {
        if (wearSkin(tool, style)) farmSound('dress')
      }}
      onAsk={(style) => {
        uiClick()
        openPanel({ kind: 'skins', tool, buy: style, from })
      }}
      onClose={() => (from ? openPanel(from) : closePanel())}
    />
  )
}
