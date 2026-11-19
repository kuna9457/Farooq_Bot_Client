import { useEffect, useRef } from 'react'
import { ColorType, CrosshairMode, LineStyle, createChart } from 'lightweight-charts'
import type { IChartApi, Time } from 'lightweight-charts'

const RIBBON_COLORS = ['#38bdf8', '#a78bfa', '#f472b6', '#facc15', '#34d399', '#fb923c']

export interface ChartData {
  candles: { time: number; open: number; high: number; low: number; close: number }[]
  volume?: { time: number; value: number }[]
  ce_long?: { time: number; value: number | null }[]
  ce_short?: { time: number; value: number | null }[]
  markers?: { time: number; position: string; color: string; shape: string; text: string }[]
  ribbon?: { name: string; data: { time: number; value: number }[] }[]
  levels?: { price: number; title: string; color: string }[]
  anchor_time?: number
  tf: string
}

export default function PriceChart({ data, height = 460 }: { data: ChartData; height?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)

  useEffect(() => {
    if (!ref.current) return
    const chart = createChart(ref.current, {
      height,
      layout: { background: { type: ColorType.Solid, color: '#121826' }, textColor: '#8a96ad', fontSize: 11 },
      grid: { vertLines: { color: '#1a2336' }, horzLines: { color: '#1a2336' } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: '#243049' },
      timeScale: { borderColor: '#243049', timeVisible: data.tf === '5m', secondsVisible: false },
      autoSize: true,
    })
    chartRef.current = chart

    const candles = chart.addCandlestickSeries({
      upColor: '#16a34a', downColor: '#dc2626', borderUpColor: '#16a34a', borderDownColor: '#dc2626',
      wickUpColor: '#16a34a', wickDownColor: '#dc2626',
    })
    candles.setData(data.candles.map((c) => ({ ...c, time: c.time as Time })))

    if (data.volume?.length) {
      const vol = chart.addHistogramSeries({ priceFormat: { type: 'volume' }, priceScaleId: 'vol', color: '#2b3a5a' })
      chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } })
      vol.setData(data.volume.map((v) => ({ ...v, time: v.time as Time })))
    }
    const line = (pts: { time: number; value: number }[] | undefined, color: string, width: 1 | 2 = 2, style = LineStyle.Solid) => {
      if (!pts?.length) return
      const s = chart.addLineSeries({ color, lineWidth: width, lineStyle: style, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false })
      s.setData(pts.map((p) => ({ ...p, time: p.time as Time })))
    }
    // Chandelier stop: one line, green while long (long stop), red while short (short stop)
    if (data.ce_long?.length) {
      const s = chart.addLineSeries({ lineWidth: 2, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false })
      const pts = data.ce_long.map((p, i) => {
        const sh = data.ce_short?.[i]?.value
        if (p.value !== null) return { time: p.time as Time, value: p.value, color: '#16a34a' }
        if (sh !== null && sh !== undefined) return { time: p.time as Time, value: sh, color: '#dc2626' }
        return { time: p.time as Time }
      })
      s.setData(pts as any)
    }
    data.ribbon?.forEach((r, i) => line(r.data, RIBBON_COLORS[i % RIBBON_COLORS.length], 1))
    data.levels?.forEach((l) => candles.createPriceLine({ price: l.price, color: l.color, lineWidth: 2, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: l.title }))
    const markers = [...(data.markers ?? [])]
    if (data.anchor_time) markers.push({ time: data.anchor_time, position: 'belowBar', color: '#3b82f6', shape: 'circle', text: 'VP anchor' })
    markers.sort((a, b) => a.time - b.time)
    candles.setMarkers(markers.map((m) => ({ ...m, time: m.time as Time })) as any)
    chart.timeScale().fitContent()
    return () => { chart.remove(); chartRef.current = null }
  }, [data, height])

  return <div ref={ref} className="w-full" style={{ height }} />
}
