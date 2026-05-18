import { describe, it, expect } from 'vitest'
import { rankVehicles } from '../scoring'

// rankVehicles is a pure function — test it is unaffected by the refactor
describe('rankVehicles (unchanged after scoring refactor)', () => {
  it('still assigns rank 1 to highest score', () => {
    expect(rankVehicles([10, 50, 30])[1]).toBe(1)
  })
})

// scoreRunList now reads from DB — tested via integration; skip unit test
// ingestRunList touches network/blob — tested via integration; skip unit test
