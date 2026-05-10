import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getFolders, bulkDelete } from '../api/client'
import ScoreBadge from '../components/ScoreBadge'
import { ChevronRight, Search, Filter, Trash2 } from 'lucide-react'

export default function Library() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [scoreLabel, setScoreLabel] = useState('')
  const [folderType, setFolderType] = useState('')
  const [hasDuplicates, setHasDuplicates] = useState('')
  const [hasIso, setHasIso] = useState('')
  const [has4k, setHas4k] = useState('')
  const [baselineChanged, setBaselineChanged] = useState('')
  const [missingSubs, setMissingSubs] = useState('')
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState('score')
  const [order, setOrder] = useState('asc')

  const params: Record<string, unknown> = { page, per_page: 50, sort, order }
  if (search) params.search = search
  if (scoreLabel) params.score_label = scoreLabel
  if (folderType) params.folder_type = folderType
  if (hasDuplicates) params.has_duplicates = hasDuplicates === 'yes'
  if (hasIso) params.has_iso = hasIso === 'yes'
  if (has4k) params.has_4k = has4k === 'yes'
  if (baselineChanged) params.baseline_changed = baselineChanged === 'yes'
  if (missingSubs) params.missing_subtitles = missingSubs === 'yes'

  const { data, isLoading } = useQuery({
    queryKey: ['folders', params],
    queryFn: () => getFolders(params),
  })

  const totalPages = data ? Math.ceil(data.total / 50) : 1

  const SortHeader = ({ col, label }: { col: string; label: string }) => (
    <th
      className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase cursor-pointer hover:text-gray-200 select-none"
      onClick={() => { setSort(col); setOrder(sort === col && order === 'asc' ? 'desc' : 'asc') }}
    >
      {label}{sort === col ? (order === 'asc' ? ' ↑' : ' ↓') : ''}
    </th>
  )

  return (
    <div className="p-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-white mb-1">Library</h1>
        <p className="text-gray-400 text-sm">{data?.total ?? '…'} folders</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search folders…"
            className="bg-[#1a1d27] border border-[#2a2d3a] rounded-md pl-8 pr-3 py-1.5 text-sm text-gray-200 w-56 focus:outline-none focus:border-blue-500"
          />
        </div>
        <Select value={scoreLabel} onChange={v => { setScoreLabel(v); setPage(1) }} label="Score">
          <option value="">All Scores</option>
          <option value="good">Good</option>
          <option value="questionable">Questionable</option>
          <option value="needs_review">Needs Review</option>
        </Select>
        <Select value={folderType} onChange={v => { setFolderType(v); setPage(1) }} label="Type">
          <option value="">All Types</option>
          <option value="movie">Movie</option>
          <option value="tv_season">TV Season</option>
          <option value="unknown">Unknown</option>
        </Select>
        <Select value={hasDuplicates} onChange={v => { setHasDuplicates(v); setPage(1) }} label="Dupes">
          <option value="">All</option>
          <option value="yes">Has Duplicates</option>
          <option value="no">No Duplicates</option>
        </Select>
        <Select value={hasIso} onChange={v => { setHasIso(v); setPage(1) }} label="ISO">
          <option value="">All</option>
          <option value="yes">Has ISO</option>
        </Select>
        <Select value={has4k} onChange={v => { setHas4k(v); setPage(1) }} label="4K">
          <option value="">All</option>
          <option value="yes">Has 4K</option>
        </Select>
        <Select value={baselineChanged} onChange={v => { setBaselineChanged(v); setPage(1) }} label="Baseline">
          <option value="">All</option>
          <option value="yes">Changed</option>
        </Select>
        <Select value={missingSubs} onChange={v => { setMissingSubs(v); setPage(1) }} label="Subtitles">
          <option value="">All</option>
          <option value="yes">Missing Subs</option>
        </Select>
      </div>

      <div className="bg-[#1a1d27] border border-[#2a2d3a] rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading…</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-[#2a2d3a] bg-[#13151f]">
              <tr>
                <SortHeader col="name" label="Name" />
                <SortHeader col="folder_type" label="Type" />
                <SortHeader col="score" label="Score" />
                <SortHeader col="video_count" label="Files" />
                <SortHeader col="total_size_bytes" label="Size" />
                <th className="px-3 py-2 text-xs text-gray-400 uppercase text-left">Flags</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2a2d3a]">
              {data?.items?.map((f: any) => (
                <tr key={f.id} className="hover:bg-white/3 cursor-pointer" onClick={() => navigate(`/library/${f.id}`)}>
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-gray-200 truncate max-w-xs" title={f.path}>{f.name}</div>
                    <div className="text-xs text-gray-500 truncate max-w-xs">{f.path}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="text-xs text-gray-400">{f.folder_type}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <ScoreBadge label={f.score_label} score={f.score} />
                  </td>
                  <td className="px-3 py-2.5 text-gray-300">{f.video_count}</td>
                  <td className="px-3 py-2.5 text-gray-300">{f.total_size}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex gap-1 flex-wrap">
                      {f.has_duplicates && <Tag color="yellow">Dupes</Tag>}
                      {f.has_iso && <Tag color="orange">ISO</Tag>}
                      {f.has_4k && <Tag color="cyan">4K</Tag>}
                      {f.baseline_changed && <Tag color="red">Changed</Tag>}
                      {f.sonarr_expected_episodes != null && (
                        <Tag color={f.sonarr_actual_episodes < f.sonarr_expected_episodes ? 'red' : 'green'}>
                          {f.sonarr_actual_episodes ?? '?'}/{f.sonarr_expected_episodes} ep
                        </Tag>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <ChevronRight size={14} className="text-gray-600" />
                  </td>
                </tr>
              ))}
              {data?.items?.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-500">No folders found</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
            className="px-3 py-1 text-sm bg-[#1a1d27] border border-[#2a2d3a] rounded disabled:opacity-40 hover:border-gray-500">← Prev</button>
          <span className="px-3 py-1 text-sm text-gray-400">{page} / {totalPages}</span>
          <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
            className="px-3 py-1 text-sm bg-[#1a1d27] border border-[#2a2d3a] rounded disabled:opacity-40 hover:border-gray-500">Next →</button>
        </div>
      )}
    </div>
  )
}

function Select({ value, onChange, label, children }: {
  value: string; onChange: (v: string) => void; label: string; children: React.ReactNode
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="bg-[#1a1d27] border border-[#2a2d3a] rounded-md px-2 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-blue-500"
    >
      {children}
    </select>
  )
}

function Tag({ color, children }: { color: string; children: React.ReactNode }) {
  const colors: Record<string, string> = {
    yellow: 'bg-yellow-500/20 text-yellow-400',
    orange: 'bg-orange-500/20 text-orange-400',
    cyan: 'bg-cyan-500/20 text-cyan-400',
    red: 'bg-red-500/20 text-red-400',
  }
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded ${colors[color] ?? 'bg-gray-500/20 text-gray-400'}`}>
      {children}
    </span>
  )
}
