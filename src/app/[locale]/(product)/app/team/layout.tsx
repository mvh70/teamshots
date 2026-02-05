import TeamRouteGuard from '@/components/guards/TeamRouteGuard'

export default function TeamLayout({ children }: { children: React.ReactNode }) {
  return <TeamRouteGuard>{children}</TeamRouteGuard>
}
