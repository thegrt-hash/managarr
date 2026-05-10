import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getDuplicates, bulkDelete } from '../api/client'
import ScoreBadge from '../components/ScoreBadge'
import { Trash2, ChevronDown, ChevronRight } from 'lucide-react'

export default function Duplicates() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const [msg, setMsg] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['duplicates', page],
    queryFn: () => getDuplicates({ page, per_page: 20 }),
  })

  const toggleExpand = (id: number) => {
    setExpanded(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  const toggleFile = (fid: number) => {
    setSelected(prev => {
      const n = new Set(prev)
      n.has(fid) ? n.delete(fid) : n.add(fid)
      return n
    })
  }

  const handleDelete = async () => {
    if (!selected.size) return
    setDeleting(true)
    try {
      const res = await bulkDelete([...selected])
      setMsg(`Deleted ${res.deleted.length} file(s)`)
      setSelected(new Set())
      qc.invalidateQueries({ queryKey: ['duplicates'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    } catch {
      setMsg('Delete failed')
    } finally {
      setDeleting(false)
    }
  }

  const totalPages = data ? Math.ceil(data.total / 20) : 1

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-white mb-1">Duplicates</h1>
        <p className="text-gray-400 text-sm">{data?.total ?? '…'} folders with multiple video files</p>
      </div>

      <div className="flex gap-2 mb-4">
        {selected.size > 0 && (
          <button onClick={handleDelete} disabled={deleting}
            className="flex items-center gap-1.5 bg-red-600 hover:bg-red-500 text-white text-sm px-3 py-1.5 rounded-md">
            <Trash2 size={14} /> Delete {selected.size} selected
          </button>
        )}
        {msg && <span className="text-sm text-green-400 py-1.5">{msg}</span>}
      </div>

      {isLoading ? (
        <div className="text-gray-400">Loading…</div>
      ) : (
        <div className="space-y-3">
          {data?.items?.map((folder: any) => {
            const isOpen = expanded.has(folder.id)
            const videoFiles = folder.files?.filter((f: any) => !f.is_iso) ?? []
            return (
              <div key={folder.id} className="bg-[#1a1d27] border border-[#2a2d3a] rounded-xl overflow-hidden">
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/3"
                  onClick={() => toggleExpand(folder.id)}
                >
                  {isOpen ? <ChevronDown size={16} className="text-gray-500" /> : <ChevronRight size={16} className="text-gray-500" />}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-200 truncate">{folder.name}</div>
                    <div className="text-xs text-gray-500 truncate">{folder.path}</div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-gray-400">{videoFiles.length} files · {folder.total_size}</span>
                    <ScoreBadge label={folder.score_label} score={folder.score} />
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-[#2a2d3a]">
                    <table className="w-full text-sm">
                      <thead className="bg-[#13151f]">
                        <tr>
                          <th className="px-4 py-2 w-8" />
                          <th className="px-3 py-2 text-left text-xs text-gray-400 uppercase">File</th>
                          <th className="px-3 py-2 text-left text-xs text-gray-400 uppercase">Size</th>
                          <th className="px-3 py-2 text-left text-xs text-gray-400 uppercase">Quality</th>
                          <th className="px-3 py-2 text-left text-xs text-gray-400 uppercase">Duration</th>
                          <th className="px-3 py-2 text-left text-xs text-gray-400 uppercase">Codec</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#2a2d3a]">
                        {videoFiles.map((f: any) => (
                          <tr key={f.id} className={selected.has(f.id) ? 'bg-red-900/20' : 'hover:bg-white/3'}>
                            <td className="px-4 py-2.5">
                              <input type="checkbox" checked={selected.has(f.id)} onChange={() => toggleFile(f.id)} className="accent-red-500" />
                            </td>
                            <td className="px-3 py-2.5 font-mono text-xs text-gray-200 break-all">{f.filename}</td>
                            <td className="px-3 py-2.5 text-gray-300 whitespace-nowrap">{f.size}</td>
                            <td className="px-3 py-2.5">
                              <span className={`text-xs ${f.is_4k ? 'text-cyan-400' : f.quality_label === '1080p' ? 'text-green-400' : 'text-yellow-400'}`}>
                                {f.quality_label ?? '—'}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-gray-400">{f.duration_label}</td>
                            <td className="px-3 py-2.5 text-gray-500 text-xs">{f.video_codec ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
            className="px-3 py-1 text-sm bg-[#1a1d27] border border-[#2a2d3a] rounded disabled:opacity-40">← Prev</button>
          <span className="px-3 py-1 text-sm text-gray-400">{page} / {totalPages}</span>
          <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
            className="px-3 py-1 text-sm bg-[#1a1d27] border border-[#2a2d3a] rounded disabled:opacity-40">Next →</button>
        </div>
      )}
    </div>
  )
}
