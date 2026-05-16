import type { ColumnMap } from '@/types'

export interface SourcePreset {
  name: string
  displayName: string
  columnMap: ColumnMap
}

export const SOURCE_PRESETS: SourcePreset[] = [
  {
    name: 'manheim',
    displayName: 'Manheim',
    columnMap: {
      vin: 'Vin',
      year: 'Year',
      make: 'Make',
      model: 'Model',
      trim: 'Trim',
      odometer: 'Odometer Value',
      crGrade: 'Condition Report Grade',
      mmr: 'MMR',
    },
  },
  {
    name: 'adesa',
    displayName: 'ADESA',
    columnMap: {
      vin: 'VIN',
      year: 'Year',
      make: 'Make',
      model: 'Model',
      trim: 'Series',
      odometer: 'Mileage',
      crGrade: 'CR Score',
      mmr: 'Book Value',
    },
  },
  {
    name: 'ove',
    displayName: 'OVE',
    columnMap: {
      vin: 'VIN',
      year: 'Year',
      make: 'Make',
      model: 'Model',
      trim: 'Trim',
      odometer: 'Miles',
      crGrade: 'Condition',
      mmr: 'MMR',
    },
  },
]

export function getPresetByName(name: string): SourcePreset | undefined {
  return SOURCE_PRESETS.find(p => p.name === name)
}
