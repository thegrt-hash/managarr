import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getIsoFiles, bulkDelete } from '../api/client'
import { Disc, Trash2 } from 'lucide-react'

export default function ISOFiles() {
  const qc = useQueryClient()
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const [msg, setMsg] = useState('')

  const { data, isLoading } = useQuery({ queryKey: ['iso-files'], queryFn: getIsoFiles })

  const toggle = (id: number) => {
    setSelected(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const ids = selected.size > 0 ? [...selected] : (data?.items ?? []).map((f: any) => f.id)
      const res = await bulkDelete(ids)
      setMsg(`Deleted ${res.deleted.length} ISO file(s)`)
      setSelected(new Set())
      qc.invalidateQueries({ queryKey: ['iso-files'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    } catch {
      setMsg('Delete failed')
    } finally {
      setDeleting(false)
    }
  }

  const totalSize = data?.items?.reduce((acc: number, f: any) => acc + (f.size_bytes ?? 0), 0) ?? 0
  const fmt = (b: number) => b >= 1e9 ? `${(b / 1e9).toFixed(2)} GB` : `${(b / 1e6).toFixed(1)} MB`

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2 mb-1">
          <Disc size={22} className="text-orange-400" /> ISO Files
        </h1>
        <p className="text-gray-400 text-sm">
          {data?.total ?? '…'} ISO files · {fmt(totalSize)} total
        </p>
      </div>

      <div className="flex gap-2 mb-4">
        <button onClick={handleDelete} disabled={deleting || !data?.items?.length}
          className="flex items-center gap-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white text-sm px-3 py-1.5 rounded-md">
          <Trash2 size={14} />
          {selected.size > 0 ? `Delete ${selected.size} selected` : `Delete All ${data?.total ?? ''} ISO Files`}
        </button>
        {msg && <span className="text-sm text-green-400 py-1.5">{msg}</span>}
      </div>

      <div className="bg-[#1a1d27] border border-[#2a2d3a] rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading…</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-[#2a2d3a] bg-[#13151f]">
              <tr>
                <th className="px-3 py-2 w-8">
                  <input type="checkbox"
                    checked={selected.size === (data?.items?.length ?? 0) && (data?.items?.length ?? 0) > 0}
                    onChange={e => setSelected(e.target.checked ? new Set(data.items.map((f: any) => f.id)) : new Set())}
                    className="accent-red-500"
                  />
                </th>
                <th className="px-3 py-2 text-left text-xs text-gray-400 uppercase">File</th>
                <th className="px-3 py-2 text-left text-xs text-gray-400 uppercase">Size</th>
                <th className="px-3 py-2 text-left text-xs text-gray-400 uppercase">Folder</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2a2d3a]">
              {data?.items?.map((f: any) => (
                <tr key={f.id} className={selected.has(f.id) ? 'bg-red-900/20' : 'hover:bg-white/3'}>
                  <td className="px-3 py-2.5">
                    <input type="checkbox" checked={selected.has(f.id)} onChange={() => toggle(f.id)} className="accent-red-500" />
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs text-gray-200">{f.filename}</td>
                  <td className="px-3 py-2.5 text-orange-400 font-medium whitespace-nowrap">{f.size}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-500 truncate max-w-xs">{f.path}</td>
                </tr>
              ))}
              {!data?.items?.length && (
                <tr><td colSpan={4} className="px-3 py-8 text-center text-gray-500">No ISO files found</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
