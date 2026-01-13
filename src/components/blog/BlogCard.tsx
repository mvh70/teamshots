import Link from 'next/link';
import type { BlogPost } from '@/config/blog';

interface BlogCardProps {
  post: BlogPost;
}

/**
 * Blog post card component for the blog index page.
 * Displays a preview of a blog post with title, description, and metadata.
 */
export default function BlogCard({ post }: BlogCardProps) {
  return (
    <article className="border-b border-gray-200 pb-8 last:border-0">
      <Link href={`/blog/${post.slug}`} className="group block">
        <h2 className="text-2xl font-semibold text-gray-900 group-hover:text-brand-primary transition-colors mb-2">
          {post.title}
        </h2>
        <p className="text-gray-600 mb-3">{post.description}</p>
        <div className="flex items-center gap-4 text-sm text-gray-500">
          {post.date && (
            <time dateTime={post.date}>
              {new Date(post.date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </time>
          )}
          {post.date && post.readTime && <span>·</span>}
          {post.readTime && <span>{post.readTime}</span>}
        </div>
      </Link>
    </article>
  );
}
