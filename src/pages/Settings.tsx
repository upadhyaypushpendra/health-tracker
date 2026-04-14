import { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Download, Upload, Trash2, Bell, ChevronRight, User, ClipboardList, Dumbbell } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../components/layout/PageHeader'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Toggle from '../components/ui/Toggle'
import Input from '../components/ui/Input'
import { db, getSettings, updateSettings } from '../db'
import { exportData, importData } from '../utils/exportImport'
import { useNotifications } from '../hooks/useNotifications'
import { isNative } from '../utils/platform'

export default function Settings() {
  const navigate = useNavigate()
  const settings = useLiveQuery(() => getSettings())
  const { requestPermission, isSupported, isGranted, scheduleWorkoutReminder, cancelWorkoutReminder, startWaterReminders, stopWaterReminders } = useNotifications()

  const [name, setName] = useState('')
  const [height, setHeight] = useState('')
  const [goalWeight, setGoalWeight] = useState('')
  const [waterGoal, setWaterGoal] = useState('')
  const [calorieGoal, setCalorieGoal] = useState('')
  const [saving, setSaving] = useState(false)
  const [importStatus, setImportStatus] = useState<string | null>(null)

  useEffect(() => {
    if (settings) {
      setName(settings.name ?? '')
      setHeight(settings.height ? String(settings.height) : '')
      setGoalWeight(settings.goalWeight ? String(settings.goalWeight) : '')
      setWaterGoal(String(settings.waterGoal))
      setCalorieGoal(String(settings.calorieGoal))
    }
  }, [settings])

  const handleSave = async () => {
    setSaving(true)
    await updateSettings({
      name: name.trim(),
      height: height ? parseFloat(height) : null,
      goalWeight: goalWeight ? parseFloat(goalWeight) : null,
      waterGoal: parseInt(waterGoal) || 3000,
      calorieGoal: parseInt(calorieGoal) || 2000,
    })
    setSaving(false)
  }

  const handleNotificationToggle = async (enabled: boolean) => {
    if (enabled && !isGranted) {
      const granted = await requestPermission()
      if (!granted) return
    }
    await updateSettings({ notificationsEnabled: enabled })
    // Cancel all reminders when notifications are disabled
    if (!enabled) {
      await cancelWorkoutReminder()
      await stopWaterReminders()
      await updateSettings({ workoutReminderTime: null, waterReminderInterval: null })
    }
  }

  const handleWorkoutReminderToggle = async (enabled: boolean) => {
    if (enabled) {
      const time = settings?.workoutReminderTime ?? '08:00'
      await updateSettings({ workoutReminderTime: time })
      await scheduleWorkoutReminder(time)
    } else {
      await cancelWorkoutReminder()
      await updateSettings({ workoutReminderTime: null })
    }
  }

  const handleWorkoutReminderTimeChange = async (time: string) => {
    await updateSettings({ workoutReminderTime: time })
    await scheduleWorkoutReminder(time)
  }

  const handleWaterReminderToggle = async (enabled: boolean) => {
    if (enabled) {
      const interval = settings?.waterReminderInterval ?? 60
      await updateSettings({ waterReminderInterval: interval })
      await startWaterReminders(interval)
    } else {
      await stopWaterReminders()
      await updateSettings({ waterReminderInterval: null })
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
    const confirmed = window.confirm(
      'Delete all workout logs, water logs, meal logs, and body metrics? Plans and settings will be kept.'
    )
    if (!confirmed) return
    await Promise.all([
      db.workoutLogs.clear(),
      db.waterLogs.clear(),
      db.mealLogs.clear(),
      db.bodyMetrics.clear(),
    ])
  }

  const handleResetAll = async () => {
    const confirmed = window.confirm(
      'Delete ALL data including plans and settings? This cannot be undone.'
    )
    if (!confirmed) return
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
      <PageHeader title="Settings" subtitle="Preferences & data" />

      <div className="px-4 space-y-5">
        {/* Profile */}
        <section>
          <SectionHeader icon={<User size={12} />} label="Profile" />
          <Card border>
            <div className="space-y-4">
              <Input label="Name" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Height" type="number" suffix="cm" value={height} onChange={(e) => setHeight(e.target.value)} />
                <Input label="Goal Weight" type="number" suffix="kg" value={goalWeight} onChange={(e) => setGoalWeight(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Water Goal" type="number" suffix="ml" value={waterGoal} onChange={(e) => setWaterGoal(e.target.value)} />
                <Input label="Calorie Goal" type="number" suffix="kcal" value={calorieGoal} onChange={(e) => setCalorieGoal(e.target.value)} />
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
          </div>
        </section>

        {/* Notifications */}
        <section>
          <SectionHeader icon={<Bell size={12} />} label="Notifications" />
          {(isSupported || isNative) ? (
            <Card border>
              <div className="space-y-3">
                <Toggle
                  checked={settings?.notificationsEnabled ?? false}
                  onChange={handleNotificationToggle}
                  label={isGranted ? 'Enable reminders' : 'Enable notifications (requires permission)'}
                />
                {settings?.notificationsEnabled && isGranted && (
                  <>
                    <Toggle
                      checked={settings?.workoutReminderTime !== null && settings?.workoutReminderTime !== undefined}
                      onChange={handleWorkoutReminderToggle}
                      label="Daily workout reminder"
                    />
                    {settings?.workoutReminderTime && (
                      <div className="flex items-center justify-between pl-1">
                        <span className="text-sm text-[#555555]">Reminder time</span>
                        <input
                          type="time"
                          value={settings.workoutReminderTime}
                          onChange={(e) => handleWorkoutReminderTimeChange(e.target.value)}
                          className="bg-[#0D0D0D] border border-[#2A2A2A] rounded-lg px-3 py-1.5 text-sm text-white"
                        />
                      </div>
                    )}
                    <Toggle
                      checked={settings?.waterReminderInterval !== null && settings?.waterReminderInterval !== undefined}
                      onChange={handleWaterReminderToggle}
                      label="Drink water reminder (every hour)"
                    />
                  </>
                )}
              </div>
            </Card>
          ) : (
            <Card border>
              <p className="text-sm text-[#555555]">
                Notifications are not supported in this browser. Install the app for full notification support.
              </p>
            </Card>
          )}
        </section>

        {/* Data */}
        <section>
          <SectionHeader icon={<Download size={12} />} label="Data" />
          <div className="space-y-2">
            <Card border padding="sm">
              <div className="flex gap-3">
                <Button fullWidth variant="outline" size="sm" icon={<Download size={14} />} onClick={exportData}>
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
