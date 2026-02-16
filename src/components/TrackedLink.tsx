'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { forwardRef, useCallback, useMemo } from 'react';
import type { ComponentPropsWithoutRef, MouseEvent } from 'react';
import { useAnalytics } from '@/hooks/useAnalytics';

type LinkProps = ComponentPropsWithoutRef<typeof Link>;

interface TrackedLinkProps extends LinkProps {
  event: string;
  eventProperties?: Record<string, unknown>;
}

function isSignupPath(pathname: string): boolean {
  return pathname === '/auth/signup' || pathname === '/auth/signup/';
}

function getHrefPathname(href: LinkProps['href']): string {
  if (typeof href === 'string') {
    if (href.startsWith('/')) {
      return href.split('?')[0].split('#')[0];
    }

    try {
      return new URL(href).pathname;
    } catch {
      return '';
    }
  }

  if (
    href &&
    typeof href === 'object' &&
    'pathname' in href &&
    typeof href.pathname === 'string'
  ) {
    return href.pathname;
  }

  return '';
}

function getAttributionEntries(searchParams: ReturnType<typeof useSearchParams>): Array<[string, string]> {
  const entries: Array<[string, string]> = [];

  if (!searchParams) {
    return entries;
  }

  searchParams.forEach((value, key) => {
    const normalizedKey = key.toLowerCase();
    if (normalizedKey === 'gclid' || normalizedKey.startsWith('utm_')) {
      entries.push([key, value]);
    }
  });

  return entries;
}

function mergeAttributionIntoStringHref(href: string, entries: Array<[string, string]>): string {
  const isAbsolute = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(href);
  const parsedHref = new URL(href, 'https://teamshotspro.local');

  for (const [key, value] of entries) {
    if (!parsedHref.searchParams.has(key)) {
      parsedHref.searchParams.set(key, value);
    }
  }

  if (isAbsolute) {
    return parsedHref.toString();
  }

  const query = parsedHref.searchParams.toString();
  return `${parsedHref.pathname}${query ? `?${query}` : ''}${parsedHref.hash}`;
}

function mergeAttributionIntoObjectHref(
  href: Extract<LinkProps['href'], object>,
  entries: Array<[string, string]>
): LinkProps['href'] {
  const existingQuery = (
    'query' in href && href.query && typeof href.query === 'object'
      ? href.query
      : {}
  ) as Record<string, string | string[] | number | boolean | undefined>;
  const mergedQuery = { ...existingQuery };

  for (const [key, value] of entries) {
    if (!(key in mergedQuery)) {
      mergedQuery[key] = value;
    }
  }

  return {
    ...href,
    query: mergedQuery,
  };
}

export const TrackedLink = forwardRef<HTMLAnchorElement, TrackedLinkProps>(
  function TrackedLink(
    { event, eventProperties, href, onClick, children, ...rest },
    ref
  ) {
    const { track } = useAnalytics();
    const searchParams = useSearchParams();

    const resolvedHref = useMemo(() => {
      const pathname = getHrefPathname(href);
      if (!isSignupPath(pathname)) {
        return href;
      }

      const attributionEntries = getAttributionEntries(searchParams);
      if (attributionEntries.length === 0) {
        return href;
      }

      if (typeof href === 'string') {
        return mergeAttributionIntoStringHref(href, attributionEntries);
      }

      if (href && typeof href === 'object') {
        return mergeAttributionIntoObjectHref(href, attributionEntries);
      }

      return href;
    }, [href, searchParams]);

    const handleClick = useCallback(
      (eventArg: MouseEvent<HTMLAnchorElement>) => {
        if (onClick) {
          onClick(eventArg);
        }

        if (!eventArg.defaultPrevented) {
          const hrefValue =
            typeof resolvedHref === 'string' ? resolvedHref : resolvedHref.pathname ?? '';

          track(event, {
            href: hrefValue,
            ...eventProperties,
          });
        }
      },
      [event, eventProperties, onClick, resolvedHref, track]
    );

    return (
      <Link ref={ref} href={resolvedHref} onClick={handleClick} {...rest}>
        {children}
      </Link>
    );
  }
);
