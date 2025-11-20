import React from 'react'

interface GridProps {
  children: React.ReactNode
  cols?: {
    mobile?: number
    tablet?: number
    desktop?: number
  }
  gap?: 'sm' | 'md' | 'lg'
  responsive?: {
    minWidth: string
    maxCols?: number
  }
  className?: string
  'data-testid'?: string
}

export const Grid = React.forwardRef<HTMLDivElement, GridProps>(function Grid({
  children,
  cols = { mobile: 2, tablet: 3, desktop: 4 },
  gap = 'md',
  responsive,
  className = '',
  'data-testid': testId
}, ref) {
  const gapClasses = {
    sm: 'gap-2',
    md: 'gap-4',
    lg: 'gap-6'
  }

  const gridClasses = `grid ${gapClasses[gap]}`

  let classes = `${gridClasses} ${className}`.trim()
  let gridStyles = {}

  if (responsive) {
    // Use CSS Grid auto-fit for truly responsive grids with inline styles
    gridStyles = {
      gridTemplateColumns: `repeat(auto-fit, minmax(${responsive.minWidth}, 1fr))`
    }
  } else {
    // Build responsive grid columns with fixed counts
    const mobileCols = cols.mobile ? `grid-cols-${cols.mobile}` : ''
    const tabletCols = cols.tablet ? `md:grid-cols-${cols.tablet}` : ''
    const desktopCols = cols.desktop ? `lg:grid-cols-${cols.desktop}` : ''

    const responsiveClasses = `${mobileCols} ${tabletCols} ${desktopCols}`.trim()
    classes = `${gridClasses} ${responsiveClasses} ${className}`.trim()
  }

  return (
    <div ref={ref} className={classes} style={gridStyles} data-testid={testId}>
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

export function SelfieGrid({ children, ...props }: Omit<GridProps, 'cols' | 'responsive'>) {
  // Use responsive grid that progressively shows more images on larger screens
  // Mobile: 1 image per row (full width for maximum visibility)
  // Small tablet: 2 images per row
  // Tablet: 2-3 images per row
  // Desktop: 3-4 images per row
  // Large desktop: 4-5 images per row
  // Max width constraint prevents single images from becoming too large
  const styleTag = `
    .selfie-grid-responsive {
      display: grid;
      gap: 0.5rem;
      grid-template-columns: 1fr;
    }
    @media (min-width: 480px) {
      .selfie-grid-responsive {
        grid-template-columns: repeat(auto-fit, minmax(200px, 300px));
      }
    }
    @media (min-width: 768px) {
      .selfie-grid-responsive {
        grid-template-columns: repeat(auto-fit, minmax(220px, 320px));
      }
    }
    @media (min-width: 1024px) {
      .selfie-grid-responsive {
        grid-template-columns: repeat(auto-fit, minmax(240px, 360px));
      }
    }
    @media (min-width: 1280px) {
      .selfie-grid-responsive {
        grid-template-columns: repeat(auto-fit, minmax(260px, 400px));
      }
    }
  `
  
  // Render directly without Grid component to avoid conflicts
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: styleTag }} />
      <div className={`selfie-grid-responsive ${props.className || ''}`} data-testid={props['data-testid']}>
        {children}
      </div>
    </>
  )
}
