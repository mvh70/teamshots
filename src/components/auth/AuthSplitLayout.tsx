import { playfair, sourceSans } from '@/lib/fonts'
import AuthSplitLayoutClient from './AuthSplitLayoutClient'

export default function AuthSplitLayout({
  left,
  children,
}: {
  left?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className={`${playfair.variable} ${sourceSans.variable}`}>
      <AuthSplitLayoutClient left={left}>
        {children}
      </AuthSplitLayoutClient>
    </div>
  )
}
