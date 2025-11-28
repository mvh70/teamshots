'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useTranslations } from 'next-intl'
import { ChevronDownIcon } from '@heroicons/react/24/outline'
import { normalizeColorToHex } from '@/lib/color-utils'

interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
  presets?: string[]
  label?: string
  disabled?: boolean
  className?: string
}

/**
 * Convert hex to HSL
 */
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return { h: 0, s: 0, l: 100 }
  
  const r = parseInt(result[1], 16) / 255
  const g = parseInt(result[2], 16) / 255
  const b = parseInt(result[3], 16) / 255
  
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }

  return { h: h * 360, s: s * 100, l: l * 100 }
}

/**
 * Convert HSL to hex
 */
function hslToHex(h: number, s: number, l: number): string {
  s /= 100
  l /= 100
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * color).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

/**
 * Generate color variations around a base color
 */
function generateColorVariations(baseHex: string): string[] {
  const { h, s, l } = hexToHsl(baseHex)
  const variations: string[] = []
  
  // Row 1: Lighter versions (subtle steps: +5%, +10%, +15%, +20%, +25%)
  for (let i = 0; i < 5; i++) {
    const newL = Math.min(95, l + (i + 1) * 5)
    variations.push(hslToHex(h, s, newL))
  }
  
  // Row 2: Saturation variations (subtle: -20% to +20%)
  for (let i = 0; i < 5; i++) {
    const newS = Math.max(0, Math.min(100, s - 20 + i * 10))
    variations.push(hslToHex(h, newS, l))
  }
  
  // Row 3: Hue variations (analogous colors: -20° to +20°)
  for (let i = 0; i < 5; i++) {
    const newH = (h - 20 + i * 10 + 360) % 360
    variations.push(hslToHex(newH, s, l))
  }
  
  // Row 4: Darker versions (subtle steps: -5%, -10%, -15%, -20%, -25%)
  for (let i = 0; i < 5; i++) {
    const newL = Math.max(5, l - (i + 1) * 5)
    variations.push(hslToHex(h, s, newL))
  }
  
  return variations
}

export default function ColorPicker({
  value,
  onChange,
  presets = [],
  label,
  disabled = false,
  className = ''
}: ColorPickerProps) {
  const t = useTranslations('customization.photoStyle.background')
  const [isOpen, setIsOpen] = useState(false)
  const [isMounted] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Update dropdown position when open and on scroll/resize
  useEffect(() => {
    if (!isOpen) return

    const handleReposition = () => {
      if (!buttonRef.current) return
      // Position is calculated synchronously in render, no need to store in state
    }
    handleReposition()
    window.addEventListener('scroll', handleReposition, true)
    window.addEventListener('resize', handleReposition)

    return () => {
      window.removeEventListener('scroll', handleReposition, true)
      window.removeEventListener('resize', handleReposition)
    }
  }, [isOpen])

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      const clickedInsideContainer = containerRef.current?.contains(target)
      const clickedInsideDropdown = dropdownRef.current?.contains(target)
      const clickedOnButton = buttonRef.current?.contains(target)

      // Don't close if clicking on the button or inside the container/dropdown
      if (!clickedInsideContainer && !clickedInsideDropdown && !clickedOnButton) {
        setIsOpen(false)
      }
    }
    
    // Use a small delay to avoid catching the opening click
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 0)

    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleColorSelect = (color: string) => {
    onChange(color)
    setIsOpen(false)
  }

  const toggleOpen = () => {
    if (disabled) return
    if (isOpen) {
      setIsOpen(false)
      return
    }

    setIsOpen(true)
  }


  const normalizedValue = normalizeColorToHex(
    (value && !value.startsWith('#') && /^[0-9A-Fa-f]{3,6}$/.test(value))
      ? `#${value}`
      : value
  )

  // Check if we have a valid color entered (not empty, not just whitespace, and resolves to something other than white fallback)
  const hasValidColor = value && value.trim().length > 0 && normalizedValue !== '#ffffff'

  // Generate variations based on the current color
  const colorVariations = useMemo(() => {
    if (!hasValidColor) return []
    return generateColorVariations(normalizedValue)
  }, [normalizedValue, hasValidColor])

  // Calculate portal position synchronously when rendering
  const portalPosition = isOpen && buttonRef.current
    ? (() => {
        const rect = buttonRef.current!.getBoundingClientRect()
        return {
          top: rect.bottom + 8,
          left: rect.left,
          width: Math.max(rect.width, 280)
        }
      })()
    : { top: 0, left: 0, width: 280 }

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}

      {/* Trigger Button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          toggleOpen()
        }}
        disabled={disabled}
        className={`flex items-center justify-between w-full px-3 py-2 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary transition-colors ${
          disabled ? 'opacity-60 cursor-not-allowed bg-gray-100' : 'cursor-pointer'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-6 h-6 rounded-full border border-gray-200 shadow-sm"
            style={{ backgroundColor: normalizedValue }}
          />
          <span className="text-sm font-medium text-gray-900">
            {value}
          </span>
        </div>
        <ChevronDownIcon className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${isOpen ? 'transform rotate-180' : ''}`} />
      </button>

      {/* Dropdown Panel - rendered via portal to escape overflow constraints */}
      {isOpen && isMounted && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-[9999] bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden animate-fade-in"
          style={{
            top: portalPosition.top,
            left: portalPosition.left,
            width: portalPosition.width,
            minWidth: 280
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="p-4 space-y-4">
            {/* Text Input at the top */}
            <div>
              <label className="block text-xs text-gray-500 mb-1.5 uppercase tracking-wider font-semibold">
                {t('colorValue', { default: 'Color' })}
              </label>
              <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onMouseDown={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    setIsOpen(false)
                  }
                }}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-brand-primary focus:border-brand-primary text-sm font-mono"
                placeholder="#FFFFFF or burgundy"
              />
              <p className="mt-1 text-xs text-gray-400">
                {t('colorHint', { default: 'Hex code or color name' })}
              </p>
            </div>

            {/* Color variations grid - only show when there's a valid color */}
            {hasValidColor && colorVariations.length > 0 && (
              <div>
                <label className="block text-xs text-gray-500 mb-2 uppercase tracking-wider font-semibold">
                  {t('variations', { default: 'Variations' })}
                </label>
                <div className="grid grid-cols-5 gap-1.5">
                  {colorVariations.map((color, index) => (
                    <button
                      type="button"
                      key={`${color}-${index}`}
                      onClick={() => handleColorSelect(color)}
                      className={`w-10 h-10 rounded-lg border transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-brand-primary ${
                        normalizedValue.toLowerCase() === color.toLowerCase()
                          ? 'border-brand-primary shadow-md ring-2 ring-brand-primary ring-opacity-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Presets - show when no valid color is entered */}
            {!hasValidColor && presets.length > 0 && (
              <div>
                <label className="block text-xs text-gray-500 mb-2 uppercase tracking-wider font-semibold">
                  {t('presets', { default: 'Choose a color' })}
                </label>
                <div className="grid grid-cols-5 gap-1.5 max-h-48 overflow-y-auto">
                  {presets.map((color) => (
                    <button
                      type="button"
                      key={color}
                      onClick={() => handleColorSelect(color)}
                      className="w-10 h-10 rounded-lg border border-gray-200 hover:border-gray-300 transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-brand-primary"
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

