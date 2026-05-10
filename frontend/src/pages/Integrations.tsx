import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { testSonarr, syncSonarr, testRadarr, syncRadarr, testBazarr, searchWantedSubtitles } from '../api/client'
import { Anchor, CheckCircle, XCircle, RefreshCw, Subtitles } from 'lucide-react'

export default function Integrations() {
  const qc = useQueryClient()
  const [sonarrStatus, setSonarrStatus] = useState<{ok?: boolean; info?: string} | null>(null)
  const [radarrStatus, setRadarrStatus] = useState<{ok?: boolean; info?: string} | null>(null)
  const [bazarrStatus, setBazarrStatus] = useState<{ok?: boolean; info?: string} | null>(null)
  const [sonarrSync, setSonarrSync] = useState<string | null>(null)
  const [radarrSync, setRadarrSync] = useState<string | null>(null)
  const [bazarrMsg, setBazarrMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState('')

  const doTest = async (service: 'sonarr' | 'radarr' | 'bazarr') => {
    setLoading(`test-${service}`)
    try {
      const fn = service === 'sonarr' ? testSonarr : service === 'radarr' ? testRadarr : testBazarr
      const res = await fn()
      if (service === 'sonarr') setSonarrStatus(res)
      else if (service === 'radarr') setRadarrStatus(res)
      else setBazarrStatus(res)
    } catch (e: any) {
      const r = { ok: false, info: e.response?.data?.detail || 'Connection failed' }
      if (service === 'sonarr') setSonarrStatus(r)
      else if (service === 'radarr') setRadarrStatus(r)
      else setBazarrStatus(r)
    } finally {
      setLoading('')
    }
  }

  const doSync = async (service: 'sonarr' | 'radarr') => {
    setLoading(`sync-${service}`)
    try {
      const fn = service === 'sonarr' ? syncSonarr : syncRadarr
      const res = await fn()
      const msg = `Synced ${res.synced} ${service === 'sonarr' ? 'series' : 'movies'}`
      service === 'sonarr' ? setSonarrSync(msg) : setRadarrSync(msg)
    } catch (e: any) {
      const msg = e.response?.data?.detail || 'Sync failed'
      service === 'sonarr' ? setSonarrSync(msg) : setRadarrSync(msg)
    } finally {
      setLoading('')
    }
  }

  const doSearchWanted = async () => {
    setLoading('bazarr-wanted')
    try {
      const res = await searchWantedSubtitles()
      setBazarrMsg(`Movies: ${res.movies.msg} · Episodes: ${res.episodes.msg}`)
    } catch (e: any) {
      setBazarrMsg(e.response?.data?.detail || 'Search failed')
    } finally {
      setLoading('')
    }
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2 mb-1">
          <Anchor size={22} className="text-blue-400" /> Integrations
        </h1>
        <p className="text-gray-400 text-sm">
          Sync with Sonarr and Radarr to cross-reference your library.
          Configure connection details in Settings first.
        </p>
      </div>

      <div className="space-y-4">
        <div className="bg-[#1a1d27] border border-[#2a2d3a] rounded-xl p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-white">Bazarr</h2>
              <p className="text-sm text-gray-400">Subtitle management — triggers searches for missing subtitles</p>
            </div>
            {bazarrStatus && (
              <div className="flex items-center gap-1.5 text-sm">
                {bazarrStatus.ok
                  ? <><CheckCircle size={16} className="text-green-400" /><span className="text-green-400">v{bazarrStatus.info}</span></>
                  : <><XCircle size={16} className="text-red-400" /><span className="text-red-400">{bazarrStatus.info}</span></>}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={() => doTest('bazarr')} disabled={loading === 'test-bazarr'}
              className="flex items-center gap-1.5 bg-[#13151f] hover:bg-white/5 border border-[#2a2d3a] text-sm px-3 py-1.5 rounded-md text-gray-300 disabled:opacity-50">
              {loading === 'test-bazarr' ? <RefreshCw size={14} className="animate-spin" /> : null}
              Test Connection
            </button>
            <button onClick={doSearchWanted} disabled={loading === 'bazarr-wanted'}
              className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-500 text-white text-sm px-3 py-1.5 rounded-md disabled:opacity-50">
              {loading === 'bazarr-wanted' ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Search All Wanted
            </button>
          </div>
          {bazarrMsg && <p className="mt-3 text-sm text-green-400">{bazarrMsg}</p>}
        </div>

        <IntegrationCard
          title="Sonarr"
          description="TV show library management"
          status={sonarrStatus}
          syncMsg={sonarrSync}
          onTest={() => doTest('sonarr')}
          onSync={() => doSync('sonarr')}
          testLoading={loading === 'test-sonarr'}
          syncLoading={loading === 'sync-sonarr'}
          color="blue"
        />
        <IntegrationCard
          title="Radarr"
          description="Movie library management"
          status={radarrStatus}
          syncMsg={radarrSync}
          onTest={() => doTest('radarr')}
          onSync={() => doSync('radarr')}
          testLoading={loading === 'test-radarr'}
          syncLoading={loading === 'sync-radarr'}
          color="yellow"
        />
      </div>
    </div>
  )
}

function IntegrationCard({ title, description, status, syncMsg, onTest, onSync, testLoading, syncLoading, color }: {
  title: string; description: string
  status: {ok?: boolean; info?: string} | null
  syncMsg: string | null
  onTest: () => void; onSync: () => void
  testLoading: boolean; syncLoading: boolean
  color: string
}) {
  const borderColor = color === 'blue' ? 'border-blue-500/30' : 'border-yellow-500/30'
  return (
    <div className={`bg-[#1a1d27] border border-[#2a2d3a] rounded-xl p-5`}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <p className="text-sm text-gray-400">{description}</p>
        </div>
        {status && (
          <div className="flex items-center gap-1.5 text-sm">
            {status.ok
              ? <><CheckCircle size={16} className="text-green-400" /><span className="text-green-400">v{status.info}</span></>
              : <><XCircle size={16} className="text-red-400" /><span className="text-red-400">{status.info}</span></>}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button onClick={onTest} disabled={testLoading}
          className="flex items-center gap-1.5 bg-[#13151f] hover:bg-white/5 border border-[#2a2d3a] text-sm px-3 py-1.5 rounded-md text-gray-300 disabled:opacity-50">
          {testLoading ? <RefreshCw size={14} className="animate-spin" /> : null}
          Test Connection
        </button>
        <button onClick={onSync} disabled={syncLoading}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm px-3 py-1.5 rounded-md disabled:opacity-50">
          {syncLoading ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Sync Now
        </button>
      </div>

      {syncMsg && <p className="mt-3 text-sm text-green-400">{syncMsg}</p>}
    </div>
  )
}
