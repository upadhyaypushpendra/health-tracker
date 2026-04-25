import { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Activity, Download, Upload, Trash2, Bell, ChevronRight, User, ClipboardList, Dumbbell, Bot, Eye, EyeOff, LayoutGrid } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { Dialog } from '@capacitor/dialog'
import { v4 as uuid } from 'uuid'
import PageHeader from '../components/layout/PageHeader'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Toggle from '../components/ui/Toggle'
import Input from '../components/ui/Input'
import { db, getSettings, updateSettings } from '../db'
import { exportData, importData } from '../utils/exportImport'
import { useNotifications } from '../hooks/useNotifications'
import { getGeminiApiKey, setGeminiApiKey } from '../services/gemini'
import { getTodayString } from '../utils/dateHelpers'
import { calculateBMI } from '../utils/calculations'
import { healthSync } from '../services/healthSyncPlugin'
import { runHCBackfill } from '../utils/hcBackfill'

export default function Settings() {
  const navigate = useNavigate()
  const settings = useLiveQuery(() => getSettings())
  const { requestPermission, checkPermission, initReminders, stopAllReminders } = useNotifications()
  const [notifGranted, setNotifGranted] = useState(false)
  const [hcGranted, setHcGranted] = useState(false)
  const [hcError, setHcError] = useState<string | null>(null)
  const isAndroid = Capacitor.getPlatform() === 'android'

  useEffect(() => {
    checkPermission().then(setNotifGranted)
  }, [])

  useEffect(() => {
    if (isAndroid) healthSync.checkHealthPermissions().then(setHcGranted)
  }, [isAndroid])

  const [name, setName] = useState('')
  const [gender, setGender] = useState<'male' | 'female' | 'other' | null>(null)
  const [height, setHeight] = useState('')
  const [currentWeight, setCurrentWeight] = useState('')
  const [waterGoal, setWaterGoal] = useState('')
  const [stepGoal, setStepGoal] = useState('')
  const [saving, setSaving] = useState(false)
  const [importStatus, setImportStatus] = useState<string | null>(null)
  const [geminiKey, setGeminiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [keySaved, setKeySaved] = useState(false)
  const [keyError, setKeyError] = useState(false)

  const handleSaveGeminiKey = async () => {
    try {
      await setGeminiApiKey(geminiKey)
      setKeySaved(true)
      setTimeout(() => setKeySaved(false), 2000)
    } catch {
      setKeyError(true)
      setTimeout(() => setKeyError(false), 3000)
    }
  }

  useEffect(() => {
    getGeminiApiKey().then(setGeminiKey)
  }, [])

  useEffect(() => {
    if (settings) {
      setName(settings.name ?? '')
      setGender(settings.gender ?? null)
      setHeight(settings.height ? String(settings.height) : '')
      setCurrentWeight(settings.currentWeight ? String(settings.currentWeight) : '')
      setWaterGoal(String(settings.waterGoal))
      setStepGoal(String(settings.stepGoal))
    }
  }, [settings])

  const handleSave = async () => {
    setSaving(true)
    const parsed = currentWeight ? parseFloat(currentWeight) : null
    await updateSettings({
      name: name.trim(),
      gender,
      height: height ? parseFloat(height) : null,
      currentWeight: parsed,
      waterGoal: parseInt(waterGoal) || 3000,
      stepGoal: parseInt(stepGoal) || 10000,
    })
    // Sync step goal to widget
    await healthSync.syncStepData(0, parseInt(stepGoal) || 10000)
    // Auto-log a body metric entry whenever weight is saved
    if (parsed !== null) {
      const h = height ? parseFloat(height) : (settings?.height ?? null)
      const today = getTodayString()
      const existing = await db.bodyMetrics.where('date').equals(today).first()
      const bmi = parsed && h ? calculateBMI(parsed, h) : null
      if (existing) {
        await db.bodyMetrics.update(existing.id, { weight: parsed, height: h, bmi })
      } else {
        await db.bodyMetrics.put({ id: uuid(), date: today, weight: parsed, height: h, bodyFat: null, bmi })
      }
    }
    setSaving(false)
  }

  const handleNotificationToggle = async (enabled: boolean) => {
    if (enabled && !notifGranted) {
      const granted = await requestPermission()
      if (!granted) return
      setNotifGranted(true)
    }
    await updateSettings({
      notificationsEnabled: enabled,
      workoutReminderTime: enabled ? (settings?.workoutReminderTime ?? '08:00') : null,
    })
    if (enabled) {
      await initReminders()
    } else {
      await stopAllReminders()
    }
  }

  const handleHCConnect = async () => {
    setHcError(null)
    const available = await healthSync.isHealthConnectAvailable()
    if (!available) {
      setHcError('Health Connect is not available on this device. Install it from the Play Store.')
      return
    }
    const granted = await healthSync.requestHealthPermissions()
    setHcGranted(granted)
    if (granted && !settings?.hcBackfillDone) {
      runHCBackfill()
    }
  }

  const handleWorkoutReminderTimeChange = async (time: string) => {
    await updateSettings({ workoutReminderTime: time })
    await initReminders()
  }

  const handleExport = async () => {
    try {
      await exportData()
    } catch (e) {
      setImportStatus(`Error: ${e instanceof Error ? e.message : 'Export failed'}`)
      setTimeout(() => setImportStatus(null), 4000)
    }
  }

  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      setImportStatus('Importing…')
      const result = await importData(file)
      setImportStatus(result.success ? 'Import successful!' : `Error: ${result.error}`)
      setTimeout(() => setImportStatus(null), 3000)
    }
    input.click()
  }

  const handleClearData = async () => {
    const { value } = await Dialog.confirm({
      title: 'Clear Activity Logs',
      message: 'Delete all workout logs, water logs, meal logs, and body metrics? Plans and settings will be kept.',
      okButtonTitle: 'Delete',
      cancelButtonTitle: 'Cancel',
    })
    if (!value) return
    await Promise.all([
      db.workoutLogs.clear(),
      db.waterLogs.clear(),
      db.mealLogs.clear(),
      db.bodyMetrics.clear(),
    ])
  }

  const handleResetAll = async () => {
    const { value } = await Dialog.confirm({
      title: 'Reset All Data',
      message: 'Delete ALL data including plans and settings? This cannot be undone.',
      okButtonTitle: 'Reset',
      cancelButtonTitle: 'Cancel',
    })
    if (!value) return
    await Promise.all([
      db.plans.clear(),
      db.workoutLogs.clear(),
      db.waterLogs.clear(),
      db.mealLogs.clear(),
      db.bodyMetrics.clear(),
    ])
    await updateSettings({ onboardingCompleted: false, activePlanId: null })
    navigate('/onboarding', { replace: true })
  }

  return (
    <div className="pb-32">
      <PageHeader title="Settings" subtitle="Preferences & data" back/>

      <div className="px-4 space-y-5">
        {/* Profile */}
        <section>
          <SectionHeader icon={<User size={12} />} label="Profile" />
          <Card border>
            <div className="space-y-4">
              <Input label="Name" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
              <div>
                <p className="text-xs font-medium text-[#A0A0A0] mb-2">Gender</p>
                <div className="grid grid-cols-3 gap-2">
                  {(['male', 'female', 'other'] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGender(g)}
                      className={`py-2 rounded-xl text-sm font-medium transition-colors ${
                        gender === g
                          ? 'bg-[#00FF87] text-[#0D0D0D]'
                          : 'bg-[#1A1A1A] text-[#555555] border border-[#2A2A2A]'
                      }`}
                    >
                      {g.charAt(0).toUpperCase() + g.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Height" type="number" suffix="cm" value={height} onChange={(e) => setHeight(e.target.value)} />
                <Input label="Current Weight" type="number" suffix="kg" value={currentWeight} onChange={(e) => setCurrentWeight(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Water Goal" type="number" suffix="ml" value={waterGoal} onChange={(e) => setWaterGoal(e.target.value)} />
                <Input label="Step Goal" type="number" suffix="steps" value={stepGoal} onChange={(e) => setStepGoal(e.target.value)} />
              </div>
              <Button fullWidth size="sm" onClick={handleSave} disabled={saving}>
                {saving ? 'Saved!' : 'Save Changes'}
              </Button>
            </div>
          </Card>
        </section>

        {/* Quick links */}
        <section>
          <SectionHeader icon={<ClipboardList size={12} />} label="Plans & Library" />
          <div className="space-y-2">
            <SettingsRow
              icon={<ClipboardList size={16} className="text-[#00FF87]" />}
              label="Manage Plans"
              sub="Create, edit, activate plans"
              onClick={() => navigate('/plan')}
            />
            <SettingsRow
              icon={<Dumbbell size={16} className="text-[#FF6B35]" />}
              label="Exercise Library"
              sub="Browse 50+ exercises"
              onClick={() => navigate('/library')}
            />
            <SettingsRow
              icon={<LayoutGrid size={16} className="text-[#3B82F6]" />}
              label="Widgets"
              sub="Add widgets to your home screen"
              onClick={() => navigate('/widgets')}
            />
          </div>
        </section>

        {/* Health Connect */}
        {isAndroid && (
          <section>
            <SectionHeader icon={<Activity size={12} />} label="Health Connect" />
            <Card border padding="sm">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-[#0D0D0D] rounded-xl flex items-center justify-center flex-shrink-0">
                  <Activity size={16} className={hcGranted ? 'text-[#00FF87]' : 'text-[#555555]'} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">Sync to Health Connect</p>
                  <p className="text-xs text-[#555555]">
                    {hcGranted ? 'Connected — meals, water & workouts syncing' : 'Sync meals, water and workouts to Health Connect'}
                  </p>
                </div>
                {!hcGranted && (
                  <button
                    onClick={handleHCConnect}
                    className="text-xs font-semibold text-[#00FF87] bg-[#00FF87]/10 border border-[#00FF87]/20 rounded-lg px-3 py-1.5 active:opacity-70 transition-opacity"
                  >
                    Connect
                  </button>
                )}
                {hcGranted && (
                  <span className="text-xs font-medium text-[#00FF87]">Connected</span>
                )}
              </div>
            </Card>
            {hcError && (
              <p className="text-xs text-[#FF4757] px-1 mt-1">{hcError}</p>
            )}
          </section>
        )}

        {/* Notifications */}
        <section>
          <SectionHeader icon={<Bell size={12} />} label="Notifications" />
          <Card border>
            <div className="space-y-3">
              <Toggle
                checked={settings?.notificationsEnabled ?? false}
                onChange={handleNotificationToggle}
                label="Enable reminders"
              />
              {settings?.notificationsEnabled && (
                <div className="flex items-center justify-between pl-1">
                  <span className="text-sm text-[#555555]">Workout reminder time</span>
                  <input
                    type="time"
                    value={settings.workoutReminderTime ?? '08:00'}
                    onChange={(e) => handleWorkoutReminderTimeChange(e.target.value)}
                    className="bg-[#0D0D0D] border border-[#2A2A2A] rounded-lg px-3 py-1.5 text-sm text-white"
                  />
                </div>
              )}
              {settings?.notificationsEnabled && (
                <p className="text-xs text-[#444] pl-1">Water reminders adapt automatically to your daily goal.</p>
              )}
            </div>
          </Card>
        </section>

        {/* AI */}
        <section>
          <SectionHeader icon={<Bot size={12} />} label="AI Coach" />
          <Card border>
            <p className="text-xs text-[#555555] mb-3 leading-relaxed">
              Bring your own Gemini API key to use the AI Coach without rate limits. Leave blank to use the shared key.
              Generate your API key at <a href="https://aistudio.google.com/api-keys" target="_blank" className="text-[#00FF87]">Google AI Studio</a>.
              Use <b>Create API Key</b> button to create a new key and copy the generated key here. 
              <i><b>Your key is stored securely on your device and never shared with anyone else.</b></i>
            </p>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={geminiKey}
                onChange={e => setGeminiKey(e.target.value)}
                placeholder="AIza…"
                className="w-full bg-[#0D0D0D] border border-[#2A2A2A] rounded-xl px-3 py-2.5 pr-10 text-sm text-white placeholder-[#444] focus:outline-none focus:border-[#00FF87]/40"
              />
              <button
                type="button"
                onClick={() => setShowKey(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555555]"
              >
                {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <Button fullWidth size="sm" className="mt-3" onClick={handleSaveGeminiKey}>
              {keySaved ? 'Saved!' : keyError ? 'Save failed — try again' : 'Save API Key'}
            </Button>
          </Card>
        </section>

        {/* Data */}
        <section>
          <SectionHeader icon={<Download size={12} />} label="Data" />
          <div className="space-y-2">
            <Card border padding="sm">
              <div className="flex gap-3">
                <Button fullWidth variant="outline" size="sm" icon={<Download size={14} />} onClick={handleExport}>
                  Export Backup
                </Button>
                <Button fullWidth variant="outline" size="sm" icon={<Upload size={14} />} onClick={handleImport}>
                  Import Backup
                </Button>
              </div>
              {importStatus && (
                <p className={`text-xs mt-2 text-center ${importStatus.startsWith('Error') ? 'text-[#FF4757]' : 'text-[#00FF87]'}`}>
                  {importStatus}
                </p>
              )}
            </Card>
          </div>
        </section>

        {/* Danger zone */}
        <section>
          <SectionHeader icon={<Trash2 size={12} />} label="Danger Zone" />
          <div className="space-y-2">
            <Button fullWidth variant="danger" size="sm" icon={<Trash2 size={14} />} onClick={handleClearData}>
              Clear Activity Logs
            </Button>
            <Button fullWidth variant="danger" size="sm" icon={<Trash2 size={14} />} onClick={handleResetAll}>
              Reset All Data
            </Button>
          </div>
        </section>

        <p className="text-center text-xs text-[#333333] pb-4">Body Sync · All data stored locally on your device</p>
      </div>
    </div>
  )
}

function SectionHeader({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <p className="text-xs font-semibold text-[#555555] uppercase tracking-wider mb-2 flex items-center gap-1.5">
      <span className="text-[#555555]">{icon}</span>
      {label}
    </p>
  )
}

function SettingsRow({ icon, label, sub, onClick }: { icon: React.ReactNode; label: string; sub?: string; onClick?: () => void }) {
  return (
    <Card border padding="sm" hover onClick={onClick}>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-[#0D0D0D] rounded-xl flex items-center justify-center flex-shrink-0">
          {icon}
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-white">{label}</p>
          {sub && <p className="text-xs text-[#555555]">{sub}</p>}
        </div>
        <ChevronRight size={14} className="text-[#555555]" />
      </div>
    </Card>
  )
}
