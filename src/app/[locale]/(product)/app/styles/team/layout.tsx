import TeamRouteGuard from '@/components/guards/TeamRouteGuard'

export default function TeamStylesLayout({ children }: { children: React.ReactNode }) {
  return <TeamRouteGuard>{children}</TeamRouteGuard>
}
