import Link from 'next/link'

export default function InviteExpiredPage() {
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Invite link unavailable</h1>
        <p className="mt-3 text-sm text-gray-600">
          This invite link is invalid, expired, or access has been revoked. Please contact your team admin for a new link.
        </p>
        <Link
          href="/"
          className="inline-flex mt-6 px-4 py-2 rounded-md bg-gray-900 text-white text-sm font-medium hover:bg-black transition-colors"
        >
          Back to home
        </Link>
      </div>
    </main>
  )
}
