import { PairList } from '@/components/PairList'

export default function HomePage() {
  return (
    <main className="container mx-auto px-4 py-6 md:py-8">
      <div className="mb-6 md:mb-8">
        <h1 className="text-3xl md:text-4xl font-bold mb-2">Live Markets</h1>
        <p className="text-sm md:text-base text-muted-foreground">
          Real-time cryptocurrency prices across multiple chains
        </p>
      </div>
      <PairList />
    </main>
  )
}
