import { Header } from '@/components/Header'
import { TradingChart } from '@/components/TradingChart'
import { PairStats } from '@/components/PairStats'
import { PriceHeader } from '@/components/PriceHeader'

interface PairPageProps {
  params: {
    id: string
  }
}

export default function PairPage({ params }: PairPageProps) {
  // Decode pair ID (format: chain:address)
  const pairKey = decodeURIComponent(params.id)

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <PriceHeader pairKey={pairKey} />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          <div className="lg:col-span-2">
            <TradingChart pairKey={pairKey} />
          </div>
          <div className="lg:col-span-1">
            <PairStats pairKey={pairKey} />
          </div>
        </div>
      </main>
    </div>
  )
}
