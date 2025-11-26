'use client'

import { useEffect, useState, useRef } from 'react'
import { getPackageConfig } from '@/domain/style/packages'

interface Package {
  packageId: string
  name: string
  description: string
  label: string
}

interface PackageSelectorProps {
  value?: string
  onChange: (packageId: string) => void
}

export default function PackageSelector({ value, onChange }: PackageSelectorProps) {
  const [packages, setPackages] = useState<Package[]>([])
  const [loading, setLoading] = useState(true)
  // Track if we've set the initial value to avoid calling onChange multiple times
  const hasSetInitialValue = useRef(false)

  // Use value prop directly (controlled component)
  const selectedPackage = value || ''

  // Intentional data fetching effect - only auto-selects when no value provided
  /* eslint-disable react-you-might-not-need-an-effect/no-adjust-state-on-prop-change */
  useEffect(() => {
    const fetchPackages = async () => {
      try {
        const response = await fetch('/api/packages/owned', {
          credentials: 'include'
        })
        
        if (response.ok) {
          const data = await response.json()
          const userPackages = data.packages || []
          
          // Always set packages (needed for single package case too)
          setPackages(userPackages)
          
          // Set initial value only once if not already set and we have packages
          if (!hasSetInitialValue.current && !value && userPackages.length > 0) {
            hasSetInitialValue.current = true
            const firstPackage = userPackages[0].packageId
            onChange(firstPackage)
          }
        }
      } catch (error) {
        console.error('Error fetching packages:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchPackages()
  }, [onChange, value])
  /* eslint-enable react-you-might-not-need-an-effect/no-adjust-state-on-prop-change */

  const handleChange = (packageId: string) => {
    onChange(packageId)
  }

  // Don't show selector if user has only one package or none
  if (loading || packages.length <= 1) {
    return null
  }

  const selectedPkg = packages.find(p => p.packageId === selectedPackage)
  const selectedPackageConfig = selectedPackage ? getPackageConfig(selectedPackage) : null
  const selectedDescription = selectedPkg?.description || selectedPackageConfig?.label || ''

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Photo Style Package</h2>
      
      <div className="space-y-4">
        <div>
          <label htmlFor="package-select" className="block text-sm font-medium text-gray-700 mb-2">
            Select Package
          </label>
          <select
            id="package-select"
            value={selectedPackage}
            onChange={(e) => handleChange(e.target.value)}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
          >
            {packages.map((pkg) => (
              <option key={pkg.packageId} value={pkg.packageId}>
                {pkg.name}
              </option>
            ))}
          </select>
        </div>

        {selectedDescription && (
          <div className="mt-2 p-3 bg-gray-50 rounded-md">
            <p className="text-sm text-gray-600">{selectedDescription}</p>
          </div>
        )}
      </div>
    </div>
  )
}

