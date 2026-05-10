import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getBaselines, removeBaseline } from '../api/client'
import ScoreBadge from '../components/ScoreBadge'
import { BookMarked, Trash2, AlertTriangle, CheckCircle } from 'lucide-react'

export default function Baselines() {
  const qc = useQueryClient()
  const [msg, setMsg] = useState('')
  const { data, isLoading } = useQuery({ queryKey: ['baselines'], queryFn: getBaselines })

  const handleRemove = async (id: number) => {
    await removeBaseline(id)
    setMsg('Baseline removed')
    qc.invalidateQueries({ queryKey: ['baselines'] })
    qc.invalidateQueries({ queryKey: ['dashboard'] })
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2 mb-1">
          <BookMarked size={22} className="text-indigo-400" /> Baselines
        </h1>
        <p className="text-gray-400 text-sm">
          Folders with a snapshot set. Managarr alerts you if files change after the baseline.
        </p>
      </div>

      {msg && <p className="text-green-400 text-sm mb-3">{msg}</p>}

      {isLoading ? (
        <div className="text-gray-400">Loading…</div>
      ) : !data?.length ? (
        <div className="bg-[#1a1d27] border border-[#2a2d3a] rounded-xl p-8 text-center text-gray-500">
          No baselines set yet. Open a folder and click "Set Baseline" to establish a known-good snapshot.
        </div>
      ) : (
        <div className="bg-[#1a1d27] border border-[#2a2d3a] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-[#2a2d3a] bg-[#13151f]">
              <tr>
                <th className="px-4 py-2 text-left text-xs text-gray-400 uppercase">Folder</th>
                <th className="px-4 py-2 text-left text-xs text-gray-400 uppercase">Score</th>
                <th className="px-4 py-2 text-left text-xs text-gray-400 uppercase">Size</th>
                <th className="px-4 py-2 text-left text-xs text-gray-400 uppercase">Baseline Set</th>
                <th className="px-4 py-2 text-left text-xs text-gray-400 uppercase">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2a2d3a]">
              {data.map((f: any) => (
                <tr key={f.id} className="hover:bg-white/3">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-200">{f.name}</div>
                    <div className="text-xs text-gray-500 truncate max-w-xs">{f.path}</div>
                  </td>
                  <td className="px-4 py-3"><ScoreBadge label={f.score_label} /></td>
                  <td className="px-4 py-3 text-gray-300">{f.total_size}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {f.baseline_set_at ? new Date(f.baseline_set_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {f.baseline_changed ? (
                      <span className="flex items-center gap-1 text-red-400 text-xs">
                        <AlertTriangle size={12} /> Changed
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-green-400 text-xs">
                        <CheckCircle size={12} /> Stable
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleRemove(f.id)}
                      className="text-gray-500 hover:text-red-400 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
