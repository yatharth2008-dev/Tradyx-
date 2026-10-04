import React from 'react';
import { AuditEvent } from '../types';
import { Shield, FileText, Download } from 'lucide-react';

interface AuditLogViewProps {
  logs: AuditEvent[];
}

export const AuditLogView: React.FC<AuditLogViewProps> = ({ logs }) => {
  const exportCsv = () => {
    const headers = 'ID,Timestamp,Symbol,Timeframe,Event,DataSource,MarketState,AIDecision,Details\n';
    const rows = logs
      .map(
        (l) =>
          `"${l.id}","${l.timestamp}","${l.symbol}","${l.timeframe}","${l.event}","${l.dataSource}","${l.marketState}","${l.aiDecision}","${l.details.replace(/"/g, '""')}"`
      )
      .join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tradyx-audit-log-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-[#0b0f17] border border-[#1c2638] rounded-xl p-4 font-sans space-y-3">
      <div className="flex items-center justify-between pb-3 border-b border-[#1c2638]">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-cyan-400" />
          <div>
            <h3 className="font-mono text-xs font-bold text-white">
              DETERMINISTIC SESSION AUDIT TRAIL ({logs.length} RECORDS)
            </h3>
            <p className="text-[11px] text-slate-400">
              Immutable ledger of market events, indicator triggers, and AI decision states
            </p>
          </div>
        </div>

        <button
          onClick={exportCsv}
          disabled={logs.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#141d2b] hover:bg-[#1d2a3d] border border-[#202e42] text-xs font-mono text-slate-300 transition-colors disabled:opacity-40"
        >
          <Download className="w-3.5 h-3.5" />
          Export CSV
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left font-mono text-xs border-collapse">
          <thead>
            <tr className="border-b border-[#1c2638] text-[10px] uppercase text-slate-500">
              <th className="py-2 px-2">Time</th>
              <th className="py-2 px-2">Symbol</th>
              <th className="py-2 px-2">TF</th>
              <th className="py-2 px-2">Event</th>
              <th className="py-2 px-2">State</th>
              <th className="py-2 px-2">AI Output</th>
              <th className="py-2 px-2">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#151c27]">
            {logs.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-6 text-slate-500 font-sans text-xs">
                  No session events recorded yet. Start a monitoring session to begin logging.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-[#101724] transition-colors">
                  <td className="py-2 px-2 text-slate-400 text-[11px]">{log.timestamp}</td>
                  <td className="py-2 px-2 font-bold text-white">{log.symbol}</td>
                  <td className="py-2 px-2 text-slate-400">{log.timeframe}</td>
                  <td className="py-2 px-2 text-cyan-300 font-semibold">{log.event}</td>
                  <td className="py-2 px-2">
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">
                      {log.marketState}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-emerald-400 font-semibold">{log.aiDecision}</td>
                  <td className="py-2 px-2 text-slate-400 max-w-xs truncate font-sans text-[11px]">
                    {log.details}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
