'use client'

import React, { useEffect, useRef } from 'react'

type FocusTrapProps = {
  children: React.ReactNode
  active?: boolean
}

export default function FocusTrap({ children, active = true }: FocusTrapProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!active) return
    const container = containerRef.current
    if (!container) return

    const getFocusable = () =>
      Array.from(
        container.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.hasAttribute('disabled') && !el.getAttribute('aria-hidden'))

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const focusables = getFocusable()
      if (focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const current = document.activeElement as HTMLElement | null
      if (e.shiftKey) {
        if (current === first || !container.contains(current)) {
          last.focus()
          e.preventDefault()
        }
      } else {
        if (current === last) {
          first.focus()
          e.preventDefault()
        }
      }
    }

    container.addEventListener('keydown', handleKeyDown)
    // Ensure focus enters the trap
    const focusables = getFocusable()
    if (focusables[0]) focusables[0].focus()

    return () => container.removeEventListener('keydown', handleKeyDown)
  }, [active])

  return <div ref={containerRef}>{children}</div>
}


