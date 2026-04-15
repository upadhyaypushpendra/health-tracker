import { useEffect, useMemo, useState } from 'react'
import { ChevronRight, Loader2, Plus, Search, Sparkles } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { v4 as uuid } from 'uuid'
import Modal from '../ui/Modal'
import Input from '../ui/Input'
import Select from '../ui/Select'
import Button from '../ui/Button'
import type { FoodCategory, FoodItem } from '../../data/foodDatabase'
import { db } from '../../db'
import type { CustomFood, MealLog, MealType } from '../../db/types'
import { getTodayString } from '../../utils/dateHelpers'
import { chat } from '../../services/gemini'
import { extractJson } from '../../utils/extractJson'
import { MEAL_EMOJIS, MEAL_TYPES } from '../../data/constants'

export { MEAL_EMOJIS, MEAL_TYPES }

// Type inferred from the module itself — stays in sync automatically
type FoodDbModule = typeof import('../../data/foodDatabase')

type LogMode = 'food' | 'ai' | 'manual'

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

export default function LogMealModal({ isOpen, onClose, defaultMealType }: { isOpen: boolean; onClose: () => void; defaultMealType?: MealType }) {
  const customFoods = useLiveQuery(() => db.customFoods.orderBy('createdAt').reverse().toArray(), []) ?? []

  const [logMode, setLogMode] = useState<LogMode>('food')
  const [mealType, setMealType] = useState<MealType>(defaultMealType ?? 'snack')
  const [foodSearch, setFoodSearch] = useState('')
  const [foodCategory, setFoodCategory] = useState<FoodCategory | 'all'>('all')
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null)
  const [quantity, setQuantity] = useState('')
  const [customServing, setCustomServing] = useState(false)
  const [manualForm, setManualForm] = useState<MealFormState>(EMPTY_FORM)

  // ── AI Log state ──────────────────────────────────────────────────────────
  const [aiQuery, setAiQuery] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  // ── Lazy food database ────────────────────────────────────────────────────
  const [foodDb, setFoodDb] = useState<FoodDbModule | null>(null)
  useEffect(() => {
    if (isOpen && !foodDb) {
      import('../../data/foodDatabase').then(setFoodDb)
    }
  }, [isOpen, foodDb])

  const filteredFoods = useMemo(() => {
    if (!foodDb) return []
    return foodDb.FOOD_DATABASE.filter((f: FoodItem) => {
      const matchCat = foodCategory === 'all' || f.category === foodCategory
      const matchSearch = !foodSearch || f.name.toLowerCase().includes(foodSearch.toLowerCase())
      return matchCat && matchSearch
    })
  }, [foodDb, foodSearch, foodCategory])

  const filteredCustomFoods = useMemo(() => {
    if (!foodSearch) return customFoods
    return customFoods.filter((f) => f.name.toLowerCase().includes(foodSearch.toLowerCase()))
  }, [customFoods, foodSearch])

  const preview = useMemo(() => {
    if (!selectedFood || !quantity || !foodDb) return null
    const q = parseFloat(quantity)
    if (!q || q <= 0) return null
    return foodDb.calcMacros(selectedFood, q)
  }, [foodDb, selectedFood, quantity])

  const handleSelectFood = (food: FoodItem) => {
    setSelectedFood(food)
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

  const handleAddCustomFoodMeal = async (food: CustomFood) => {
    const meal: MealLog = {
      id: uuid(),
      date: getTodayString(),
      mealType,
      name: food.name,
      calories: food.calories,
      protein: food.protein,
      carbs: food.carbs,
      fat: food.fat,
      createdAt: new Date().toISOString(),
    }
    await db.mealLogs.put(meal)
    resetModal()
  }

  const handleAddManualMeal = async () => {
    const name = manualForm.name.trim() || 'Meal'
    const calories = parseInt(manualForm.calories) || 0
    const protein = parseFloat(manualForm.protein) || 0
    const carbs = parseFloat(manualForm.carbs) || 0
    const fat = parseFloat(manualForm.fat) || 0
    const now = new Date().toISOString()

    await db.mealLogs.put({
      id: uuid(),
      date: getTodayString(),
      mealType: manualForm.mealType,
      name, calories, protein, carbs, fat,
      createdAt: now,
    })

    const existing = await db.customFoods.where('name').equals(name).first()
    if (!existing) {
      await db.customFoods.put({ id: uuid(), name, calories, protein, carbs, fat, createdAt: now })
    }

    resetModal()
  }

  const resetModal = () => {
    setSelectedFood(null)
    setQuantity('')
    setFoodSearch('')
    setFoodCategory('all')
    setManualForm(EMPTY_FORM)
    setLogMode('food')
    setAiQuery('')
    setAiError(null)
    onClose()
  }

  const handleAILog = async () => {
    if (!aiQuery.trim() || aiLoading) return
    setAiLoading(true)
    setAiError(null)

    const prompt = [
      'Estimate the nutritional information for this meal.',
      'Return ONLY a raw JSON object — no markdown, no code blocks, no explanation.',
      '{"name":"descriptive meal name","calories":0,"protein":0,"carbs":0,"fat":0}',
      'All numbers are for the full meal as described (not per 100g). Protein/carbs/fat in grams.',
      `Meal: "${aiQuery.trim()}"`,
    ].join('\n')

    try {
      const response = await chat([{ role: 'user', content: prompt }])
      const data = extractJson(response) as Record<string, unknown>

      setManualForm({
        name: String(data.name ?? aiQuery.trim()),
        calories: String(Math.round(Number(data.calories) || 0)),
        protein: String(Math.round((Number(data.protein) || 0) * 10) / 10),
        carbs: String(Math.round((Number(data.carbs) || 0) * 10) / 10),
        fat: String(Math.round((Number(data.fat) || 0) * 10) / 10),
        mealType,
      })
      setLogMode('manual')
    } catch (err) {
      console.error('[AILog]', err)
      setAiError("Couldn't estimate nutrition. Try being more specific or enter manually.")
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={resetModal} title="Log Food" fullHeight>
      <div className="space-y-4">
        {/* Mode toggle */}
        <div className="flex bg-[#0D0D0D] rounded-xl p-1 gap-0.5">
          {([
            { key: 'food', label: '🍽️ Food DB' },
            { key: 'ai',   label: '✨ AI Log' },
            { key: 'manual', label: '✏️ Manual' },
          ] as { key: LogMode; label: string }[]).map(({ key, label }) => (
            <button
              key={key}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                logMode === key ? 'bg-[#1A1A1A] text-white shadow' : 'text-[#555555]'
              }`}
              onClick={() => setLogMode(key)}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Meal type (shared across all modes) */}
        <Select
          label="Meal Type"
          options={MEAL_TYPES}
          value={logMode === 'manual' ? manualForm.mealType : mealType}
          onChange={(e) => {
            const v = e.target.value as MealType
            if (logMode === 'manual') setManualForm((f) => ({ ...f, mealType: v }))
            else setMealType(v)
          }}
        />

        {/* ── Food database mode ── */}
        {logMode === 'food' && (
          <>
            {!selectedFood ? (
              !foodDb ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={20} className="animate-spin text-[#555]" />
                </div>
              ) : (
              <>
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

                <div className="flex gap-2 overflow-x-auto pb-1">
                  {(foodDb?.FOOD_CATEGORIES ?? []).map((cat) => (
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

                <div className="space-y-1.5">
                  {filteredCustomFoods.length > 0 && (
                    <>
                      <p className="text-xs font-semibold text-[#00FF87] uppercase tracking-wider pt-1 pb-0.5">My Foods</p>
                      {filteredCustomFoods.map((food) => (
                        <button
                          key={food.id}
                          className="w-full flex items-center justify-between p-3 bg-[#0D0D0D] hover:bg-[#111111] rounded-xl transition-all text-left"
                          onClick={() => handleAddCustomFoodMeal(food)}
                        >
                          <div>
                            <p className="text-sm font-semibold text-white">{food.name}</p>
                            <p className="text-xs text-[#555555]">
                              {food.calories} kcal · P {food.protein}g · C {food.carbs}g · F {food.fat}g
                            </p>
                          </div>
                          <Plus size={14} className="text-[#00FF87] flex-shrink-0 ml-2" />
                        </button>
                      ))}
                      {filteredFoods.length > 0 && (
                        <p className="text-xs font-semibold text-[#555555] uppercase tracking-wider pt-2 pb-0.5">Food Database</p>
                      )}
                    </>
                  )}
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
                  {filteredFoods.length === 0 && filteredCustomFoods.length === 0 && (
                    <div className="py-8 text-center">
                      <p className="text-[#555555] text-sm">No food found</p>
                      <div className="flex items-center justify-center gap-3 mt-2">
                        <button
                          className="text-xs text-[#00FF87] font-medium"
                          onClick={() => { setAiQuery(foodSearch); setLogMode('ai') }}
                        >
                          ✨ Log with AI
                        </button>
                        <span className="text-[#333] text-xs">or</span>
                        <button
                          className="text-xs text-[#555555]"
                          onClick={() => setLogMode('manual')}
                        >
                          Enter manually
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
              )
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <button
                    className="text-xs text-[#666666] hover:text-white transition-colors"
                    onClick={() => setSelectedFood(null)}
                  >
                    ← Back
                  </button>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-white">{selectedFood.name}</p>
                    <p className="text-xs text-[#555555]">{selectedFood.calories} kcal per 100{selectedFood.unit}</p>
                  </div>
                </div>

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

                <Button fullWidth size="lg" onClick={handleAddFoodMeal} disabled={!preview}>
                  Add to Log
                </Button>
              </div>
            )}
          </>
        )}

        {/* ── AI Log mode ── */}
        {logMode === 'ai' && (
          <div className="space-y-4">
            <div className="bg-[#00FF87]/5 border border-[#00FF87]/15 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles size={13} className="text-[#00FF87]" />
                <p className="text-xs font-semibold text-[#00FF87]">AI Nutrition Estimator</p>
              </div>
              <p className="text-xs text-white/40 leading-snug">
                Describe what you ate in plain language. AI will estimate the nutrition and pre-fill the form for review.
              </p>
            </div>

            <div>
              <textarea
                rows={3}
                value={aiQuery}
                onChange={(e) => setAiQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAILog() } }}
                placeholder="e.g. 2 scrambled eggs with 2 brown bread toast and butter"
                disabled={aiLoading}
                autoFocus
                className="w-full bg-[#0D0D0D] border border-[#2A2A2A] rounded-xl px-3 py-2.5 text-sm text-white
                           placeholder:text-[#444] resize-none focus:outline-none focus:border-[#00FF87]/50
                           disabled:opacity-50 leading-relaxed"
              />
            </div>

            {aiError && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5 text-xs text-red-400">
                {aiError}
              </div>
            )}

            <Button
              fullWidth
              size="lg"
              onClick={handleAILog}
              disabled={!aiQuery.trim() || aiLoading}
            >
              {aiLoading ? (
                <><Loader2 size={15} className="animate-spin" /> Estimating…</>
              ) : (
                <><Sparkles size={15} /> Estimate & Review</>
              )}
            </Button>

            <p className="text-[10px] text-[#444] text-center leading-snug">
              Values are AI estimates. Review and adjust before saving — logged meals are also saved to My Foods for instant reuse.
            </p>
          </div>
        )}

        {/* ── Manual entry mode ── */}
        {logMode === 'manual' && (
          <div className="space-y-4">
            {aiQuery && (
              <div className="flex items-center gap-2 bg-[#00FF87]/5 border border-[#00FF87]/15 rounded-xl px-3 py-2">
                <Sparkles size={12} className="text-[#00FF87] shrink-0" />
                <p className="text-xs text-[#00FF87]/80">AI-estimated values — review and adjust if needed</p>
              </div>
            )}
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
            <Button fullWidth size="lg" onClick={handleAddManualMeal} disabled={!manualForm.calories}>
              Add Meal
            </Button>
          </div>
        )}
      </div>
    </Modal>
  )
}
