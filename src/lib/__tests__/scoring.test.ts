import { describe, it, expect } from 'vitest'
import { rankVehicles } from '../scoring'

describe('rankVehicles', () => {
  it('assigns rank 1 to the vehicle with the highest score', () => {
    const ranks = rankVehicles([10, 50, 30])
    expect(ranks[1]).toBe(1)
  })

  it('assigns the last rank to the vehicle with the lowest score', () => {
    const ranks = rankVehicles([10, 50, 30])
    expect(ranks[0]).toBe(3)
  })

  it('handles a single vehicle — rank is always 1', () => {
    const ranks = rankVehicles([42])
    expect(ranks[0]).toBe(1)
  })

  it('handles ties by stable ordering (first occurrence wins lower rank number)', () => {
    const ranks = rankVehicles([20, 20, 10])
    expect(ranks[0]).toBe(1)
    expect(ranks[1]).toBe(2)
    expect(ranks[2]).toBe(3)
  })

  it('returns an empty array for empty input', () => {
    expect(rankVehicles([])).toHaveLength(0)
  })

  it('returns an array the same length as input', () => {
    const ranks = rankVehicles([5, 3, 8, 1, 9])
    expect(ranks).toHaveLength(5)
  })
})
