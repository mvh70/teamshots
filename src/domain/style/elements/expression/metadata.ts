import { FaceSmileIcon } from '@heroicons/react/24/outline'
import { registerElement } from '../metadata'
import { ExpressionSummary } from './Summary'

registerElement({
  key: 'expression',
  label: 'Expression',
  icon: FaceSmileIcon,
  description: 'Facial expression and mood',
  group: 'userStyle',
  summaryComponent: ExpressionSummary
})
