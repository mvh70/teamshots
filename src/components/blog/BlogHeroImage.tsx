import Image from 'next/image';

interface BlogHeroImageProps {
  slug: string;
  alt: string;
  caption?: {
    en: string;
    es: string;
  };
  locale: string;
}

/**
 * Reusable hero image component for blog posts.
 * Automatically handles the image path based on slug.
 */
export function BlogHeroImage({ slug, alt, caption, locale }: BlogHeroImageProps) {
  return (
    <figure className="mb-10 -mx-4 sm:mx-0">
      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-none sm:rounded-2xl bg-gray-100">
        <Image
          src={`/blog/${slug}.png`}
          alt={alt}
          fill
          priority
          unoptimized
          className="object-cover"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1200px"
        />
      </div>
      {caption && (
        <figcaption className="mt-3 text-center text-sm text-gray-500 px-4 sm:px-0">
          {locale === 'es' ? caption.es : caption.en}
        </figcaption>
      )}
    </figure>
  );
}
