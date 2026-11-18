import { describe, expect, it } from 'vitest'
import pkg from '../package.json'
import allowed from './deps.allowed.json'

// Every package is upkeep. One joins package.json only after the vetting in update-v1/REUSE.md, with its name on
// deps.allowed.json; the list holds exactly what is installed, so a package taken out and put back is vetted again.
const installed = [...Object.keys(pkg.dependencies), ...Object.keys(pkg.devDependencies)]
const approved = new Set(allowed.packages)

describe('dependencies', () => {
  it('are all on the approved list', () => {
    const unlisted = installed.filter((name) => !approved.has(name))
    expect(unlisted, `Not on the approved list (src/deps.allowed.json): ${unlisted.join(', ')}. Vet each as update-v1/REUSE.md describes, add its row there, then its name to the list.`).toEqual([])
  })

  it('leave the list when they leave package.json', () => {
    const gone = allowed.packages.filter((name) => !installed.includes(name))
    expect(gone, `On src/deps.allowed.json but no longer in package.json: ${gone.join(', ')}. Take them off the list, so they are vetted again if they come back.`).toEqual([])
  })
})
