import { describe, it, expect } from 'vitest'
import { parseInventoryCsv } from '../inventory-parser'

const CSV = `VIN,Year,Make,Model,Trim
1HGBH41JXMN109186,2022,Honda,Civic,EX
2T1BURHE0JC034620,2018,Toyota,Corolla,LE`

describe('parseInventoryCsv', () => {
  it('parses all valid rows', () => {
    expect(parseInventoryCsv(CSV)).toHaveLength(2)
  })

  it('maps required fields correctly', () => {
    const [v] = parseInventoryCsv(CSV)
    expect(v.vin).toBe('1HGBH41JXMN109186')
    expect(v.year).toBe(2022)
    expect(v.make).toBe('Honda')
    expect(v.model).toBe('Civic')
    expect(v.trim).toBe('EX')
  })

  it('accepts lowercase column headers', () => {
    const csv = `vin,year,make,model\n1HGBH41JXMN109186,2022,Honda,Civic`
    const [v] = parseInventoryCsv(csv)
    expect(v.vin).toBe('1HGBH41JXMN109186')
  })

  it('skips rows missing vin', () => {
    const csv = `VIN,Year,Make,Model\n,2022,Honda,Civic`
    expect(parseInventoryCsv(csv)).toHaveLength(0)
  })

  it('skips rows with non-numeric year', () => {
    const csv = `VIN,Year,Make,Model\n1HGBH41JXMN109186,N/A,Honda,Civic`
    expect(parseInventoryCsv(csv)).toHaveLength(0)
  })

  it('trim is undefined when column is absent', () => {
    const csv = `VIN,Year,Make,Model\n1HGBH41JXMN109186,2022,Honda,Civic`
    const [v] = parseInventoryCsv(csv)
    expect(v.trim).toBeUndefined()
  })
})
