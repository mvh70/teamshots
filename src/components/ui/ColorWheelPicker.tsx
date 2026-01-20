'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { HexColorPicker } from 'react-colorful'
import { useTranslations } from 'next-intl'
import { normalizeColorToHex, hexToColorName } from '@/lib/color-utils'

export interface ColorValue {
  hex: string
  name?: string
}

interface ColorWheelPickerProps {
  value: string | ColorValue
  onChange: (color: ColorValue) => void
  label?: string
  disabled?: boolean
  className?: string
}

interface ColorName {
  name: string
  hex: string
}

// Get professional clothing colors for quick suggestions
const PROFESSIONAL_SUGGESTIONS = [
  { name: 'Black', hex: '#000000' },
  { name: 'Charcoal', hex: '#1f2937' },
  { name: 'Dark Gray', hex: '#374151' },
  { name: 'Gray', hex: '#6b7280' },
  { name: 'Light Gray', hex: '#9ca3af' },
  { name: 'White', hex: '#ffffff' },
  { name: 'Beige', hex: '#f5f5dc' },
  { name: 'Tan', hex: '#d2b48c' },
  { name: 'Brown', hex: '#8b4513' },
  { name: 'Dark Brown', hex: '#4a3728' },
  { name: 'Navy', hex: '#000080' },
  { name: 'Dark Blue', hex: '#1e3a5f' },
  { name: 'Blue', hex: '#3b82f6' },
  { name: 'Light Blue', hex: '#60a5fa' },
  { name: 'Dark Green', hex: '#14532d' },
  { name: 'Forest Green', hex: '#166534' },
  { name: 'Burgundy', hex: '#800020' },
  { name: 'Dark Red', hex: '#7f1d1d' },
  { name: 'Olive', hex: '#78350f' },
  { name: 'Cream', hex: '#fef3c7' },
]

export default function ColorWheelPicker({
  value,
  onChange,
  label,
  disabled = false,
  className = '',
}: ColorWheelPickerProps) {
  const t = useTranslations('customization.photoStyle.clothingColors')

  // Extract hex and name from value (support both string and ColorValue)
  const currentHex = typeof value === 'string' ? value : value?.hex || ''
  const currentName = typeof value === 'object' && value?.name ? value.name : ''

  const [inputValue, setInputValue] = useState('') // Keep input empty unless user is typing
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [showColorWheel, setShowColorWheel] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [isMounted, setIsMounted] = useState(false)
  const [portalPosition, setPortalPosition] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 320 })
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)
  const colorWheelRef = useRef<HTMLDivElement>(null)

  // Use refs to store color data (doesn't trigger re-renders)
  const colorNameListRef = useRef<ColorName[]>([])
  const colorMapRef = useRef<Map<string, string>>(new Map())
  const colorNameDebounceRef = useRef<NodeJS.Timeout | null>(null)

  // Initialize input with color name (only on mount and when value changes from outside)
  useEffect(() => {
    // Only update if there's a hex and the input is empty (don't override user typing)
    if (currentHex && !inputValue) {
      // Use provided name or find closest semantic color name
      const displayName = currentName || hexToColorName(currentHex)
      setInputValue(`${displayName} ${currentHex}`)
    }
  }, [currentName, currentHex, inputValue])

  useEffect(() => {
    setIsMounted(true)

    // Load color names on mount using dynamic import
    if (colorNameListRef.current.length === 0) {
      import('color-name-list')
        .then((module: any) => {
          // The module exports data under the 'colornames' property
          let colorArray: ColorName[] = []

          if (module.colornames && Array.isArray(module.colornames)) {
            colorArray = module.colornames
          } else if (Array.isArray(module.default)) {
            colorArray = module.default
          } else if (Array.isArray(module)) {
            colorArray = module
          }

          if (colorArray.length > 0) {
            colorNameListRef.current = colorArray
            colorMapRef.current = new Map(
              colorArray.map((color: ColorName) => [color.name.toLowerCase(), color.hex])
            )
            console.log(`✅ Loaded ${colorArray.length} color names for autocomplete`)
          } else {
            console.warn('⚠️ Color name list is empty - module structure:', Object.keys(module))
          }
        })
        .catch((error) => {
          console.error('❌ Failed to load color-name-list:', error)
        })
    }
    
    // Cleanup debounce timeout on unmount
    return () => {
      if (colorNameDebounceRef.current) {
        clearTimeout(colorNameDebounceRef.current)
      }
    }
  }, [])

  // Normalize the current value
  const normalizedValue = normalizeColorToHex(currentHex || '#000000')
  
  // Dynamic placeholder showing the current swatch color name
  const placeholderText = useMemo(() => {
    const colorName = hexToColorName(normalizedValue)
    return `${colorName} ${normalizedValue}`
  }, [normalizedValue])

  // Helper function to strip hex codes from color names (defined before useMemo)
  const stripHexCode = (text: string): string => {
    // Remove hex codes like "#FFFFFF" or "#fff" from the end of the string
    return text.replace(/\s*#[0-9a-fA-F]{3,8}\s*$/g, '').trim()
  }

  // Filter color suggestions based on input
  const suggestions = useMemo(() => {
    // If input is empty or only whitespace, show professional suggestions
    if (!inputValue.trim()) {
      return PROFESSIONAL_SUGGESTIONS
    }

    // Strip hex code from input for matching (e.g., "Navy Blue #003366" -> "Navy Blue")
    const cleanedInput = stripHexCode(inputValue)
    const searchTerm = cleanedInput.toLowerCase().trim()

    // If it looks like a hex code being typed, don't show name suggestions
    if (searchTerm.startsWith('#') && searchTerm.length > 1) {
      return []
    }

    // Search color names
    const matches: ColorName[] = []

    // First, add professional colors that match
    PROFESSIONAL_SUGGESTIONS.forEach((color: ColorName) => {
      if (color.name.toLowerCase().includes(searchTerm)) {
        matches.push(color)
      }
    })

    // Then add other color names that match
    const colorNameList = colorNameListRef.current
    colorNameList.forEach((color: ColorName) => {
      if (
        matches.length < 10 &&
        !matches.find((m: ColorName) => m.hex === color.hex) &&
        color.name.toLowerCase().includes(searchTerm)
      ) {
        matches.push({ name: color.name, hex: color.hex })
      }
    })

    return matches.slice(0, 10) // Limit to 10 suggestions
  }, [inputValue])

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setInputValue(newValue)
    setShowSuggestions(true)
    setSelectedIndex(-1)

    // If it's a valid hex code or color name, update the color
    if (newValue.startsWith('#')) {
      // Hex code input
      const normalized = normalizeColorToHex(newValue)
      if (normalized !== '#ffffff' || newValue.toLowerCase() === '#ffffff') {
        onChange({ hex: normalized })
      }
    } else if (newValue.trim()) {
      // Color name lookup - strip hex code if present (e.g., "Navy Blue #003366" -> "Navy Blue")
      const cleanedValue = stripHexCode(newValue)
      const colorHex = colorMapRef.current.get(cleanedValue.toLowerCase())
      if (colorHex) {
        const colorName = colorNameListRef.current.find(c => c.hex === colorHex)?.name || cleanedValue
        onChange({ hex: colorHex, name: colorName })
      }
    }
  }

  // Handle suggestion selection
  const handleSuggestionClick = (hex: string, name: string) => {
    onChange({ hex, name })
    setInputValue(`${name} ${hex}`) // Show selected color name and hex
    setShowSuggestions(false)
    setShowColorWheel(true) // Open color wheel to allow fine-tuning
    setSelectedIndex(-1)
  }

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Handle Enter key
    if (e.key === 'Enter') {
      e.preventDefault()

      // If autocomplete is showing and something is selected, pick it
      if (showSuggestions && suggestions.length > 0 && selectedIndex >= 0) {
        const suggestion = suggestions[selectedIndex]
        handleSuggestionClick(suggestion.hex, suggestion.name)
        return
      }

      // If user typed a hex code, apply it and open color wheel
      if (inputValue.trim().startsWith('#')) {
        const normalized = normalizeColorToHex(inputValue.trim())
        if (normalized && normalized !== '#ffffff') {
          onChange({ hex: normalized })
          setInputValue(normalized) // Keep the normalized hex in input
          setShowSuggestions(false)
          setShowColorWheel(true) // Open color wheel for fine-tuning
        }
        return
      }

      // If user typed a color name, try to find and apply it
      // Strip hex code if present (e.g., "Navy Blue #003366" -> "Navy Blue")
      const cleanedInput = stripHexCode(inputValue)
      const searchTerm = cleanedInput.toLowerCase().trim()
      const colorHex = colorMapRef.current.get(searchTerm)
      if (colorHex) {
        // Find the original color name (with proper capitalization)
        const colorName = colorNameListRef.current.find(c => c.name.toLowerCase() === searchTerm)?.name || cleanedInput
        onChange({ hex: colorHex, name: colorName })
        setInputValue(`${colorName} ${colorHex}`) // Show name and hex
        setShowSuggestions(false)
        setShowColorWheel(true) // Open color wheel for fine-tuning
      }
      return
    }

    // Handle autocomplete navigation
    if (!showSuggestions || suggestions.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1))
        break
      case 'Escape':
        setShowSuggestions(false)
        setShowColorWheel(false)
        setSelectedIndex(-1)
        break
    }
  }

  // Handle color wheel change (debounce name lookup for performance)
  const handleColorWheelChange = (newColor: string) => {
    // Update hex immediately
    setInputValue(newColor)
    onChange({ hex: newColor })
    
    // Debounce the expensive semantic name lookup (30k+ colors)
    if (colorNameDebounceRef.current) {
      clearTimeout(colorNameDebounceRef.current)
    }
    colorNameDebounceRef.current = setTimeout(() => {
      const colorName = hexToColorName(newColor)
      setInputValue(`${colorName} ${newColor}`)
      onChange({ hex: newColor, name: colorName })
    }, 150)
  }

  // Update popup position when suggestions or color wheel is shown
  useEffect(() => {
    if ((!showColorWheel && !showSuggestions) || !containerRef.current) return

    const handleReposition = () => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      setPortalPosition({
        top: rect.bottom + 8,
        left: rect.left,
        width: Math.max(rect.width, 320),
      })
    }

    handleReposition()
    window.addEventListener('scroll', handleReposition, true)
    window.addEventListener('resize', handleReposition)

    return () => {
      window.removeEventListener('scroll', handleReposition, true)
      window.removeEventListener('resize', handleReposition)
    }
  }, [showColorWheel, showSuggestions])

  // Close popups when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      const clickedInsideSuggestions = suggestionsRef.current?.contains(target)
      const clickedInsideColorWheel = colorWheelRef.current?.contains(target)
      const clickedInsideContainer = containerRef.current?.contains(target)

      if (!clickedInsideSuggestions && !clickedInsideColorWheel && !clickedInsideContainer) {
        setShowSuggestions(false)
        setShowColorWheel(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowSuggestions(false)
        setShowColorWheel(false)
        inputRef.current?.blur()
      }
    }

    if (showSuggestions || showColorWheel) {
      setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside)
        document.addEventListener('keydown', handleEscape)
      }, 0)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [showSuggestions, showColorWheel])

  // Handle swatch button click
  const handleSwatchClick = () => {
    if (disabled) return
    setShowColorWheel(!showColorWheel)
    setShowSuggestions(false)
  }

  return (
    <div className={`${className}`} ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}

      {/* Hex input with autocomplete */}
      <div className="relative flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => {
            if (!disabled) {
              setShowSuggestions(true)
              setShowColorWheel(false)
            }
          }}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          className={`flex-1 px-3 py-2 bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary text-sm ${
            disabled ? 'opacity-60 cursor-not-allowed bg-gray-100' : ''
          }`}
          placeholder={placeholderText}
        />

        {/* Color preview swatch button */}
        <button
          type="button"
          onClick={handleSwatchClick}
          disabled={disabled}
          className={`w-10 h-10 rounded-md border-2 border-gray-300 shadow-sm transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-brand-primary ${
            disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
          } ${showColorWheel ? 'ring-2 ring-brand-primary' : ''}`}
          style={{ backgroundColor: normalizedValue }}
          title="Open color wheel"
        />

      </div>

      {/* Autocomplete suggestions - shown as portal popup */}
      {showSuggestions && suggestions.length > 0 && !disabled && isMounted && createPortal(
        <div
          ref={suggestionsRef}
          className="fixed z-[9999] bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto"
          style={{
            top: portalPosition.top,
            left: portalPosition.left,
            width: portalPosition.width,
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {suggestions.map((suggestion, index) => (
            <button
              key={`${suggestion.hex}-${index}`}
              type="button"
              onClick={() =>
                handleSuggestionClick(suggestion.hex, suggestion.name)
              }
              className={`w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 transition-colors text-left ${
                index === selectedIndex ? 'bg-gray-100' : ''
              }`}
            >
              <div
                className="w-6 h-6 rounded border border-gray-300 flex-shrink-0"
                style={{ backgroundColor: suggestion.hex }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">
                  {suggestion.name}
                </div>
                <div className="text-xs text-gray-500">{suggestion.hex}</div>
              </div>
            </button>
          ))}
        </div>,
        document.body
      )}

      {/* Color wheel picker - shown as portal popup */}
      {showColorWheel && !disabled && isMounted && createPortal(
        <div
          ref={colorWheelRef}
          className="fixed z-[9999] bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden animate-fade-in"
          style={{
            top: portalPosition.top,
            left: portalPosition.left,
            width: 320,
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="p-4 space-y-4">
            {/* Color wheel */}
            <div className="flex justify-center">
              <HexColorPicker
                color={normalizedValue}
                onChange={handleColorWheelChange}
                style={{ width: '200px', height: '200px' }}
              />
            </div>

            {/* Current color display */}
            <div>
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-gray-700 font-medium">Current color:</span>
                <span className="font-mono text-gray-600 text-xs">
                  {normalizedValue}
                </span>
              </div>
              <div
                className="w-full h-12 rounded-lg border-2 border-gray-300 shadow-sm"
                style={{ backgroundColor: normalizedValue }}
              />
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
