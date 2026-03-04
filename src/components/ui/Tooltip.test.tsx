import { act, fireEvent, render, screen } from '@testing-library/react'
import Tooltip from './Tooltip'

describe('Tooltip', () => {
  it('toggles visibility on click and dismisses on outside pointerdown', async () => {
    render(
      <div>
        <Tooltip content="Helpful details">
          <button type="button">Trigger</button>
        </Tooltip>
        <button type="button">Outside</button>
      </div>
    )

    const trigger = screen.getByRole('button', { name: 'Trigger' })
    const outside = screen.getByRole('button', { name: 'Outside' })

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()

    await act(async () => {
      fireEvent.click(trigger)
      await Promise.resolve()
    })
    expect(screen.getByRole('tooltip')).toHaveTextContent('Helpful details')

    await act(async () => {
      fireEvent.pointerDown(outside)
    })
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('retains keyboard focus and blur behavior', async () => {
    render(
      <Tooltip content="Keyboard help">
        <button type="button">Focus trigger</button>
      </Tooltip>
    )

    const trigger = screen.getByRole('button', { name: 'Focus trigger' })

    await act(async () => {
      fireEvent.focus(trigger)
      await Promise.resolve()
    })
    expect(screen.getByRole('tooltip')).toHaveTextContent('Keyboard help')

    await act(async () => {
      fireEvent.blur(trigger)
    })
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })
})
