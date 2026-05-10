import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getFolder, bulkDelete, setBaseline, searchSubtitles } from '../api/client'
import ScoreBadge from '../components/ScoreBadge'
import { ArrowLeft, Trash2, BookMarked, Captions } from 'lucide-react'

export default function FolderDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const [msg, setMsg] = useState('')

  const { data: folder, isLoading } = useQuery({
    queryKey: ['folder', id],
    queryFn: () => getFolder(Number(id)),
  })

  if (isLoading) return <div className="p-8 text-gray-400">Loading…</div>
  if (!folder) return <div className="p-8 text-gray-400">Not found</div>

  const videoFiles = folder.files?.filter((f: any) => !f.is_iso) ?? []
  const otherFiles = folder.files?.filter((f: any) => f.is_iso) ?? []
  const allFiles = folder.files ?? []

  const toggle = (id: number) => {
    setSelected(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  const handleDelete = async () => {
    if (!selected.size) return
    setDeleting(true)
    try {
      const res = await bulkDelete([...selected])
      setMsg(`Deleted ${res.deleted.length} file(s)${res.errors.length ? `, ${res.errors.length} error(s)` : ''}`)
      setSelected(new Set())
      qc.invalidateQueries({ queryKey: ['folder', id] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    } catch (e: any) {
      const detail = e?.response?.data?.detail || e?.message || 'Unknown error'
      setMsg(`Delete failed: ${detail}`)
    } finally {
      setDeleting(false)
    }
  }

  const handleBaseline = async () => {
    await setBaseline(Number(id))
    setMsg('Baseline set')
    qc.invalidateQueries({ queryKey: ['folder', id] })
  }

  const handleSearchSubs = async () => {
    try {
      const res = await searchSubtitles([Number(id)])
      const r = res.results?.[0]
      setMsg(r ? `Bazarr: ${r.msg}` : 'Subtitle search triggered')
    } catch {
      setMsg('Bazarr not configured — add it in Settings')
    }
  }

  const matchColor: Record<string, string> = {
    good: 'text-green-400',
    acceptable: 'text-yellow-400',
    mismatch: 'text-red-400',
    unknown: 'text-gray-500',
  }

  return (
    <div className="p-6 max-w-5xl">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-gray-400 hover:text-gray-200 text-sm mb-4">
        <ArrowLeft size={14} /> Back
      </button>

      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-white">{folder.name}</h1>
          <p className="text-xs text-gray-500 mt-0.5">{folder.path}</p>
          {folder.tmdb_title && !folder.radarr_movie_id && (
            <p className="text-sm text-gray-400 mt-1">
              TMDB: {folder.tmdb_title} ({folder.tmdb_year})
              {folder.tmdb_runtime_minutes && <span className="ml-2">· {folder.tmdb_runtime_minutes} min expected</span>}
            </p>
          )}
          {folder.radarr_movie_id && (
            <p className="text-sm text-gray-400 mt-1 flex items-center gap-2">
              <span className="text-yellow-400 font-medium">Radarr</span>
              {folder.tmdb_title && <span>{folder.tmdb_title} ({folder.tmdb_year})</span>}
              {folder.tmdb_runtime_minutes && <span>· {folder.tmdb_runtime_minutes} min expected</span>}
              {folder.radarr_has_file === false && (
                <span className="text-red-400 font-medium">· Radarr says no file on disk</span>
              )}
            </p>
          )}
          {folder.sonarr_series_id && (
            <p className="text-sm text-gray-400 mt-1 flex items-center gap-2">
              <span className="text-blue-400 font-medium">Sonarr</span>
              {folder.sonarr_season_number != null && <span>Season {folder.sonarr_season_number}</span>}
              {folder.sonarr_expected_episodes != null && (
                <span className={
                  folder.sonarr_actual_episodes < folder.sonarr_expected_episodes
                    ? 'text-red-400 font-medium'
                    : 'text-green-400'
                }>
                  {folder.sonarr_actual_episodes ?? '?'}/{folder.sonarr_expected_episodes} episodes
                </span>
              )}
            </p>
          )}
        </div>
        <ScoreBadge label={folder.score_label} score={folder.score} />
      </div>

      {/* Score reasons */}
      {folder.score_reasons?.length > 0 && (
        <div className="bg-[#1a1d27] border border-[#2a2d3a] rounded-xl p-4 mb-4">
          <p className="text-xs font-medium text-gray-400 uppercase mb-2">Score Breakdown</p>
          <ul className="space-y-1">
            {folder.score_reasons.map((r: string, i: number) => (
              <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                <span className="text-yellow-400 mt-0.5">·</span>{r}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 mb-4">
        {selected.size > 0 && (
          <button onClick={handleDelete} disabled={deleting}
            className="flex items-center gap-1.5 bg-red-600 hover:bg-red-500 text-white text-sm px-3 py-1.5 rounded-md disabled:opacity-50">
            <Trash2 size={14} /> Delete {selected.size} file(s)
          </button>
        )}
        {folder.missing_subtitles && (
          <button onClick={handleSearchSubs}
            className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-500 text-white text-sm px-3 py-1.5 rounded-md">
            <Captions size={14} /> Search Subtitles (Bazarr)
          </button>
        )}
        <button onClick={handleBaseline}
          className="flex items-center gap-1.5 bg-[#1a1d27] hover:bg-[#22263a] border border-[#2a2d3a] text-sm px-3 py-1.5 rounded-md text-gray-300">
          <BookMarked size={14} /> Set Baseline
        </button>
        {msg && <span className="text-sm text-green-400 py-1.5">{msg}</span>}
      </div>

      {/* Files table */}
      <div className="bg-[#1a1d27] border border-[#2a2d3a] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-[#2a2d3a] bg-[#13151f]">
            <tr>
              <th className="px-3 py-2 w-8">
                <input type="checkbox"
                  checked={selected.size === allFiles.length && allFiles.length > 0}
                  onChange={e => setSelected(e.target.checked ? new Set(allFiles.map((f: any) => f.id)) : new Set())}
                  className="accent-blue-500"
                />
              </th>
              <th className="px-3 py-2 text-left text-xs text-gray-400 uppercase">File</th>
              <th className="px-3 py-2 text-left text-xs text-gray-400 uppercase">Size</th>
              <th className="px-3 py-2 text-left text-xs text-gray-400 uppercase">Quality</th>
              <th className="px-3 py-2 text-left text-xs text-gray-400 uppercase">Duration</th>
              <th className="px-3 py-2 text-left text-xs text-gray-400 uppercase">Codec</th>
              <th className="px-3 py-2 text-left text-xs text-gray-400 uppercase">Runtime</th>
              <th className="px-3 py-2 text-left text-xs text-gray-400 uppercase">Subtitles</th>
              <th className="px-3 py-2 text-left text-xs text-gray-400 uppercase">Type</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2a2d3a]">
            {allFiles.map((f: any) => (
              <tr key={f.id} className={selected.has(f.id) ? 'bg-blue-900/20' : 'hover:bg-white/3'}>
                <td className="px-3 py-2.5">
                  <input type="checkbox" checked={selected.has(f.id)} onChange={() => toggle(f.id)} className="accent-blue-500" />
                </td>
                <td className="px-3 py-2.5">
                  <div className="font-mono text-xs text-gray-200 break-all">{f.filename}</div>
                </td>
                <td className="px-3 py-2.5 text-gray-300 whitespace-nowrap">{f.size}</td>
                <td className="px-3 py-2.5">
                  <span className={`text-xs font-medium ${f.is_4k ? 'text-cyan-400' : f.quality_label === '1080p' ? 'text-green-400' : 'text-yellow-400'}`}>
                    {f.quality_label ?? '—'}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-gray-400 whitespace-nowrap">{f.duration_label}</td>
                <td className="px-3 py-2.5 text-gray-500 text-xs">{f.video_codec ?? '—'}</td>
                <td className="px-3 py-2.5">
                  <span className={`text-xs ${matchColor[f.runtime_match ?? 'unknown']}`}>
                    {f.runtime_match ?? '—'}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  {f.is_iso ? null : f.has_subtitles === true ? (
                    <span className="text-xs text-green-400" title={f.subtitle_languages?.join(', ')}>
                      ✓ {f.subtitle_languages?.join(', ') || 'found'}
                    </span>
                  ) : f.has_subtitles === false ? (
                    <span className="text-xs text-red-400">✗ missing</span>
                  ) : (
                    <span className="text-xs text-gray-600">—</span>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  {f.is_iso ? <span className="text-xs bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded">ISO</span>
                    : <span className="text-xs text-gray-600">{f.extension}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
