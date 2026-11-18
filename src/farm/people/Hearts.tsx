import { art } from '../../ui/art'
import { MOST_HEARTS } from './friends'
import './Hearts.css'

/** A neighbour's hearts (src/farm/people/friends.ts): as many filled as they have, the rest faint, of the most. Beside
 *  their name in the line at the gate, on their letter and in the neighbours' sheet. */
export function Hearts({ n }: { n: number }) {
  return (
    <span className="people-hearts" role="img" aria-label={`${n} of ${MOST_HEARTS} hearts`}>
      {Array.from({ length: MOST_HEARTS }, (_, k) => (
        <img key={k} className={`art${k < n ? '' : ' empty'}`} src={art('red-heart')} alt="" draggable={false} />
      ))}
    </span>
  )
}
