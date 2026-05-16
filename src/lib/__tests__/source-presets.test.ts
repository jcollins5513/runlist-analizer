import { describe, it, expect } from 'vitest'
import { SOURCE_PRESETS, getPresetByName } from '../source-presets'

describe('SOURCE_PRESETS', () => {
  it('includes manheim', () => {
    const manheim = SOURCE_PRESETS.find(s => s.name === 'manheim')
    expect(manheim).toBeDefined()
  })

  it('manheim maps vin to "Vin"', () => {
    const manheim = SOURCE_PRESETS.find(s => s.name === 'manheim')!
    expect(manheim.columnMap.vin).toBe('Vin')
  })

  it('manheim maps crGrade to "Condition Report Grade"', () => {
    const manheim = SOURCE_PRESETS.find(s => s.name === 'manheim')!
    expect(manheim.columnMap.crGrade).toBe('Condition Report Grade')
  })

  it('manheim maps mmr to "MMR"', () => {
    const manheim = SOURCE_PRESETS.find(s => s.name === 'manheim')!
    expect(manheim.columnMap.mmr).toBe('MMR')
  })

  it('manheim maps odometer to "Odometer Value"', () => {
    const manheim = SOURCE_PRESETS.find(s => s.name === 'manheim')!
    expect(manheim.columnMap.odometer).toBe('Odometer Value')
  })

  it('all presets have name, displayName, and required column fields', () => {
    for (const preset of SOURCE_PRESETS) {
      expect(preset.name).toBeTruthy()
      expect(preset.displayName).toBeTruthy()
      expect(preset.columnMap.vin).toBeTruthy()
      expect(preset.columnMap.year).toBeTruthy()
      expect(preset.columnMap.make).toBeTruthy()
      expect(preset.columnMap.model).toBeTruthy()
    }
  })
})

describe('getPresetByName', () => {
  it('returns the preset for a known name', () => {
    const preset = getPresetByName('manheim')
    expect(preset).toBeDefined()
    expect(preset!.name).toBe('manheim')
  })

  it('returns undefined for an unknown name', () => {
    expect(getPresetByName('unknown-source-xyz')).toBeUndefined()
  })
})
