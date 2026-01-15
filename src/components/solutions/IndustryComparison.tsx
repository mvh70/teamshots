'use client'

import { useTranslations } from 'next-intl'
import { Check } from 'lucide-react'

interface ComparisonProps {
  industry: string
}

export function IndustryComparison({ industry }: ComparisonProps) {
  const t = useTranslations(`solutions.${industry}.comparison`)
  const headers = t.raw('headers') as string[]
  const rows = t.raw('rows') as string[][]

  return (
    <section className="py-16 sm:py-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl sm:text-4xl font-display font-bold text-text-dark text-center mb-12">
          {t('title')}
        </h2>

        <div className="overflow-hidden rounded-2xl border border-bg-gray-100 shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px]">
              <thead className="bg-bg-gray-50">
                <tr>
                  {headers.map((header, i) => (
                    <th
                      key={i}
                      className={`px-6 py-4 text-left text-sm font-semibold ${
                        i === 2 ? 'text-brand-primary bg-brand-primary/5' : 'text-text-dark'
                      }`}
                    >
                      {i === 2 && (
                        <Check className="inline-block w-4 h-4 mr-2 text-brand-primary" />
                      )}
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-bg-gray-100 bg-bg-white">
                {rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((cell, cellIndex) => (
                      <td
                        key={cellIndex}
                        className={`px-6 py-4 text-sm ${
                          cellIndex === 2
                            ? 'text-brand-primary font-semibold bg-brand-primary/5'
                            : cellIndex === 1
                            ? 'text-text-muted'
                            : 'text-text-dark font-medium'
                        }`}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  )
}
