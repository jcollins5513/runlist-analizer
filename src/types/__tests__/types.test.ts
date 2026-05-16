import { describe, it, expectTypeOf } from 'vitest'
import type { NormalizedVehicle, ColumnMap, FilterState, MarketData } from '../index'

describe('NormalizedVehicle', () => {
  it('has required fields vin, year, make, model, rawData', () => {
    const v: NormalizedVehicle = {
      vin: '1HGBH41JXMN109186',
      year: 2022,
      make: 'Honda',
      model: 'Civic',
      rawData: { Vin: '1HGBH41JXMN109186' },
    }
    expectTypeOf(v.vin).toBeString()
    expectTypeOf(v.year).toBeNumber()
    expectTypeOf(v.rawData).toMatchTypeOf<Record<string, string>>()
  })

  it('has optional fields trim, odometer, crGrade, mmr', () => {
    const v: NormalizedVehicle = {
      vin: '1HGBH41JXMN109186',
      year: 2022,
      make: 'Honda',
      model: 'Civic',
      rawData: {},
    }
    expectTypeOf(v.trim).toEqualTypeOf<string | undefined>()
    expectTypeOf(v.crGrade).toEqualTypeOf<number | undefined>()
  })
})

describe('ColumnMap', () => {
  it('requires vin, year, make, model as strings', () => {
    const map: ColumnMap = { vin: 'Vin', year: 'Year', make: 'Make', model: 'Model' }
    expectTypeOf(map.vin).toBeString()
  })
})

describe('FilterState', () => {
  it('has all filter fields', () => {
    const f: FilterState = {
      crGradeMin: 0,
      crGradeMax: 5,
      mmrMin: 0,
      mmrMax: 100000,
      demandRankMax: 25,
      makes: [],
      odometerMax: 150000,
    }
    expectTypeOf(f.makes).toEqualTypeOf<string[]>()
  })
})
