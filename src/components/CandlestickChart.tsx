import React, { useState, useRef } from 'react';
import { Candle, Timeframe } from '../types';

interface CandlestickChartProps {
  symbol: string;
  timeframe: Timeframe;
  candles: Candle[];
  ema20?: number;
  ema50?: number;
  vwap?: number;
  resistance?: number;
  support?: number;
  onTimeframeChange?: (tf: Timeframe) => void;
}

export const CandlestickChart: React.FC<CandlestickChartProps> = ({
  symbol,
  timeframe,
  candles,
  ema20,
  ema50,
  vwap,
  resistance,
  support,
  onTimeframeChange
}) => {
  const [hoveredCandle, setHoveredCandle] = useState<Candle | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const timeframes: Timeframe[] = ['1M', '5M', '15M', '1H', '4H', '1D'];

  if (!candles || candles.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center bg-[#0d1117] border border-[#1e2633] rounded-lg text-slate-500 font-mono text-xs">
        AWAITING VERIFIED OHLCV FEED
      </div>
    );
  }

  const visibleCandles = candles.slice(-45);
  const maxPrice = Math.max(...visibleCandles.map((c) => c.high), resistance || 0);
  const minPrice = Math.min(...visibleCandles.map((c) => c.low), support || Infinity);
  const priceRange = Math.max(maxPrice - minPrice, 0.5);

  const maxVolume = Math.max(...visibleCandles.map((c) => c.volume), 1);

  const chartHeight = 220;
  const chartWidth = 720;
  const candleSpacing = chartWidth / visibleCandles.length;
  const candleWidth = Math.max(candleSpacing * 0.65, 3);

  const getY = (price: number) => {
    return chartHeight - ((price - minPrice) / priceRange) * (chartHeight - 30) - 15;
  };

  const currentCandle = visibleCandles[visibleCandles.length - 1];

  return (
    <div className="bg-[#0b0f17] border border-[#1c2433] rounded-xl p-4 flex flex-col gap-3 font-sans">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1c2433] pb-3">
        <div className="flex items-center gap-3">
          <span className="font-mono font-bold text-base text-white">{symbol}</span>
          <span className="font-mono text-sm font-semibold text-cyan-400">
            {currentCandle.close.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </span>
          <span
            className={`font-mono text-xs px-2 py-0.5 rounded ${
              currentCandle.close >= currentCandle.open
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
            }`}
          >
            {currentCandle.close >= currentCandle.open ? '+' : ''}
            {(
              ((currentCandle.close - currentCandle.open) / currentCandle.open) *
              100
            ).toFixed(2)}
            %
          </span>
        </div>

        {/* Timeframe Buttons */}
        <div className="flex items-center gap-1 bg-[#121824] p-1 rounded-lg border border-[#1e293b]">
          {timeframes.map((tf) => (
            <button
              key={tf}
              id={`btn-tf-${tf.toLowerCase()}`}
              onClick={() => onTimeframeChange?.(tf)}
              className={`px-2 py-0.5 text-xs font-mono font-medium rounded transition-colors ${
                timeframe === tf
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Crosshair / Candle details header */}
      <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 min-h-[20px]">
        {hoveredCandle ? (
          <div className="flex items-center gap-3">
            <span>O: <strong className="text-white">{hoveredCandle.open}</strong></span>
            <span>H: <strong className="text-white">{hoveredCandle.high}</strong></span>
            <span>L: <strong className="text-white">{hoveredCandle.low}</strong></span>
            <span>C: <strong className="text-white">{hoveredCandle.close}</strong></span>
            <span>Vol: <strong className="text-white">{hoveredCandle.volume.toLocaleString()}</strong></span>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-slate-500">
            <span>O: {currentCandle.open}</span>
            <span>H: {currentCandle.high}</span>
            <span>L: {currentCandle.low}</span>
            <span>C: {currentCandle.close}</span>
            <span>Vol: {currentCandle.volume.toLocaleString()}</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-[10px]">
          <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-cyan-400 inline-block"></span> EMA20</span>
          <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-amber-400 inline-block"></span> EMA50</span>
          <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-purple-400 inline-block"></span> VWAP</span>
        </div>
      </div>

      {/* SVG Canvas */}
      <div ref={containerRef} className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full h-auto cursor-crosshair select-none"
          onMouseLeave={() => setHoveredCandle(null)}
        >
          {/* Background Grid Lines */}
          {[0.2, 0.4, 0.6, 0.8].map((ratio, i) => (
            <line
              key={i}
              x1={0}
              y1={chartHeight * ratio}
              x2={chartWidth}
              y2={chartHeight * ratio}
              stroke="#17202e"
              strokeDasharray="3 3"
              strokeWidth="1"
            />
          ))}

          {/* Resistance Level Line */}
          {resistance && resistance > minPrice && resistance < maxPrice && (
            <g>
              <line
                x1={0}
                y1={getY(resistance)}
                x2={chartWidth}
                y2={getY(resistance)}
                stroke="#f43f5e"
                strokeDasharray="4 2"
                strokeWidth="1"
                opacity={0.8}
              />
              <text
                x={chartWidth - 65}
                y={getY(resistance) - 4}
                fill="#f43f5e"
                fontSize="9"
                fontFamily="monospace"
              >
                RES: {resistance}
              </text>
            </g>
          )}

          {/* Support Level Line */}
          {support && support > minPrice && support < maxPrice && (
            <g>
              <line
                x1={0}
                y1={getY(support)}
                x2={chartWidth}
                y2={getY(support)}
                stroke="#10b981"
                strokeDasharray="4 2"
                strokeWidth="1"
                opacity={0.8}
              />
              <text
                x={chartWidth - 65}
                y={getY(support) - 4}
                fill="#10b981"
                fontSize="9"
                fontFamily="monospace"
              >
                SUP: {support}
              </text>
            </g>
          )}

          {/* Volume bars */}
          {visibleCandles.map((c, idx) => {
            const x = idx * candleSpacing + candleSpacing / 2;
            const volHeight = (c.volume / maxVolume) * 45;
            const isGreen = c.close >= c.open;
            return (
              <rect
                key={`vol-${idx}`}
                x={x - candleWidth / 2}
                y={chartHeight - volHeight}
                width={candleWidth}
                height={volHeight}
                fill={isGreen ? '#10b981' : '#f43f5e'}
                opacity={0.25}
              />
            );
          })}

          {/* Candlesticks */}
          {visibleCandles.map((c, idx) => {
            const x = idx * candleSpacing + candleSpacing / 2;
            const isGreen = c.close >= c.open;
            const highY = getY(c.high);
            const lowY = getY(c.low);
            const openY = getY(c.open);
            const closeY = getY(c.close);
            const bodyTop = Math.min(openY, closeY);
            const bodyHeight = Math.max(Math.abs(openY - closeY), 1.5);
            const color = isGreen ? '#10b981' : '#f43f5e';

            return (
              <g
                key={`candle-${idx}`}
                className="transition-opacity hover:opacity-80"
                onMouseEnter={() => setHoveredCandle(c)}
              >
                {/* Wick */}
                <line
                  x1={x}
                  y1={highY}
                  x2={x}
                  y2={lowY}
                  stroke={color}
                  strokeWidth="1.2"
                />
                {/* Body */}
                <rect
                  x={x - candleWidth / 2}
                  y={bodyTop}
                  width={candleWidth}
                  height={bodyHeight}
                  fill={color}
                  rx={1}
                />
              </g>
            );
          })}

          {/* Overlay Lines (EMA20, EMA50, VWAP) */}
          {ema20 && (
            <line
              x1={0}
              y1={getY(ema20)}
              x2={chartWidth}
              y2={getY(ema20)}
              stroke="#06b6d4"
              strokeWidth="1.2"
              strokeDasharray="2 2"
              opacity={0.7}
            />
          )}
          {vwap && (
            <line
              x1={0}
              y1={getY(vwap)}
              x2={chartWidth}
              y2={getY(vwap)}
              stroke="#c084fc"
              strokeWidth="1.2"
              opacity={0.7}
            />
          )}
        </svg>
      </div>

      {/* Transparency footer */}
      <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono pt-1 border-t border-[#1c2433]">
        <span>Feed: Deterministic OHLCV Series</span>
        <span className="text-cyan-400/80">CODE CALCULATES. AI REASONS. USER DECIDES.</span>
      </div>
    </div>
  );
};
