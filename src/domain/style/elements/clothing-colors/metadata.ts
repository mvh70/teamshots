import { SwatchIcon } from '@heroicons/react/24/outline'
import { registerElement } from '../metadata'
import { ClothingColorsSummary } from './Summary'

registerElement({
  key: 'clothingColors',
  label: 'Clothing Colors',
  icon: SwatchIcon,
  description: 'Colors for clothing items',
  group: 'userStyle',
  summaryComponent: ClothingColorsSummary
})
