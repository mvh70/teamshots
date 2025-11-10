'use client';

import Link from 'next/link';
import { forwardRef, useCallback } from 'react';
import type { ComponentPropsWithoutRef, MouseEvent } from 'react';
import { useAnalytics } from '@/hooks/useAnalytics';

type LinkProps = ComponentPropsWithoutRef<typeof Link>;

interface TrackedLinkProps extends LinkProps {
  event: string;
  eventProperties?: Record<string, unknown>;
}

export const TrackedLink = forwardRef<HTMLAnchorElement, TrackedLinkProps>(
  function TrackedLink(
    { event, eventProperties, href, onClick, children, ...rest },
    ref
  ) {
    const { track } = useAnalytics();

    const handleClick = useCallback(
      (eventArg: MouseEvent<HTMLAnchorElement>) => {
        if (onClick) {
          onClick(eventArg);
        }

        if (!eventArg.defaultPrevented) {
          const hrefValue =
            typeof href === 'string' ? href : href.pathname ?? '';

          track(event, {
            href: hrefValue,
            ...eventProperties,
          });
        }
      },
      [event, eventProperties, href, onClick, track]
    );

    return (
      <Link ref={ref} href={href} onClick={handleClick} {...rest}>
        {children}
      </Link>
    );
  }
);

