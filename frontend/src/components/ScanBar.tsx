import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getScanStatus, startScan, stopScan } from '../api/client'
import { Play, Square, Loader2 } from 'lucide-react'

export default function ScanBar() {
  const qc = useQueryClient()
  const { data } = useQuery({
    queryKey: ['scan-status'],
    queryFn: getScanStatus,
    refetchInterval: (query) => query.state.data?.status === 'running' ? 2000 : false,
  })

  const running = data?.status === 'running'
  const pct = data?.total > 0 ? Math.round((data.progress / data.total) * 100) : 0

  const handleStart = async () => {
    await startScan()
    qc.invalidateQueries({ queryKey: ['scan-status'] })
  }

  const handleStop = async () => {
    await stopScan()
    qc.invalidateQueries({ queryKey: ['scan-status'] })
    qc.invalidateQueries({ queryKey: ['dashboard'] })
  }

  return (
    <div className="flex items-center gap-3 bg-[#1a1d27] border border-[#2a2d3a] rounded-lg px-4 py-2">
      {running ? (
        <>
          <Loader2 size={16} className="animate-spin text-blue-400" />
          <div className="flex-1 min-w-0">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span className="truncate">{data?.current_path || 'Scanning…'}</span>
              <span className="ml-2 shrink-0">{data?.progress}/{data?.total} ({pct}%)</span>
            </div>
            <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
          <button onClick={handleStop} className="text-red-400 hover:text-red-300 p-1">
            <Square size={16} />
          </button>
        </>
      ) : (
        <>
          <span className="text-sm text-gray-400">
            {data?.status === 'completed' ? `Last scan: ${data?.progress} folders` : 'Ready to scan'}
          </span>
          <button
            onClick={handleStart}
            className="ml-auto flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm px-3 py-1.5 rounded-md"
          >
            <Play size={14} /> Scan Library
          </button>
        </>
      )}
    </div>
  )
}
