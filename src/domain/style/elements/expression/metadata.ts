import { FaceSmileIcon } from '@heroicons/react/24/outline'
import { registerElement, type ElementMetadata } from '../metadata'
import { ExpressionSummary } from './Summary'

registerElement({
  key: 'expression',
  label: 'Expression',
  icon: FaceSmileIcon,
  description: 'Choose your facial expression and mood',
  group: 'userStyle',
  summaryComponent: ExpressionSummary as ElementMetadata['summaryComponent']
})
