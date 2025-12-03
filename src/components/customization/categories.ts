import { 
  PhotoIcon, 
  SwatchIcon, 
  UserIcon, 
  FaceSmileIcon, 
  LightBulbIcon,
  HandRaisedIcon
} from '@heroicons/react/24/outline'
import { CategoryType } from '@/types/photo-style'

export type CategoryConfig = {
  key: CategoryType
  label: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  description: string
}

export const PHOTO_STYLE_CATEGORIES: CategoryConfig[] = [
  {
    key: 'background',
    label: 'Background',
    icon: PhotoIcon,
    description: 'Choose background style'
  },
  {
    key: 'branding',
    label: 'Branding',
    icon: SwatchIcon,
    description: 'Logo and branding options'
  },
  {
    key: 'pose',
    label: 'Pose',
    icon: HandRaisedIcon,
    description: 'Body pose and positioning'
  }
]

export const USER_STYLE_CATEGORIES: CategoryConfig[] = [
  {
    key: 'clothing',
    label: 'Clothing',
    icon: UserIcon,
    description: 'Clothing style and accessories'
  },
  {
    key: 'clothingColors',
    label: 'Clothing Colors',
    icon: SwatchIcon,
    description: 'Colors for clothing items'
  },
  {
    key: 'expression',
    label: 'Expression',
    icon: FaceSmileIcon,
    description: 'Facial expression and mood'
  },
  {
    key: 'lighting',
    label: 'Lighting',
    icon: LightBulbIcon,
    description: 'Lighting style and mood'
  }
]

