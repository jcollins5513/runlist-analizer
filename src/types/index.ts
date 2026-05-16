/**
 * NormalizedVehicle — a vehicle parsed from any auction CSV, normalized to a common shape.
 */
export interface NormalizedVehicle {
  vin: string
  year: number
  make: string
  model: string
  trim?: string
  odometer?: number
  crGrade?: number
  mmr?: number
  rawData: Record<string, string>
}

/**
 * ColumnMap — maps standard field names to CSV column headers for a specific auction source.
 */
export interface ColumnMap {
  vin: string
  year: string
  make: string
  model: string
  trim?: string
  odometer?: string
  crGrade?: string
  mmr?: string
  [key: string]: string | undefined
}

/**
 * FilterState — the filter panel's current state (used in the run list detail page).
 */
export interface FilterState {
  crGradeMin: number
  crGradeMax: number
  mmrMin: number
  mmrMax: number
  demandRankMax: number
  makes: string[]
  odometerMax: number
}

/**
 * MarketData — Marketcheck demand data cached in Redis/Postgres.
 */
export interface MarketData {
  make: string
  model: string
  year: number
  listingCount: number
  demandScore: number
  lastRefreshedAt: Date
}

/**
 * ScoredVehicle — a NormalizedVehicle enriched with market demand score and rank.
 */
export interface ScoredVehicle extends NormalizedVehicle {
  id: string
  demandScore: number | null
  demandRank: number | null
}
