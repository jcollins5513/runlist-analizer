import { describe, it, expect } from 'vitest'
import { parseRunList } from '../csv-parser'
import type { ColumnMap } from '@/types'

const MANHEIM_MAP: ColumnMap = {
  vin: 'Vin',
  year: 'Year',
  make: 'Make',
  model: 'Model',
  trim: 'Trim',
  odometer: 'Odometer Value',
  crGrade: 'Condition Report Grade',
  mmr: 'MMR',
}

const CSV = `Vin,Year,Make,Model,Trim,Odometer Value,Condition Report Grade,MMR
1HGBH41JXMN109186,2022,Honda,Civic,EX,"45,000",3.5,15000
2T1BURHE0JC034620,2018,Toyota,Corolla,LE,"62,000",4.0,$12,500`

describe('parseRunList', () => {
  it('returns one vehicle per valid CSV row', () => {
    const vehicles = parseRunList(CSV, MANHEIM_MAP)
    expect(vehicles).toHaveLength(2)
  })

  it('maps vin, year, make, model correctly', () => {
    const [v] = parseRunList(CSV, MANHEIM_MAP)
    expect(v.vin).toBe('1HGBH41JXMN109186')
    expect(v.year).toBe(2022)
    expect(v.make).toBe('Honda')
    expect(v.model).toBe('Civic')
  })

  it('parses crGrade as float', () => {
    const [v] = parseRunList(CSV, MANHEIM_MAP)
    expect(v.crGrade).toBe(3.5)
  })

  it('parses odometer stripping commas', () => {
    const [v] = parseRunList(CSV, MANHEIM_MAP)
    expect(v.odometer).toBe(45000)
  })

  it('parses mmr stripping $ and commas', () => {
    const vehicles = parseRunList(CSV, MANHEIM_MAP)
    expect(vehicles[1].mmr).toBe(12500)
  })

  it('skips rows missing vin', () => {
    const csv = `Vin,Year,Make,Model\n,2022,Honda,Civic\n`
    const vehicles = parseRunList(csv, { vin: 'Vin', year: 'Year', make: 'Make', model: 'Model' })
    expect(vehicles).toHaveLength(0)
  })

  it('skips rows with non-numeric year', () => {
    const csv = `Vin,Year,Make,Model\n1HGBH41JXMN109186,N/A,Honda,Civic\n`
    const vehicles = parseRunList(csv, { vin: 'Vin', year: 'Year', make: 'Make', model: 'Model' })
    expect(vehicles).toHaveLength(0)
  })

  it('preserves rawData as the original CSV row object', () => {
    const [v] = parseRunList(CSV, MANHEIM_MAP)
    expect(v.rawData['Make']).toBe('Honda')
    expect(v.rawData['Vin']).toBe('1HGBH41JXMN109186')
  })
})
