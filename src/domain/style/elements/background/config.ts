import { BRAND_CONFIG } from '@/config/brand'

export const BACKGROUND_TYPES = [
  { value: 'office', label: 'Office Environment', icon: '🏢', color: 'from-blue-500 to-indigo-500' },
  { value: 'tropical-beach', label: 'Tropical Beach', icon: '🏝️', color: 'from-cyan-500 to-teal-500' },
  { value: 'busy-city', label: 'Busy City', icon: '🌆', color: 'from-purple-500 to-pink-500' },
  { value: 'neutral', label: 'Neutral Background', icon: '⬜', color: 'from-gray-400 to-gray-500' },
  { value: 'gradient', label: 'Gradient Background', icon: '🎨', color: 'from-orange-500 to-red-500' },
  { value: 'custom', label: 'Custom Upload', icon: '📤', color: 'from-green-500 to-emerald-500' }
] as const

export const NEUTRAL_COLORS = [
  '#ffffff', '#fef7f0', '#f0f9ff', '#f0fdf4', '#fefce8',
  '#fdf2f8', '#f5f3ff', '#f0fdfa', '#fff7ed', '#fef3c7',
  '#f3e8ff', '#e0f2fe', '#dcfce7', '#fef3c7', '#fce7f3',
  '#ede9fe', '#ccfbf1', '#fed7aa', '#fde68a', '#f9a8d4'
]

export const GRADIENT_COLORS = [
  // Blues & Teals
  '#3b82f6', '#2563eb', '#1d4ed8', '#06b6d4', '#0ea5e9',
  // Greens (using brand config)
  BRAND_CONFIG.colors.secondary, BRAND_CONFIG.colors.secondaryHover, '#16a34a',
  // Purples & Pinks
  '#8b5cf6', '#7c3aed', '#ec4899', '#db2777',
  // Oranges & Yellows (using brand config for CTA)
  '#f59e0b', '#d97706', BRAND_CONFIG.colors.cta, '#ef4444',
  // Browns
  '#8b5e34', '#7c4a2d', '#6d4c41', '#5d4037', '#4e342e',
  // Greys
  '#9ca3af', '#6b7280', '#4b5563', '#374151', '#1f2937', '#111827',
  // Soft pastels
  '#a8edea', '#ffecd2', '#f093fb', '#667eea'
]

