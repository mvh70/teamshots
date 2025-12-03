import { CategoryType } from '@/types/photo-style'
import { ClientStylePackage } from './packages'

const DEFAULT_VISIBLE_CATEGORIES: CategoryType[] = [
  'background', 
  'branding', 
  'clothing', 
  'clothingColors', 
  'pose', 
  'expression'
]

export function ensureVisibleCategories(pkg: ClientStylePackage): CategoryType[] {
  if (pkg.visibleCategories && pkg.visibleCategories.length > 0) {
    return pkg.visibleCategories
  }
  return DEFAULT_VISIBLE_CATEGORIES
}

