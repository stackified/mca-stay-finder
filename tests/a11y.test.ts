import { AMENITY_COLOR } from '@/lib/amenities'
import { SERIES_COLORS } from '@/lib/charts'
import { contrastRatio } from '@/lib/contrast'
import { SCORE_BAND_STYLE } from '@/lib/scoring'
import { STAY_TYPE_COLOR } from '@/lib/stays'

const WHITE = '#ffffff'
/** Dark-mode background (oklch(0.145 0 0) ≈ #0a0a0a). */
const DARK_BG = '#0a0a0a'

describe('contrastRatio (WCAG formula)', () => {
  it('matches known values', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5)
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5)
    expect(contrastRatio('#767676', '#ffffff')).toBeCloseTo(4.54, 2)
  })
})

describe('SPEC §12: WCAG AA colour contrast', () => {
  it.each(Object.entries(SCORE_BAND_STYLE))(
    'score badge "%s": text on colour ≥ 4.5:1',
    (_band, s) => {
      expect(contrastRatio(s.color, s.text)).toBeGreaterThanOrEqual(4.5)
    },
  )

  it.each(Object.entries(STAY_TYPE_COLOR))('stay type %s: white letter ≥ 4.5:1', (_t, c) => {
    expect(contrastRatio(c, WHITE)).toBeGreaterThanOrEqual(4.5)
  })

  it.each(Object.entries(AMENITY_COLOR))('amenity %s: white letter ≥ 4.5:1', (_k, c) => {
    expect(contrastRatio(c, WHITE)).toBeGreaterThanOrEqual(4.5)
  })

  it.each([...SERIES_COLORS])(
    'chart series %s: graphic ≥ 3:1 on light and dark backgrounds',
    (c) => {
      expect(contrastRatio(c, WHITE)).toBeGreaterThanOrEqual(3)
      expect(contrastRatio(c, DARK_BG)).toBeGreaterThanOrEqual(3)
    },
  )
})
