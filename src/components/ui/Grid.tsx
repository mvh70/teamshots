import React from 'react'

interface GridProps {
  children: React.ReactNode
  cols?: {
    mobile?: number
    tablet?: number
    desktop?: number
  }
  gap?: 'sm' | 'md' | 'lg'
  className?: string
  'data-testid'?: string
}

export const Grid = React.forwardRef<HTMLDivElement, GridProps>(function Grid({
  children,
  cols = { mobile: 2, tablet: 3, desktop: 4 },
  gap = 'md',
  className = '',
  'data-testid': testId
}, ref) {
  const gapClasses = {
    sm: 'gap-2',
    md: 'gap-4',
    lg: 'gap-6'
  }
  
  const gridClasses = `grid ${gapClasses[gap]}`
  
  // Build responsive grid columns
  const mobileCols = cols.mobile ? `grid-cols-${cols.mobile}` : ''
  const tabletCols = cols.tablet ? `md:grid-cols-${cols.tablet}` : ''
  const desktopCols = cols.desktop ? `lg:grid-cols-${cols.desktop}` : ''
  
  const responsiveClasses = `${mobileCols} ${tabletCols} ${desktopCols}`.trim()
  
  const classes = `${gridClasses} ${responsiveClasses} ${className}`.trim()
  
  return (
    <div ref={ref} className={classes} data-testid={testId}>
      {children}
    </div>
  )
})

// Predefined grid layouts for common use cases
export function UploadGrid({ children, ...props }: Omit<GridProps, 'cols'>) {
  return (
    <Grid cols={{ mobile: 2, tablet: 3, desktop: 4 }} {...props}>
      {children}
    </Grid>
  )
}

export function GenerationGrid({ children, ...props }: Omit<GridProps, 'cols'>) {
  return (
    <Grid cols={{ mobile: 1, tablet: 2, desktop: 3 }} gap="lg" {...props}>
      {children}
    </Grid>
  )
}

export function CardGrid({ children, ...props }: Omit<GridProps, 'cols'>) {
  return (
    <Grid cols={{ mobile: 1, tablet: 2, desktop: 3 }} {...props}>
      {children}
    </Grid>
  )
}

export function SelfieGrid({ children, ...props }: Omit<GridProps, 'cols'>) {
  return (
    <Grid cols={{ mobile: 2, tablet: 3, desktop: 6 }} gap="md" {...props}>
      {children}
    </Grid>
  )
}
