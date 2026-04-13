import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronRight, Droplets, Flame, GlassWater, Plus, Search, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { v4 as uuid } from 'uuid'
import { MacroDonut } from '../components/charts/MacroDonut'
import PageHeader from '../components/layout/PageHeader'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'
import Modal from '../components/ui/Modal'
import ProgressRing from '../components/ui/ProgressRing'
import Select from '../components/ui/Select'
import { FOOD_CATEGORIES, FOOD_DATABASE, calcMacros, type FoodCategory, type FoodItem } from '../data/foodDatabase'
import { db, getSettings } from '../db'
import type { MealLog, MealType, WaterLog } from '../db/types'
import { useTodayMeals } from '../hooks/useTodayMeals'
import { useTodayWater } from '../hooks/useTodayWater'
import { formatWater, pct, totalCalories, totalMacros, totalWater } from '../utils/calculations'
import { getTodayString } from '../utils/dateHelpers'

// ── Water presets: glass-based + ml ──────────────────────────────────────────
const WATER_PRESETS = [
  { label: '½ glass', amount: 125 },
  { label: '1 glass', amount: 250 },
  { label: '500ml', amount: 500 },
  { label: '1L', amount: 1000 },
]

const MEAL_TYPES: { value: MealType; label: string }[] = [
  { value: 'breakfast', label: '🌅 Breakfast' },
  { value: 'lunch', label: '☀️ Lunch' },
  { value: 'dinner', label: '🌙 Dinner' },
  { value: 'snack', label: '🍎 Snack' },
  { value: 'pre_workout', label: '💪 Pre-Workout' },
  { value: 'post_workout', label: '🔥 Post-Workout' },
]

const MEAL_EMOJIS: Record<MealType, string> = {
  breakfast: '🌅', lunch: '☀️', dinner: '🌙', snack: '🍎', pre_workout: '💪', post_workout: '🔥',
}

type LogMode = 'food' | 'manual'

interface MealFormState {
  name: string
  calories: string
  protein: string
  carbs: string
  fat: string
  mealType: MealType
}

const EMPTY_FORM: MealFormState = {
  name: '', calories: '', protein: '', carbs: '', fat: '', mealType: 'snack',
}

export default function Nutrition() {
  const waterLog = useTodayWater()
  const meals = useTodayMeals()
  const settings = useLiveQuery(() => getSettings())

  // ── Water state ────────────────────────────────────────────────────────
  const [customWater, setCustomWater] = useState('')

  // ── Meal modal state ──────────────────────────────────────────────────
  const [showMealModal, setShowMealModal] = useState(false)
  const [logMode, setLogMode] = useState<LogMode>('food')
  const [mealType, setMealType] = useState<MealType>('snack')

  // Food picker state
  const [foodSearch, setFoodSearch] = useState('')
  const [foodCategory, setFoodCategory] = useState<FoodCategory | 'all'>('all')
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null)
  const [quantity, setQuantity] = useState('')
  const [customServing, setCustomServing] = useState(false)

  // Manual entry state
  const [manualForm, setManualForm] = useState<MealFormState>(EMPTY_FORM)

  // ── Computed ──────────────────────────────────────────────────────────
  const waterGoal = settings?.waterGoal ?? waterLog?.goal ?? 3000
  const waterTotal = totalWater(waterLog?.entries ?? [])
  const waterPct = pct(waterTotal, waterGoal)

  const calorieTotal = totalCalories(meals)
  const calorieGoal = settings?.calorieGoal ?? 2000
  const caloriePct = pct(calorieTotal, calorieGoal)
  const macros = totalMacros(meals)

  // Filtered food list
  const filteredFoods = useMemo(() => {
    return FOOD_DATABASE.filter((f) => {
      const matchCat = foodCategory === 'all' || f.category === foodCategory
      const matchSearch = !foodSearch || f.name.toLowerCase().includes(foodSearch.toLowerCase())
      return matchCat && matchSearch
    })
  }, [foodSearch, foodCategory])

  // Auto-calc preview for selected food + quantity
  const preview = useMemo(() => {
    if (!selectedFood || !quantity) return null
    const q = parseFloat(quantity)
    if (!q || q <= 0) return null
    return calcMacros(selectedFood, q)
  }, [selectedFood, quantity])

  // ── Handlers ──────────────────────────────────────────────────────────
  const addWater = async (amount: number) => {
    if (amount <= 0) return
    const entry = { amount, time: new Date().toISOString() }
    if (waterLog) {
      await db.waterLogs.update(waterLog.id, { entries: [...waterLog.entries, entry] })
    } else {
      const log: WaterLog = {
        id: uuid(), date: getTodayString(),
        entries: [entry], goal: settings?.waterGoal ?? 3000,
      }
      await db.waterLogs.put(log)
    }
  }

  const removeWaterEntry = async (idx: number) => {
    if (!waterLog) return
    await db.waterLogs.update(waterLog.id, {
      entries: waterLog.entries.filter((_, i) => i !== idx),
    })
  }

  const handleSelectFood = (food: FoodItem) => {
    setSelectedFood(food)
    // Default to first serving size
    setQuantity(String(food.servings[0].amount))
    setCustomServing(false)
  }

  const handleAddFoodMeal = async () => {
    if (!selectedFood || !preview) return
    const meal: MealLog = {
      id: uuid(),
      date: getTodayString(),
      mealType,
      name: `${selectedFood.name} (${quantity}${selectedFood.unit})`,
      calories: preview.calories,
      protein: preview.protein,
      carbs: preview.carbs,
      fat: preview.fat,
      createdAt: new Date().toISOString(),
    }
    await db.mealLogs.put(meal)
    resetModal()
  }

  const handleAddManualMeal = async () => {
    const meal: MealLog = {
      id: uuid(),
      date: getTodayString(),
      mealType: manualForm.mealType,
      name: manualForm.name.trim() || 'Meal',
      calories: parseInt(manualForm.calories) || 0,
      protein: parseFloat(manualForm.protein) || 0,
      carbs: parseFloat(manualForm.carbs) || 0,
      fat: parseFloat(manualForm.fat) || 0,
      createdAt: new Date().toISOString(),
    }
    await db.mealLogs.put(meal)
    resetModal()
  }

  const resetModal = () => {
    setShowMealModal(false)
    setSelectedFood(null)
    setQuantity('')
    setFoodSearch('')
    setFoodCategory('all')
    setManualForm(EMPTY_FORM)
    setLogMode('food')
  }

  const deleteMeal = async (id: string) => {
    await db.mealLogs.delete(id)
  }

  return (
    <div className="pb-32">
      <PageHeader title="Nutrition" subtitle="Water & Diet" />

      <div className="px-4 space-y-5">
        {/* ── Water Section ───────────────────────────────────────────── */}
        <section>
          <p className="text-xs font-semibold text-[#555555] uppercase tracking-wider mb-3 flex items-center gap-2">
            <Droplets size={12} className="text-blue-400" /> Water Intake
          </p>
          <Card border>
            {/* Ring + stats row */}
            <div className="flex items-center gap-5 mb-4">
              <ProgressRing
                value={waterPct}
                size={96}
                strokeWidth={9}
                color="#60A5FA"
                label={formatWater(waterTotal)}
                sublabel={`of ${formatWater(waterGoal)}`}
              />
              <div className="flex-1">
                <p className="text-sm font-bold text-white mb-0.5">{waterPct}% of daily goal</p>
                <p className="text-xs text-[#555555]">{formatWater(waterGoal - waterTotal)} remaining</p>
              </div>
            </div>

            {/* Quick-add presets: full width */}
            <div className="grid grid-cols-2 gap-1.5 mb-2">
              {WATER_PRESETS.map(({ label, amount }) => (
                <button
                  key={label}
                  className="flex items-center justify-center gap-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-xs font-bold py-2 rounded-xl transition-all"
                  onClick={() => addWater(amount)}
                >
                  <GlassWater size={11} className="text-blue-400" />
                  +{label}
                </button>
              ))}
            </div>

            {/* Custom ml input */}
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Custom ml"
                className="flex-1 bg-[#0D0D0D] border border-[#2A2A2A] rounded-xl px-3 py-1.5 text-xs text-white placeholder:text-[#444444] outline-none focus:border-blue-400"
                value={customWater}
                onChange={(e) => setCustomWater(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { addWater(parseInt(customWater) || 0); setCustomWater('') }
                }}
              />
              <button
                className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-xs font-bold px-3 py-1.5 rounded-xl transition-all"
                onClick={() => { addWater(parseInt(customWater) || 0); setCustomWater('') }}
              >
                Add
              </button>
            </div>

            {/* Today's entries */}
            {waterLog && waterLog.entries.length > 0 && (
              <div className="mt-4 border-t border-[#2A2A2A] pt-3">
                <p className="text-[10px] text-[#555555] uppercase tracking-wider mb-2">Today's Log</p>
                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {waterLog.entries.map((entry, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <GlassWater size={11} className="text-blue-400/60" />
                        <span className="text-sm text-white">{formatWater(entry.amount)}</span>
                        <span className="text-xs text-[#555555]">
                          {new Date(entry.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <button className="text-[#FF4757]/50 hover:text-[#FF4757] transition-colors p-1" onClick={() => removeWaterEntry(i)}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </section>

        {/* ── Calories Section ────────────────────────────────────────── */}
        <section>
          <p className="text-xs font-semibold text-[#555555] uppercase tracking-wider mb-3 flex items-center gap-2">
            <Flame size={12} className="text-[#00FF87]" /> Calories & Macros
          </p>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <Card border>
              <p className="text-xs text-[#666666] mb-1">Calories</p>
              <p className="text-2xl font-black text-white">{calorieTotal}</p>
              <p className="text-xs text-[#555555]">of {calorieGoal} kcal</p>
              <div className="mt-2 h-1.5 bg-[#2A2A2A] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#00FF87] rounded-full transition-all duration-500"
                  style={{ width: `${caloriePct}%` }}
                />
              </div>
            </Card>

            <Card border className="flex items-center justify-center">
              {macros.protein + macros.carbs + macros.fat > 0 ? (
                <MacroDonut protein={macros.protein} carbs={macros.carbs} fat={macros.fat} size={80} />
              ) : (
                <div className="text-center">
                  <p className="text-xs text-[#666666] mb-1">Macros</p>
                  <p className="text-xs text-[#444444]">Log food to see</p>
                </div>
              )}
            </Card>
          </div>

          {macros.protein + macros.carbs + macros.fat > 0 && (
            <Card border className="mb-3">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-lg font-black text-[#00FF87]">{macros.protein.toFixed(0)}g</p>
                  <p className="text-xs text-[#666666]">Protein</p>
                </div>
                <div>
                  <p className="text-lg font-black text-[#FF6B35]">{macros.carbs.toFixed(0)}g</p>
                  <p className="text-xs text-[#666666]">Carbs</p>
                </div>
                <div>
                  <p className="text-lg font-black text-[#FF4757]">{macros.fat.toFixed(0)}g</p>
                  <p className="text-xs text-[#666666]">Fat</p>
                </div>
              </div>
            </Card>
          )}

          {/* Meal list */}
          <div className="space-y-2 mb-3">
            {meals.map((meal) => (
              <Card key={meal.id} border padding="sm">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{MEAL_EMOJIS[meal.mealType]}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{meal.name}</p>
                    <p className="text-xs text-[#555555]">
                      {meal.calories} kcal · P:{meal.protein}g C:{meal.carbs}g F:{meal.fat}g
                    </p>
                  </div>
                  <button
                    className="text-[#FF4757]/50 hover:text-[#FF4757] transition-colors flex-shrink-0 p-1"
                    onClick={() => deleteMeal(meal.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </Card>
            ))}
          </div>

          <Button fullWidth variant="outline" icon={<Plus size={16} />} onClick={() => setShowMealModal(true)}>
            Log Food / Meal
          </Button>
        </section>
      </div>

      {/* ── Meal Modal ──────────────────────────────────────────────────── */}
      <Modal isOpen={showMealModal} onClose={resetModal} title="Log Food" fullHeight>
        <div className="space-y-4">
          {/* Mode toggle */}
          <div className="flex bg-[#0D0D0D] rounded-xl p-1">
            {(['food', 'manual'] as LogMode[]).map((mode) => (
              <button
                key={mode}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                  logMode === mode ? 'bg-[#1A1A1A] text-white shadow' : 'text-[#555555]'
                }`}
                onClick={() => setLogMode(mode)}
              >
                {mode === 'food' ? '🍽️ Food Database' : '✏️ Manual Entry'}
              </button>
            ))}
          </div>

          {/* Meal type (shared) */}
          <Select
            label="Meal Type"
            options={MEAL_TYPES}
            value={logMode === 'food' ? mealType : manualForm.mealType}
            onChange={(e) => {
              const v = e.target.value as MealType
              if (logMode === 'food') setMealType(v)
              else setManualForm((f) => ({ ...f, mealType: v }))
            }}
          />

          {/* ── Food database mode ──────────────────────────────────── */}
          {logMode === 'food' && (
            <>
              {!selectedFood ? (
                <>
                  {/* Search */}
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555555]" />
                    <input
                      type="text"
                      placeholder="Search rice, paneer, chicken…"
                      className="w-full bg-[#0D0D0D] border border-[#2A2A2A] rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-[#444444] outline-none focus:border-[#00FF87]"
                      value={foodSearch}
                      onChange={(e) => setFoodSearch(e.target.value)}
                      autoFocus
                    />
                  </div>

                  {/* Category chips */}
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {FOOD_CATEGORIES.map((cat) => (
                      <button
                        key={cat.id}
                        className={`flex-shrink-0 flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full transition-all font-medium ${
                          foodCategory === cat.id
                            ? 'bg-[#00FF87] text-[#0D0D0D]'
                            : 'bg-[#2A2A2A] text-[#A0A0A0]'
                        }`}
                        onClick={() => setFoodCategory(cat.id)}
                      >
                        <span>{cat.emoji}</span>
                        <span>{cat.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Food list */}
                  <div className="space-y-1.5">
                    {filteredFoods.map((food) => (
                      <button
                        key={food.id}
                        className="w-full flex items-center justify-between p-3 bg-[#0D0D0D] hover:bg-[#111111] rounded-xl transition-all text-left"
                        onClick={() => handleSelectFood(food)}
                      >
                        <div>
                          <p className="text-sm font-semibold text-white">{food.name}</p>
                          <p className="text-xs text-[#555555]">
                            per 100{food.unit} · {food.calories} kcal · P {food.protein}g · C {food.carbs}g · F {food.fat}g
                          </p>
                        </div>
                        <ChevronRight size={14} className="text-[#555555] flex-shrink-0 ml-2" />
                      </button>
                    ))}
                    {filteredFoods.length === 0 && (
                      <div className="py-8 text-center">
                        <p className="text-[#555555] text-sm">No food found</p>
                        <button
                          className="text-xs text-[#00FF87] mt-2"
                          onClick={() => setLogMode('manual')}
                        >
                          Enter manually instead →
                        </button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                /* ── Food selected: pick quantity ──────────────────── */
                <div className="space-y-4">
                  {/* Back + food name */}
                  <div className="flex items-center gap-3">
                    <button
                      className="text-xs text-[#666666] hover:text-white transition-colors"
                      onClick={() => setSelectedFood(null)}
                    >
                      ← Back
                    </button>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-white">{selectedFood.name}</p>
                      <p className="text-xs text-[#555555]">
                        {selectedFood.calories} kcal per 100{selectedFood.unit}
                      </p>
                    </div>
                  </div>

                  {/* Serving size chips */}
                  <div>
                    <p className="text-xs text-[#555555] uppercase tracking-wider mb-2">Quick Serving</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedFood.servings.map((s) => (
                        <button
                          key={s.label}
                          className={`text-xs px-3 py-1.5 rounded-full transition-all font-medium ${
                            !customServing && quantity === String(s.amount)
                              ? 'bg-[#00FF87] text-[#0D0D0D]'
                              : 'bg-[#2A2A2A] text-[#A0A0A0]'
                          }`}
                          onClick={() => { setQuantity(String(s.amount)); setCustomServing(false) }}
                        >
                          {s.label}
                        </button>
                      ))}
                      <button
                        className={`text-xs px-3 py-1.5 rounded-full transition-all font-medium ${
                          customServing ? 'bg-[#00FF87] text-[#0D0D0D]' : 'bg-[#2A2A2A] text-[#A0A0A0]'
                        }`}
                        onClick={() => { setCustomServing(true); setQuantity('') }}
                      >
                        Custom
                      </button>
                    </div>
                  </div>

                  {/* Custom quantity input */}
                  {customServing && (
                    <Input
                      label={`Quantity (${selectedFood.unit})`}
                      type="number"
                      placeholder="Enter amount"
                      suffix={selectedFood.unit}
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      autoFocus
                    />
                  )}

                  {/* Live preview */}
                  {preview && (
                    <div className="bg-[#0D0D0D] rounded-xl p-4">
                      <p className="text-xs text-[#555555] uppercase tracking-wider mb-3">Nutritional Info</p>
                      <div className="grid grid-cols-4 gap-2 text-center">
                        <div>
                          <p className="text-lg font-black text-white">{preview.calories}</p>
                          <p className="text-[10px] text-[#555555]">kcal</p>
                        </div>
                        <div>
                          <p className="text-lg font-black text-[#00FF87]">{preview.protein}g</p>
                          <p className="text-[10px] text-[#555555]">protein</p>
                        </div>
                        <div>
                          <p className="text-lg font-black text-[#FF6B35]">{preview.carbs}g</p>
                          <p className="text-[10px] text-[#555555]">carbs</p>
                        </div>
                        <div>
                          <p className="text-lg font-black text-[#FF4757]">{preview.fat}g</p>
                          <p className="text-[10px] text-[#555555]">fat</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <Button
                    fullWidth
                    size="lg"
                    onClick={handleAddFoodMeal}
                    disabled={!preview}
                  >
                    Add to Log
                  </Button>
                </div>
              )}
            </>
          )}

          {/* ── Manual entry mode ──────────────────────────────────── */}
          {logMode === 'manual' && (
            <div className="space-y-4">
              <Input
                label="Food / Meal Name"
                placeholder="e.g. Home-cooked dal, Protein shake"
                value={manualForm.name}
                onChange={(e) => setManualForm((f) => ({ ...f, name: e.target.value }))}
                autoFocus
              />
              <Input
                label="Calories"
                type="number"
                suffix="kcal"
                placeholder="0"
                value={manualForm.calories}
                onChange={(e) => setManualForm((f) => ({ ...f, calories: e.target.value }))}
              />
              <div className="grid grid-cols-3 gap-3">
                <Input
                  label="Protein"
                  type="number"
                  suffix="g"
                  placeholder="0"
                  value={manualForm.protein}
                  onChange={(e) => setManualForm((f) => ({ ...f, protein: e.target.value }))}
                />
                <Input
                  label="Carbs"
                  type="number"
                  suffix="g"
                  placeholder="0"
                  value={manualForm.carbs}
                  onChange={(e) => setManualForm((f) => ({ ...f, carbs: e.target.value }))}
                />
                <Input
                  label="Fat"
                  type="number"
                  suffix="g"
                  placeholder="0"
                  value={manualForm.fat}
                  onChange={(e) => setManualForm((f) => ({ ...f, fat: e.target.value }))}
                />
              </div>
              <Button
                fullWidth
                size="lg"
                onClick={handleAddManualMeal}
                disabled={!manualForm.calories}
              >
                Add Meal
              </Button>
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
