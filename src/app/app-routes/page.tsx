import { BRAND_CONFIG } from '@/config/brand';

export default function AppHome() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Welcome to {BRAND_CONFIG.name}
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Your dashboard will be here soon!
        </p>
        <div className="text-sm text-gray-500">
          This is app.{BRAND_CONFIG.domain}
        </div>
      </div>
    </div>
  );
}

