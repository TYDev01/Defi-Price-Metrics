import { PairList } from '@/components/PairList'

export default function HomePage() {
  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Live Markets</h1>
        <p className="text-muted-foreground">
          Real-time cryptocurrency prices across multiple chains
        </p>
      </div>
      <PairList />
    </main>
  )
}
