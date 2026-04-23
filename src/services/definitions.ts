import type { WaterLog } from '../db/types'

export type PermissionState = 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale'

export interface ActivityRecognitionPermission {
  activityRecognition: PermissionState
}

export interface HealthSyncPlugin {
  syncWaterData(options: { waterToday?: WaterLog; goal: number }): Promise<void>
  syncMealData(options: { mealCount: number; calories: number; goal: number }): Promise<void>
  syncWorkoutData(options: { exists: boolean; completed?: boolean }): Promise<void>
  syncStepData(options: { steps: number; goal: number }): Promise<void>
  logWaterFromWidget(amount: number): Promise<void>
  checkPermissions(): Promise<ActivityRecognitionPermission>
  requestPermissions(): Promise<ActivityRecognitionPermission>
  getStepsFromSensor(): Promise<{ steps: number }>
  pinWidget(): Promise<void>
}
