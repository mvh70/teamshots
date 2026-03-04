import { fireEvent, render, screen } from '@testing-library/react'
import ColorWheelPicker from './ColorWheelPicker'

describe('ColorWheelPicker input commit behavior', () => {
  it('does not auto-commit partial color names while typing', () => {
    const onChange = jest.fn()

    render(
      <ColorWheelPicker
        value={{ hex: '#000080', name: 'Navy' }}
        onChange={onChange}
      />
    )

    const input = screen.getByRole('textbox')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'dark' } })

    expect(onChange).not.toHaveBeenCalled()
  })

  it('commits typed color name on Enter', () => {
    const onChange = jest.fn()

    render(
      <ColorWheelPicker
        value={{ hex: '#000080', name: 'Navy' }}
        onChange={onChange}
      />
    )

    const input = screen.getByRole('textbox')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'dark green' } })

    expect(onChange).not.toHaveBeenCalled()

    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })

    expect(onChange).toHaveBeenCalledWith({ hex: '#14532d', name: 'Dark Green' })
  })

  it('still commits complete hex codes while typing', () => {
    const onChange = jest.fn()

    render(
      <ColorWheelPicker
        value={{ hex: '#000080', name: 'Navy' }}
        onChange={onChange}
      />
    )

    const input = screen.getByRole('textbox')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '#123456' } })

    expect(onChange).toHaveBeenCalledWith({ hex: '#123456' })
  })
})
