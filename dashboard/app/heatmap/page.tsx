import { Heatmap } from '@/components/Heatmap'

export default function HeatmapPage() {
  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Market Heatmap</h1>
        <p className="text-muted-foreground">
          Visualize market movements and liquidity across all pairs
        </p>
      </div>
      <Heatmap />
    </main>
  )
}
