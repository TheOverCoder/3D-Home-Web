import { art } from '../../ui/art'
import { MOST_HEARTS } from './friends'
import './Hearts.css'

/** A neighbour's hearts (src/farm/people/friends.ts): as many filled as they have, the rest faint, of the most, on their
 *  letter and in the neighbours' sheet. `chip`: one heart and how many, a chip among the others (the line at the gate,
 *  where a row keeps to a phone's width). */
export function Hearts({ n, chip = false }: { n: number; chip?: boolean }) {
  const label = `${n} of ${MOST_HEARTS} hearts`
  if (chip)
    return (
      <span className="people-hearts tag" role="img" aria-label={label}>
        <img className="art" src={art('red-heart')} alt="" draggable={false} />
        {n}
      </span>
    )
  return (
    <span className="people-hearts" role="img" aria-label={label}>
      {Array.from({ length: MOST_HEARTS }, (_, k) => (
        <img key={k} className={`art${k < n ? '' : ' empty'}`} src={art('red-heart')} alt="" draggable={false} />
      ))}
    </span>
  )
}
