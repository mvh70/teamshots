import { render, waitFor } from '@testing-library/react'
import StripeNotice from './StripeNotice'

function setLocation(url: string) {
  const parsed = new URL(url)
  Object.assign(window.location, {
    href: parsed.toString(),
    pathname: parsed.pathname,
    search: parsed.search,
  })
}

describe('StripeNotice', () => {
  beforeEach(() => {
    setLocation('http://localhost:3000/app/upgrade')
  })

  it('cleans success params with a null history state', async () => {
    setLocation(
      'http://localhost:3000/app/upgrade?success=true&type=top_up_success&tier=vip&period=monthly&foo=bar'
    )
    const replaceStateSpy = jest.spyOn(window.history, 'replaceState')

    render(<StripeNotice autoHideMs={1} />)

    await waitFor(() => {
      expect(replaceStateSpy).toHaveBeenCalledWith(
        null,
        '',
        '/app/upgrade?foo=bar'
      )
    })

    replaceStateSpy.mockRestore()
  })

  it('cleans error params with a null history state', async () => {
    setLocation(
      'http://localhost:3000/app/upgrade?error=true&message=Payment%20failed&foo=bar'
    )
    const replaceStateSpy = jest.spyOn(window.history, 'replaceState')

    render(<StripeNotice autoHideMs={1} />)

    await waitFor(() => {
      expect(replaceStateSpy).toHaveBeenCalledWith(
        null,
        '',
        '/app/upgrade?foo=bar'
      )
    })

    replaceStateSpy.mockRestore()
  })
})
