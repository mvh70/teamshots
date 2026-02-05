import TeamRouteGuard from '@/components/guards/TeamRouteGuard'

export default function TeamGenerationsLayout({ children }: { children: React.ReactNode }) {
  return <TeamRouteGuard>{children}</TeamRouteGuard>
}
