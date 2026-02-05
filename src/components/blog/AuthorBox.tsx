import Image from 'next/image';

interface AuthorBoxProps {
  name: string;
  title: string;
  bio: string;
  imageSrc?: string;
  initials?: string;
  linkedInUrl?: string;
}

export function AuthorBox({
  name,
  title,
  bio,
  imageSrc = '/images/author.png',
  initials,
  linkedInUrl,
}: AuthorBoxProps) {
  return (
    <div className="mt-16 p-6 border border-gray-200 rounded-lg flex gap-4 bg-white">
      <div className="relative w-16 h-16 flex-shrink-0">
        {imageSrc ? (
          <Image
            src={imageSrc}
            alt={name}
            fill
            className="rounded-full object-cover"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-semibold text-lg">
            {initials || name.split(' ').map(n => n[0]).join('')}
          </div>
        )}
      </div>
      <div>
        <h3 className="font-semibold text-gray-900">About the Author</h3>
        <p className="text-sm text-gray-500 mb-1">{title}</p>
        <p className="text-sm text-gray-600 mt-1">{bio}</p>
        {linkedInUrl && (
          <a
            href={linkedInUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-brand-primary hover:underline mt-2 inline-block"
          >
            Connect on LinkedIn →
          </a>
        )}
      </div>
    </div>
  );
}

