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

export function Grid({ 
  children, 
  cols = { mobile: 2, tablet: 3, desktop: 4 },
  gap = 'md',
  className = '',
  'data-testid': testId
}: GridProps) {
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
    <div className={classes} data-testid={testId}>
      {children}
    </div>
  )
}

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
    <Grid cols={{ mobile: 2, tablet: 3, desktop: 4 }} {...props}>
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
