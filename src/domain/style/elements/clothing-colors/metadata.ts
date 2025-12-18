import { SwatchIcon } from '@heroicons/react/24/outline'
import { registerElement, type ElementMetadata } from '../metadata'
import { ClothingColorsSummary } from './Summary'

registerElement({
  key: 'clothingColors',
  label: 'Clothing Colors',
  icon: SwatchIcon,
  description: 'Choose your colors for clothing items',
  group: 'userStyle',
  summaryComponent: ClothingColorsSummary as ElementMetadata['summaryComponent']
})
