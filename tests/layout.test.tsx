import { render, screen } from '@testing-library/react'
import App from '@/app/App'

// jsdom has no WebGL, so the map itself is not rendered here; keep the loader in "loading".
vi.mock('@/lib/data', () => ({ useSeedData: () => ({ status: 'loading' }) }))

describe('App layout', () => {
  it('renders the three main regions and the status bar', () => {
    render(<App />)
    expect(screen.getByRole('complementary', { name: /filters/i })).toBeInTheDocument()
    expect(screen.getByRole('main', { name: /map/i })).toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: /results/i })).toBeInTheDocument()
    // No data in this test, so the status bar shows its loading text.
    expect(screen.getByRole('contentinfo')).toHaveTextContent(/loading/i)
  })

  it('shows a loading message while seed data loads', () => {
    render(<App />)
    expect(screen.getByText(/loading data/i)).toBeInTheDocument()
  })
})
