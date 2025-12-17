import { SparklesIcon } from '@heroicons/react/24/outline'
import { registerElement, type ElementMetadata } from '../metadata'
import { CustomClothingSummary } from './Summary'

registerElement({
  key: 'customClothing',
  label: 'Custom Clothing',
  icon: SparklesIcon,
  description: 'Upload your own outfit',
  group: 'userStyle',
  summaryComponent: CustomClothingSummary as ElementMetadata['summaryComponent']
})
