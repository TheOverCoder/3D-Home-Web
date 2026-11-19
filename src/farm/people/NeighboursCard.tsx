import { m } from 'motion/react'
import { art } from '../../ui/art'
import { Check } from '../../ui/glyphs'
import { ItemPic } from '../../ui/ItemPic'
import { ITEM, PRESS } from '../../ui/motion'
import { PanelSheet } from '../../ui/PanelSheet'
import { Portrait } from '../../ui/Portrait'
import { Hearts } from './Hearts'
import { birthdayWords, type NeighboursView, type NeighbourRow } from './view'
import './NeighboursCard.css'

// The neighbours (the design layer: it draws a NeighboursView; ./NeighboursPanel.tsx feeds it the farm's), from the
// corner menu once one is met. Everyone in a row: a neighbour met with their portrait, name, hearts and how far to the
// next, the two goods they like and their birthday; one not met yet as a silhouette with the level they come at. Under
// them the story's road for the act on now — each chapter's writer, done with a ✓, the one on now glowing, the next as
// a silhouette with its level — and the letters read, to read again.

function Person({ p }: { p: NeighbourRow }) {
  return (
    <m.li className={`nb-person${p.met ? '' : ' unmet'}`} variants={ITEM}>
      <span className="nb-face">
        <Portrait who={p.who} size={60} move={false} />
      </span>
      <b className="nb-name">{p.met ? p.name : `Level ${p.level}`}</b>
      {p.met ? (
        <>
          <Hearts n={p.hearts} />
          <span className="nb-likes" aria-label={`Likes ${p.likes.join(' and ')}`}>
            {p.likes.map((g) => (
              <ItemPic key={g} id={g} />
            ))}
          </span>
          {p.birthday && (
            <span className="nb-birthday">
              <img className="art" src={art('birthday-cake')} alt="Birthday" />
              {birthdayWords(p.birthday)}
            </span>
          )}
        </>
      ) : (
        <span className="nb-soon">Moves in soon</span>
      )}
    </m.li>
  )
}

export function NeighboursCard({ v, onRead, onClose }: { v: NeighboursView; onRead: (id: string) => void; onClose: () => void }) {
  const met = v.people.filter((p) => p.met).length
  return (
    <PanelSheet
      label="Neighbours"
      title="Neighbours"
      pic={art('red-heart')}
      sub={
        <span className="tag">
          {met}/{v.people.length} met
        </span>
      }
      className="neighbours-card"
      onClose={onClose}
    >
      <m.ul className="nb-people">
        {v.people.map((p) => (
          <Person key={p.who} p={p} />
        ))}
      </m.ul>
      <m.section className="nb-story" variants={ITEM} aria-label={`The story, act ${v.act}`}>
        <h3 className="ribbon">Act {v.act}</h3>
        <ol className="nb-road">
          {v.road.map((c) => (
            <li key={c.id} className={`nb-stop ${c.state}`}>
              <span className="nb-stop-face">
                <Portrait who={c.who} size={40} move={false} />
                {c.state === 'done' && <Check className="nb-done" weight="bold" />}
              </span>
              <span className="nb-stop-words">
                <b>{c.state === 'next' || c.state === 'later' ? `Level ${c.level}` : c.title}</b>
                <small>{c.state === 'on' ? 'On the order board' : c.state === 'done' ? 'Done' : c.state === 'next' ? 'Next chapter' : 'Later'}</small>
              </span>
            </li>
          ))}
        </ol>
      </m.section>
      {v.letters.length > 0 && (
        <m.section className="nb-letters" variants={ITEM} aria-label="Letters to read again">
          <h3 className="ribbon">Letters</h3>
          <ul>
            {v.letters.map((l) => (
              <li key={l.id}>
                <m.button className="btn soft nb-letter" {...PRESS} onClick={() => onRead(l.id)} aria-label={`Read again: a letter from ${l.name}`}>
                  <Portrait who={l.from} size={34} move={false} />
                  <span>{l.name}</span>
                  <img className="art" src={art(l.kind === 'birthday' ? 'birthday-cake' : 'love-letter')} alt="" />
                </m.button>
              </li>
            ))}
          </ul>
        </m.section>
      )}
    </PanelSheet>
  )
}
