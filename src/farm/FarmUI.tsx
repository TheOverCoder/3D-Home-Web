import { BuyDecor, DecorShop } from './DecorShop'
import { GoalsPanel } from './GoalsPanel'
import { AwayPanel, AwayWatcher } from './AwayPanel'
import { DailyPanel, DailyWatcher } from './DailyPanel'
import { StepHint } from './FirstSteps'
import { LevelUp } from './XpChip'
import { LevelPanel } from './LevelPanel'
import { WardrobePanel } from '../home/WardrobePanel'
import { ManagerPanel, MarketBuyPanel, MarketPanel, MarketPlacePanel } from './MarketPanel'
import { ContractorPanel } from './ContractorPanel'
import { EstatePanel, HouseBuyPanel } from './EstatePanel'
import { CarPanel } from './car/CarPanel'
import { LadderCard } from './Ladder'
import { ShopPanel } from './shop/ShopPanel'
import { MachinePanel, MachineSlotCard } from './MachinePanel'
import { SkinShop } from './SkinShop'
import { ToolPanel } from './ToolPanel'
import { NewsPanel, NewsWatcher } from './news/NewsPanel'
import { BedPanel } from './panels/Bed'
import { BuildPanel } from './panels/Build'
import { QueuePanel } from './panels/Queue'
import { SeedsPanel } from './panels/Seeds'
import './Xp.css'
import { AnimatePresence } from 'motion/react'
import './MarketPanel.css'
import { useHome } from '../store'
import { EditPanel } from './EditPanel'
import { TopDash } from './TopDash'
import { DecoratePanel } from '../home/DecoratePanel'
import { stopDecorating } from '../home/decorate'
import { BuyPiece, FurnitureShop } from '../home/FurnitureShop'
import { OrdersPanel } from './OrdersPanel'
import { StorePanel, StoreUpgradePanel } from './StorePanel'
import { GoodWaysContext } from '../ui/GoodPic'
import { PanelGuard } from '../ui/PanelGuard'
import { CardWatcher } from '../ui/useGameFree'
import { GAME_WAYS } from './goods/ways'
import { LetterPanel } from './people/LetterPanel'
import { NeighboursPanel } from './people/NeighboursPanel'

// The farm's interface: the dashboard at the top, the edit modes' cards, and a slot for each panel — each panel a file of
// its own (the seed packets, a bed's gear, a bed to build and the line at the gate in ./panels). Every slot is inside
// one guard (src/ui/PanelGuard.tsx): a panel that throws closes with a word, and the game plays on. A new panel is one
// slot line, appended to the list.

/** A number for each panel opened (the store gives a new panel object each time one opens): a card's key. */
const opened = new WeakMap<object, number>()
let opens = 0
const opening = (panel: object) => {
  if (!opened.has(panel)) opened.set(panel, ++opens)
  return opened.get(panel)
}

/** Leaves the farm's edit mode (its card failed). */
const leaveEdit = () => useHome.getState().setEditing(false)

/** The garden's interface: the dashboard at the top outdoors (./TopDash.tsx) and whichever farm panel is open. */
export function FarmUI() {
  const phase = useHome((s) => s.phase)
  const outdoors = useHome((s) => s.outdoors)
  const panel = useHome((s) => s.panel)
  const editing = useHome((s) => s.editing)
  const decorating = useHome((s) => s.decorating)
  if (phase !== 'playing') return null
  return (
    // every good's picture in these panels says where it is made, and its way there (src/ui/GoodPic.tsx)
    <GoodWaysContext.Provider value={GAME_WAYS}>
      <PanelGuard name="dashboard" layer>
        {(outdoors || panel || editing) && <TopDash />}
      </PanelGuard>
      <PanelGuard name={editing ? 'edit' : ''} close={leaveEdit}>
        <EditPanel />
      </PanelGuard>
      <PanelGuard name={decorating ? 'decorate' : ''} close={stopDecorating}>
        <DecoratePanel />
      </PanelGuard>
      <PanelGuard name={panel?.kind ?? ''}>
        {panel?.kind === 'seeds' && <SeedsPanel bed={panel.bed} />}
        {panel?.kind === 'build' && <BuildPanel bed={panel.bed} />}
        {panel?.kind === 'bed' && <BedPanel bed={panel.bed} />}
        {panel?.kind === 'furniture' && <FurnitureShop />}
        {panel?.kind === 'buy-piece' && <BuyPiece type={panel.type} />}
        {panel?.kind === 'decor-shop' && <DecorShop tab={panel.tab} />}
        {panel?.kind === 'decor-buy' && <BuyDecor item={panel.item} />}
        {panel?.kind === 'queue' && <QueuePanel />}
        {panel?.kind === 'shop' && <ShopPanel />}
        {panel?.kind === 'store' && <StorePanel store={panel.store} />}
        {panel?.kind === 'store-upgrade' && <StoreUpgradePanel store={panel.store} />}
        {/* one element for both: the card that asks for an upgrade opens over the board, never a board again */}
        {(panel?.kind === 'orders' || panel?.kind === 'office-upgrade') && <OrdersPanel asking={panel.kind === 'office-upgrade' ? panel.id : null} />}
        {panel?.kind === 'away' && <AwayPanel />}
        {panel?.kind === 'manager' && <ManagerPanel />}
        {panel?.kind === 'market' && <MarketPanel />}
        {panel?.kind === 'market-place' && <MarketPlacePanel place={panel.place} />}
        {panel?.kind === 'market-buy' && <MarketBuyPanel />}
        {panel?.kind === 'contractor' && <ContractorPanel />}
        {panel?.kind === 'car' && <CarPanel />}
        {panel?.kind === 'estate' && <EstatePanel />}
        {panel?.kind === 'house-buy' && <HouseBuyPanel />}
        {panel?.kind === 'ladder' && <LadderCard id={panel.id} />}
        {panel?.kind === 'machine' && <MachinePanel key={panel.id} id={panel.id} from={panel.from} />}
        {panel?.kind === 'tool' && <ToolPanel key={panel.tool} tool={panel.tool} from={panel.from} />}
        {panel?.kind === 'machine-slot' && <MachineSlotCard id={panel.id} />}
        {panel?.kind === 'skins' && <SkinShop tool={panel.tool} buy={panel.buy} />}
        {/* the level's card goes out the way it came in (src/ui/PanelSheet.tsx); opened again while it is still going,
            it is a new card (a key of its own each time), never the one leaving brought back */}
        <AnimatePresence>{panel?.kind === 'level' && <LevelPanel key={`level-${opening(panel)}`} />}</AnimatePresence>
        {/* the goals board (the medal case): out the way it came in, as the level's card */}
        <AnimatePresence>{panel?.kind === 'goals' && <GoalsPanel key={`goals-${opening(panel)}`} />}</AnimatePresence>
        {/* the farm news (the corner menu's): the week's events and the lucky draw, going out the way it came in */}
        <AnimatePresence>{panel?.kind === 'news' && <NewsPanel key={`news-${opening(panel)}`} />}</AnimatePresence>
        {/* the daily gift: out the way it came in, as the level's card */}
        <AnimatePresence>{panel?.kind === 'daily' && <DailyPanel key={`daily-${opening(panel)}`} />}</AnimatePresence>
        {panel?.kind === 'wardrobe' && <WardrobePanel />}
        <AnimatePresence>{panel?.kind === 'letter' && <LetterPanel key={`letter-${opening(panel)}`} id={panel.id} again={panel.again} />}</AnimatePresence>
        <AnimatePresence>{panel?.kind === 'neighbours' && <NeighboursPanel key={`neighbours-${opening(panel)}`} />}</AnimatePresence>
      </PanelGuard>
      <PanelGuard name="level-up" layer>
        <LevelUp />
      </PanelGuard>
      {/* the cards that open by themselves, each offered to the queue that opens them (src/ui/cardQueue.ts), one at
          a time, two a visit at most */}
      <PanelGuard name="watchers" layer>
        <AwayWatcher />
        <NewsWatcher />
        <DailyWatcher />
        <CardWatcher />
      </PanelGuard>
      <PanelGuard name="first-steps" layer>
        <StepHint />
      </PanelGuard>
    </GoodWaysContext.Provider>
  )
}
