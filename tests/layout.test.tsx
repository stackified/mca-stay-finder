import { render, screen } from '@testing-library/react'
import App from '@/app/App'

describe('App layout', () => {
  it('renders the three main regions and the status bar', () => {
    render(<App />)
    expect(screen.getByRole('complementary', { name: /filters/i })).toBeInTheDocument()
    expect(screen.getByRole('main', { name: /map/i })).toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: /results/i })).toBeInTheDocument()
    expect(screen.getByRole('contentinfo')).toHaveTextContent(/colleges/i)
  })
})
