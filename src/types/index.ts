export interface NormalizedVehicle {
  vin: string
  year: number
  make: string
  model: string
  trim?: string
  odometer?: number
  crGrade?: number
  mmr?: number
  accidents?: number
  owners?: number
  ownershipType?: string
  carfaxValue?: number
  rawData: Record<string, string>
}

export interface ColumnMap {
  vin: string
  year: string
  make: string
  model: string
  trim?: string
  odometer?: string
  crGrade?: string
  mmr?: string
  accidents?: string
  owners?: string
  ownershipType?: string
  carfaxValue?: string
  [key: string]: string | undefined
}

export interface FilterState {
  crGradeMin?: number
  crGradeMax?: number
  mmrMin?: number
  mmrMax?: number
  odomMax?: number
  yearMin?: number
  yearMax?: number
  accMax?: number
  ownMax?: number
  ownerType?: string
  makes?: string[]
  rankMax?: number
  showExcluded?: boolean
  sort?: string
  dir?: 'asc' | 'desc'
}

export interface MarketData {
  make: string
  model: string
  year: number
  listingCount: number
  demandScore: number
  lastRefreshedAt: Date
}

export interface ScoredVehicle extends NormalizedVehicle {
  id: string
  demandScore: number | null
  demandRank: number | null
}

export interface InventoryVehicle {
  vin: string
  year: number
  make: string
  model: string
  trim?: string
}

export type StockLevel = 'none' | 'low' | 'high'
