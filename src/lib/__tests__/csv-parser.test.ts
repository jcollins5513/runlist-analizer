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

describe('parseRunList — carfax fields', () => {
  const CARFAX_MAP: ColumnMap = {
    vin: 'VIN',
    year: 'Year',
    make: 'Make',
    model: 'Model',
    accidents: 'Accidents',
    owners: 'Owners',
    ownershipType: 'Title Type',
    carfaxValue: 'Carfax Value',
  }

  const CSV_CARFAX = `VIN,Year,Make,Model,Accidents,Owners,Title Type,Carfax Value
1HGBH41JXMN109186,2022,Honda,Civic,1,2,Personal,"$15,000"
2T1BURHE0JC034620,2018,Toyota,Corolla,0,1,Personal,$12500`

  it('parses accident count', () => {
    const [v] = parseRunList(CSV_CARFAX, CARFAX_MAP)
    expect(v.accidents).toBe(1)
  })

  it('parses owner count', () => {
    const [v] = parseRunList(CSV_CARFAX, CARFAX_MAP)
    expect(v.owners).toBe(2)
  })

  it('parses ownershipType', () => {
    const [v] = parseRunList(CSV_CARFAX, CARFAX_MAP)
    expect(v.ownershipType).toBe('Personal')
  })

  it('parses carfaxValue stripping $ and commas', () => {
    const [v] = parseRunList(CSV_CARFAX, CARFAX_MAP)
    expect(v.carfaxValue).toBe(15000)
  })

  it('parses zero accidents correctly', () => {
    const vehicles = parseRunList(CSV_CARFAX, CARFAX_MAP)
    expect(vehicles[1].accidents).toBe(0)
  })

  it('leaves carfax fields undefined when columns not mapped', () => {
    const map: ColumnMap = { vin: 'VIN', year: 'Year', make: 'Make', model: 'Model' }
    const csv = `VIN,Year,Make,Model\n1HGBH41JXMN109186,2022,Honda,Civic`
    const [v] = parseRunList(csv, map)
    expect(v.accidents).toBeUndefined()
    expect(v.owners).toBeUndefined()
  })

  it('parses FAA text "No accidents or damage reported." as 0', () => {
    const map: ColumnMap = { vin: 'VIN', year: 'Year', make: 'Make', model: 'Model', accidents: 'Acc' }
    const csv = `VIN,Year,Make,Model,Acc\n1HGBH41JXMN109186,2022,Honda,Civic,No accidents or damage reported.`
    const [v] = parseRunList(csv, map)
    expect(v.accidents).toBe(0)
  })

  it('parses FAA text with one accident as 1', () => {
    const map: ColumnMap = { vin: 'VIN', year: 'Year', make: 'Make', model: 'Model', accidents: 'Acc' }
    const csv = `VIN,Year,Make,Model,Acc\n1HGBH41JXMN109186,2022,Honda,Civic,Accident reported: 08/26/2022. Minor damage.`
    const [v] = parseRunList(csv, map)
    expect(v.accidents).toBe(1)
  })

  it('parses FAA text "Accidents reported: DATE and DATE." as 2', () => {
    const map: ColumnMap = { vin: 'VIN', year: 'Year', make: 'Make', model: 'Model', accidents: 'Acc' }
    const csv = `VIN,Year,Make,Model,Acc\n1HGBH41JXMN109186,2022,Honda,Civic,"Accidents reported: 08/15/2018 and 06/21/2024. Damage reported: 12/14/2019."`
    const [v] = parseRunList(csv, map)
    expect(v.accidents).toBe(2)
  })

  it('parses FAA text with 5 accidents as 5', () => {
    const map: ColumnMap = { vin: 'VIN', year: 'Year', make: 'Make', model: 'Model', accidents: 'Acc' }
    const csv = `VIN,Year,Make,Model,Acc\n1HGBH41JXMN109186,2022,Honda,Civic,"Accidents reported: 10/17/2022, 04/05/2023, 06/17/2023, 09/11/2023, and 12/05/2024. Minor damage."`
    const [v] = parseRunList(csv, map)
    expect(v.accidents).toBe(5)
  })

  it('parses FAA text "Damage reported: DATE." (no accident) as 0', () => {
    const map: ColumnMap = { vin: 'VIN', year: 'Year', make: 'Make', model: 'Model', accidents: 'Acc' }
    const csv = `VIN,Year,Make,Model,Acc\n1HGBH41JXMN109186,2022,Honda,Civic,Damage reported: 04/16/2018. Minor damage.`
    const [v] = parseRunList(csv, map)
    expect(v.accidents).toBe(0)
  })

  it('strips year+make prefix from model when source stores full description', () => {
    const csv = `VIN,Year,Make,Model\n1HGBH41JXMN109186,2024,TOYOTA,2024 TOYOTA COROLLA CROSS XLE`
    const [v] = parseRunList(csv, { vin: 'VIN', year: 'Year', make: 'Make', model: 'Model' })
    expect(v.model).toBe('COROLLA CROSS XLE')
  })

  it('does not modify model when it has no year+make prefix', () => {
    const csv = `VIN,Year,Make,Model\n1HGBH41JXMN109186,2022,Honda,Civic`
    const [v] = parseRunList(csv, { vin: 'VIN', year: 'Year', make: 'Make', model: 'Model' })
    expect(v.model).toBe('Civic')
  })
})
