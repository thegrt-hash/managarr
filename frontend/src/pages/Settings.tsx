import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getSettings, saveSettings } from '../api/client'
import { Settings as SettingsIcon, Save, Eye, EyeOff, Film, Tv, Music, BookOpen, SkipForward } from 'lucide-react'

const EMPTY_FORM = {
  movies_path: '',
  tv_path: '',
  music_path: '',
  audiobooks_path: '',
  tmdb_api_key: '',
  sonarr_url: '', sonarr_api_key: '',
  radarr_url: '', radarr_api_key: '',
  bazarr_url: '', bazarr_api_key: '',
  subtitle_languages: 'en',
}

export default function Settings() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['settings'], queryFn: getSettings })

  const [form, setForm] = useState(EMPTY_FORM)
  const [msg, setMsg] = useState('')
  const [wizardStep, setWizardStep] = useState(0)
  const isWizard = !data?.wizard_complete

  useEffect(() => {
    if (data) setForm({
      movies_path: data.movies_path ?? '',
      tv_path: data.tv_path ?? '',
      music_path: data.music_path ?? '',
      audiobooks_path: data.audiobooks_path ?? '',
      tmdb_api_key: data.tmdb_api_key ?? '',
      sonarr_url: data.sonarr_url ?? '',
      sonarr_api_key: data.sonarr_api_key ?? '',
      radarr_url: data.radarr_url ?? '',
      radarr_api_key: data.radarr_api_key ?? '',
      bazarr_url: data.bazarr_url ?? '',
      bazarr_api_key: data.bazarr_api_key ?? '',
      subtitle_languages: data.subtitle_languages ?? 'en',
    })
  }, [data])

  const save = async () => {
    await saveSettings(form)
    setMsg('Settings saved')
    qc.invalidateQueries({ queryKey: ['settings'] })
    setTimeout(() => setMsg(''), 3000)
  }

  const finishWizard = async () => {
    await saveSettings({ ...form, wizard_complete: 'true' })
    qc.invalidateQueries({ queryKey: ['settings'] })
  }

  if (isLoading) return <div className="p-8 text-gray-400">Loading…</div>

  if (isWizard) {
    return <Wizard form={form} setForm={setForm} step={wizardStep} setStep={setWizardStep} onFinish={finishWizard} />
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2 mb-1">
          <SettingsIcon size={22} className="text-gray-400" /> Settings
        </h1>
      </div>

      <div className="space-y-5">
        <Section title="Media Libraries">
          <p className="text-xs text-gray-500 mb-3">
            Set a path for each pool you have. Leave blank to skip that type.
          </p>
          <Field label="Movies Path" icon={<Film size={13} className="text-blue-400" />}>
            <input value={form.movies_path} onChange={e => setForm(f => ({ ...f, movies_path: e.target.value }))}
              placeholder="/media/Movie" className={inputCls} />
          </Field>
          <Field label="TV Shows Path" icon={<Tv size={13} className="text-purple-400" />}>
            <input value={form.tv_path} onChange={e => setForm(f => ({ ...f, tv_path: e.target.value }))}
              placeholder="/media/Shows" className={inputCls} />
          </Field>
          <Field label="Music Path" icon={<Music size={13} className="text-green-400" />}>
            <input value={form.music_path} onChange={e => setForm(f => ({ ...f, music_path: e.target.value }))}
              placeholder="/media/Music" className={inputCls} />
          </Field>
          <Field label="Audiobooks Path" icon={<BookOpen size={13} className="text-yellow-400" />}>
            <input value={form.audiobooks_path} onChange={e => setForm(f => ({ ...f, audiobooks_path: e.target.value }))}
              placeholder="/media/Audiobooks" className={inputCls} />
          </Field>
        </Section>

        <Section title="TMDB (Movie & TV metadata)">
          <p className="text-xs text-gray-500 mb-3">
            Free API key at themoviedb.org → Settings → API. Used for runtime validation.
          </p>
          <Field label="TMDB API Key">
            <SecretInput value={form.tmdb_api_key}
              onChange={v => setForm(f => ({ ...f, tmdb_api_key: v }))}
              placeholder="Your TMDB v3 API key" />
          </Field>
        </Section>

        <Section title="Sonarr">
          <Field label="Sonarr URL">
            <input value={form.sonarr_url} onChange={e => setForm(f => ({ ...f, sonarr_url: e.target.value }))}
              placeholder="http://192.168.1.x:8989" className={inputCls} />
          </Field>
          <Field label="Sonarr API Key">
            <SecretInput value={form.sonarr_api_key}
              onChange={v => setForm(f => ({ ...f, sonarr_api_key: v }))}
              placeholder="From Sonarr → Settings → General" />
          </Field>
        </Section>

        <Section title="Radarr">
          <Field label="Radarr URL">
            <input value={form.radarr_url} onChange={e => setForm(f => ({ ...f, radarr_url: e.target.value }))}
              placeholder="http://192.168.1.x:7878" className={inputCls} />
          </Field>
          <Field label="Radarr API Key">
            <SecretInput value={form.radarr_api_key}
              onChange={v => setForm(f => ({ ...f, radarr_api_key: v }))}
              placeholder="From Radarr → Settings → General" />
          </Field>
        </Section>

        <Section title="Bazarr (Subtitle Management)">
          <p className="text-xs text-gray-500 mb-3">
            Connects Managarr to Bazarr for subtitle searching.
          </p>
          <Field label="Bazarr URL">
            <input value={form.bazarr_url} onChange={e => setForm(f => ({ ...f, bazarr_url: e.target.value }))}
              placeholder="http://192.168.1.x:6767" className={inputCls} />
          </Field>
          <Field label="Bazarr API Key">
            <SecretInput value={form.bazarr_api_key}
              onChange={v => setForm(f => ({ ...f, bazarr_api_key: v }))}
              placeholder="From Bazarr → Settings → General" />
          </Field>
          <Field label="Subtitle Languages (comma-separated)">
            <input value={form.subtitle_languages} onChange={e => setForm(f => ({ ...f, subtitle_languages: e.target.value }))}
              placeholder="en,fr,de" className={inputCls} />
          </Field>
        </Section>

        <div className="flex items-center gap-3">
          <button onClick={save}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-md text-sm">
            <Save size={14} /> Save Settings
          </button>
          {msg && <span className="text-green-400 text-sm">{msg}</span>}
        </div>
      </div>
    </div>
  )
}

// ── Wizard ────────────────────────────────────────────────────────────────────

const POOL_STEPS = [
  {
    key: 'movies_path' as const,
    title: 'Movies',
    desc: 'Where are your movie files stored? This folder will be scanned recursively for video files.',
    placeholder: '/media/Movie',
    icon: Film,
    iconColor: 'text-blue-400',
  },
  {
    key: 'tv_path' as const,
    title: 'TV Shows',
    desc: 'Where are your TV show files stored? Managarr looks for Season folders and validates episode counts via Sonarr.',
    placeholder: '/media/Shows',
    icon: Tv,
    iconColor: 'text-purple-400',
  },
  {
    key: 'music_path' as const,
    title: 'Music',
    desc: 'Where is your music library? Managarr will detect audio files and flag unexpected formats.',
    placeholder: '/media/Music',
    icon: Music,
    iconColor: 'text-green-400',
  },
  {
    key: 'audiobooks_path' as const,
    title: 'Audiobooks',
    desc: 'Where are your audiobooks stored?',
    placeholder: '/media/Audiobooks',
    icon: BookOpen,
    iconColor: 'text-yellow-400',
  },
]

// Steps: 0=Welcome, 1-4=Pools, 5=TMDB, 6=Sonarr, 7=Radarr, 8=Done
const TOTAL_STEPS = 9

function Wizard({ form, setForm, step, setStep, onFinish }: {
  form: typeof EMPTY_FORM
  setForm: React.Dispatch<React.SetStateAction<typeof EMPTY_FORM>>
  step: number
  setStep: React.Dispatch<React.SetStateAction<number>>
  onFinish: () => void
}) {
  const next = () => setStep(s => s + 1)
  const back = () => setStep(s => s - 1)
  const skip = () => {
    // Clear the current pool's path before advancing
    if (step >= 1 && step <= 4) {
      const key = POOL_STEPS[step - 1].key
      setForm(f => ({ ...f, [key]: '' }))
    }
    next()
  }
  const isLast = step === TOTAL_STEPS - 1

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">📼</div>
          <h1 className="text-2xl font-bold text-white">Managarr Setup</h1>
        </div>

        <div className="bg-[#1a1d27] border border-[#2a2d3a] rounded-2xl p-8">
          {/* Progress bar */}
          <div className="flex gap-1 mb-6">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= step ? 'bg-blue-500' : 'bg-[#2a2d3a]'}`} />
            ))}
          </div>

          {step === 0 && <WelcomeStep />}
          {step >= 1 && step <= 4 && (
            <PoolStep
              pool={POOL_STEPS[step - 1]}
              value={form[POOL_STEPS[step - 1].key]}
              onChange={v => setForm(f => ({ ...f, [POOL_STEPS[step - 1].key]: v }))}
              onSkip={skip}
            />
          )}
          {step === 5 && (
            <GenericStep
              title="TMDB API Key"
              desc="Enables runtime validation — Managarr compares file durations to expected runtimes. Get a free key at themoviedb.org → Settings → API."
            >
              <Field label="TMDB API Key (optional)">
                <SecretInput value={form.tmdb_api_key}
                  onChange={v => setForm(f => ({ ...f, tmdb_api_key: v }))}
                  placeholder="Leave blank to skip" />
              </Field>
            </GenericStep>
          )}
          {step === 6 && (
            <GenericStep
              title="Sonarr (Optional)"
              desc="Connect Sonarr to cross-reference your TV library and validate episode counts."
            >
              <Field label="Sonarr URL">
                <input value={form.sonarr_url} onChange={(e: any) => setForm(f => ({ ...f, sonarr_url: e.target.value }))}
                  placeholder="http://192.168.1.x:8989" className={inputCls} />
              </Field>
              <Field label="Sonarr API Key">
                <SecretInput value={form.sonarr_api_key} onChange={v => setForm(f => ({ ...f, sonarr_api_key: v }))}
                  placeholder="From Sonarr → Settings → General" />
              </Field>
            </GenericStep>
          )}
          {step === 7 && (
            <GenericStep
              title="Radarr (Optional)"
              desc="Connect Radarr to cross-reference your movie library and pull runtime data."
            >
              <Field label="Radarr URL">
                <input value={form.radarr_url} onChange={(e: any) => setForm(f => ({ ...f, radarr_url: e.target.value }))}
                  placeholder="http://192.168.1.x:7878" className={inputCls} />
              </Field>
              <Field label="Radarr API Key">
                <SecretInput value={form.radarr_api_key} onChange={v => setForm(f => ({ ...f, radarr_api_key: v }))}
                  placeholder="From Radarr → Settings → General" />
              </Field>
            </GenericStep>
          )}
          {isLast && <DoneStep configuredPools={POOL_STEPS.filter(p => form[p.key])} />}

          {/* Navigation */}
          <div className="flex gap-3 mt-6">
            {step > 0 && (
              <button onClick={back}
                className="flex-1 bg-[#13151f] border border-[#2a2d3a] text-gray-300 py-2 rounded-lg text-sm hover:bg-white/5">
                Back
              </button>
            )}
            <button
              onClick={isLast ? onFinish : next}
              className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg text-sm font-medium"
            >
              {isLast ? 'Go to Dashboard' : step === 0 ? 'Get Started' : 'Next →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function WelcomeStep() {
  return (
    <>
      <h2 className="text-xl font-bold text-white mb-2">Welcome to Managarr</h2>
      <p className="text-gray-400 text-sm mb-4">
        Let's get your media library connected. You'll set up each of your media pools individually — skip any you don't have.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {POOL_STEPS.map(p => (
          <div key={p.key} className="flex items-center gap-2 bg-[#13151f] border border-[#2a2d3a] rounded-lg px-3 py-2">
            <p.icon size={14} className={p.iconColor} />
            <span className="text-sm text-gray-300">{p.title}</span>
          </div>
        ))}
      </div>
    </>
  )
}

function PoolStep({ pool, value, onChange, onSkip }: {
  pool: typeof POOL_STEPS[number]
  value: string
  onChange: (v: string) => void
  onSkip: () => void
}) {
  const Icon = pool.icon
  return (
    <>
      <div className="flex items-center gap-2 mb-2">
        <Icon size={20} className={pool.iconColor} />
        <h2 className="text-xl font-bold text-white">{pool.title}</h2>
      </div>
      <p className="text-gray-400 text-sm mb-6">{pool.desc}</p>
      <Field label={`${pool.title} Path`}>
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={pool.placeholder}
          className={inputCls}
          autoFocus
        />
      </Field>
      <button onClick={onSkip}
        className="mt-3 flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors">
        <SkipForward size={12} /> I don't have a {pool.title.toLowerCase()} pool — skip this
      </button>
    </>
  )
}

function GenericStep({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <>
      <h2 className="text-xl font-bold text-white mb-2">{title}</h2>
      <p className="text-gray-400 text-sm mb-6">{desc}</p>
      <div className="space-y-4">{children}</div>
    </>
  )
}

function DoneStep({ configuredPools }: { configuredPools: typeof POOL_STEPS }) {
  return (
    <>
      <h2 className="text-xl font-bold text-white mb-2">You're all set!</h2>
      <p className="text-gray-400 text-sm mb-4">
        Managarr is configured. Head to the Dashboard and click "Scan Library" to start analyzing your media.
      </p>
      {configuredPools.length > 0 && (
        <div className="bg-[#13151f] border border-[#2a2d3a] rounded-lg p-3 space-y-1.5">
          <p className="text-xs text-gray-500 uppercase mb-2">Configured pools</p>
          {configuredPools.map(p => (
            <div key={p.key} className="flex items-center gap-2">
              <p.icon size={13} className={p.iconColor} />
              <span className="text-sm text-gray-300">{p.title}</span>
            </div>
          ))}
        </div>
      )}
      {configuredPools.length === 0 && (
        <p className="text-sm text-yellow-400">No media pools configured — go to Settings to add paths before scanning.</p>
      )}
    </>
  )
}

// ── Shared components ─────────────────────────────────────────────────────────

const inputCls = 'w-full bg-[#13151f] border border-[#2a2d3a] rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#1a1d27] border border-[#2a2d3a] rounded-xl p-5">
      <h2 className="text-sm font-semibold text-gray-300 mb-4">{title}</h2>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function Field({ label, children, icon }: { label: string; children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs text-gray-400 mb-1.5">
        {icon}{label}
      </label>
      {children}
    </div>
  )
}

function SecretInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${inputCls} pr-9`}
      />
      <button onClick={() => setShow(s => !s)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
        {show ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  )
}
