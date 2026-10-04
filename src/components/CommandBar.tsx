import React, { useState } from 'react';
import { AIReasoningService } from '../services/aiReasoningService';
import { Sparkles, Terminal, ArrowRight, Loader2 } from 'lucide-react';

interface CommandBarProps {
  onApplyCommand: (parsed: {
    instruments: string[];
    timeframe: string;
    tradingStyle: string;
    minRiskReward: number;
    mode: string;
  }) => void;
}

export const CommandBar: React.FC<CommandBarProps> = ({ onApplyCommand }) => {
  const [commandText, setCommandText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastParsed, setLastParsed] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commandText.trim()) return;

    setIsProcessing(true);
    try {
      const parsed = await AIReasoningService.parseNaturalLanguageCommand(commandText);
      setLastParsed(parsed);
      onApplyCommand(parsed);
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const quickCommands = [
    'Monitor NIFTY 50, GOLD and HDFC BANK',
    'Monitor BTC/USD, ETH/USD with 1:2 R:R scalping 5M',
    'Monitor RELIANCE and BANK NIFTY conservative mode 15M'
  ];

  return (
    <div className="bg-[#0b0f17] border border-[#1c2638] rounded-xl p-3 font-sans space-y-2">
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <div className="relative flex-1">
          <Terminal className="w-4 h-4 text-cyan-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="input-nl-command"
            type="text"
            value={commandText}
            onChange={(e) => setCommandText(e.target.value)}
            placeholder="Command TRADYX: e.g. 'Monitor NIFTY 50, GOLD and HDFC BANK in 15M balanced mode'..."
            className="w-full bg-[#080b12] border border-[#1f293d] rounded-lg pl-9 pr-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
          />
        </div>

        <button
          id="btn-submit-nl-command"
          type="submit"
          disabled={isProcessing || !commandText.trim()}
          className="px-3.5 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-mono font-bold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-40"
        >
          {isProcessing ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Sparkles className="w-3.5 h-3.5" />
          )}
          <span>Apply Command</span>
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 font-mono">
        <span className="text-slate-400">Quick Prompt:</span>
        {quickCommands.map((qc, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setCommandText(qc)}
            className="px-2 py-0.5 rounded bg-[#101724] hover:bg-[#182335] text-slate-300 hover:text-cyan-300 transition-colors"
          >
            "{qc}"
          </button>
        ))}
      </div>

      {lastParsed && (
        <div className="flex items-center gap-2 text-[10px] font-mono text-emerald-400 bg-emerald-950/20 border border-emerald-500/20 px-2.5 py-1 rounded-md">
          <span>Validated Instruments: <strong>{lastParsed.instruments?.join(', ')}</strong></span>
          <span>• Timeframe: <strong>{lastParsed.timeframe}</strong></span>
          <span>• Mode: <strong>{lastParsed.mode}</strong></span>
        </div>
      )}
    </div>
  );
};
