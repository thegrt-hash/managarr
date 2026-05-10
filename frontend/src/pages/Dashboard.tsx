import { useQuery } from '@tanstack/react-query'
import { getDashboard } from '../api/client'
import ScanBar from '../components/ScanBar'
import { HardDrive, Folder, AlertTriangle, CheckCircle, Clock, Disc, Zap } from 'lucide-react'

function StatCard({ label, value, sub, icon: Icon, color = 'text-gray-400' }: {
  label: string; value: string | number; sub?: string
  icon: React.ElementType; color?: string
}) {
  return (
    <div className="bg-[#1a1d27] border border-[#2a2d3a] rounded-xl p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-400">{label}</p>
          <p className="text-2xl font-bold text-white mt-1">{value}</p>
          {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
        </div>
        <Icon size={22} className={color} />
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { data, isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: getDashboard })

  if (isLoading) return <div className="p-8 text-gray-400">Loading…</div>
  if (!data) return null

  const total = data.total_folders || 0
  const goodPct = total ? Math.round((data.good / total) * 100) : 0

  return (
    <div className="p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">Dashboard</h1>
        <p className="text-gray-400 text-sm">Overview of your media library health</p>
      </div>

      <div className="mb-6">
        <ScanBar />
      </div>

      {/* Score breakdown bar */}
      {total > 0 && (
        <div className="bg-[#1a1d27] border border-[#2a2d3a] rounded-xl p-5 mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-400">Library Health</span>
            <span className="text-white font-medium">{goodPct}% Good</span>
          </div>
          <div className="h-3 rounded-full overflow-hidden flex gap-0.5">
            <div className="bg-green-500" style={{ width: `${(data.good / total) * 100}%` }} />
            <div className="bg-yellow-500" style={{ width: `${(data.questionable / total) * 100}%` }} />
            <div className="bg-red-500" style={{ width: `${(data.needs_review / total) * 100}%` }} />
          </div>
          <div className="flex gap-4 mt-2 text-xs text-gray-400">
            <span><span className="text-green-400">●</span> Good {data.good}</span>
            <span><span className="text-yellow-400">●</span> Questionable {data.questionable}</span>
            <span><span className="text-red-400">●</span> Needs Review {data.needs_review}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <StatCard label="Total Folders" value={data.total_folders} icon={Folder} color="text-blue-400" />
        <StatCard label="Total Files" value={data.total_files} icon={HardDrive} color="text-indigo-400" />
        <StatCard label="Total Size" value={data.total_size} icon={HardDrive} color="text-purple-400" />
        <StatCard label="Good" value={data.good} icon={CheckCircle} color="text-green-400" />
        <StatCard label="Needs Review" value={data.needs_review} icon={AlertTriangle} color="text-red-400" />
        <StatCard label="Duplicates" value={data.duplicates} sub="folders with >1 video" icon={Clock} color="text-yellow-400" />
        <StatCard label="ISO Files" value={data.iso_folders} sub="folders with .iso" icon={Disc} color="text-orange-400" />
        <StatCard label="4K Content" value={data.has_4k} sub="targeting 1080p" icon={Zap} color="text-cyan-400" />
        <StatCard label="Missing Subs" value={data.missing_subtitles} sub="folders without subtitles" icon={Zap} color="text-purple-400" />
      </div>

      {data.baseline_changed > 0 && (
        <div className="mt-6 bg-orange-500/10 border border-orange-500/30 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle size={18} className="text-orange-400 shrink-0" />
          <span className="text-orange-300 text-sm">
            <strong>{data.baseline_changed}</strong> folder(s) have changed since their baseline was set. Check the Baselines page.
          </span>
        </div>
      )}
    </div>
  )
}
