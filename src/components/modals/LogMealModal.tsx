import { useMemo, useState } from 'react'
import { Loader2, Plus, Search, Sparkles } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { v4 as uuid } from 'uuid'
import Modal from '../ui/Modal'
import Input from '../ui/Input'
import Select from '../ui/Select'
import Button from '../ui/Button'
import { db } from '../../db'
import type { CustomFood, MealLog, MealType } from '../../db/types'
import { getTodayString } from '../../utils/dateHelpers'
import { chat } from '../../services/gemini'
import { extractJson } from '../../utils/extractJson'
import { MEAL_EMOJIS, MEAL_TYPES } from '../../data/constants'

export { MEAL_EMOJIS, MEAL_TYPES }

interface AiForm {
  name: string
  calories: string
  protein: string
  carbs: string
  fat: string
}

export default function LogMealModal({ isOpen, onClose, defaultMealType }: { isOpen: boolean; onClose: () => void; defaultMealType?: MealType }) {
  const customFoods = useLiveQuery(() => db.customFoods.orderBy('createdAt').reverse().toArray(), []) ?? []

  const [mealType, setMealType] = useState<MealType>(defaultMealType ?? 'snack')
  const [foodSearch, setFoodSearch] = useState('')

  const [aiQuery, setAiQuery] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiForm, setAiForm] = useState<AiForm | null>(null)

  const filteredCustomFoods = useMemo(() => {
    if (!foodSearch) return customFoods
    return customFoods.filter((f) => f.name.toLowerCase().includes(foodSearch.toLowerCase()))
  }, [customFoods, foodSearch])

  const resetModal = () => {
    setFoodSearch('')
    setAiQuery('')
    setAiError(null)
    setAiForm(null)
    onClose()
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

  const handleAddAiMeal = async () => {
    if (!aiForm) return
    const name = aiForm.name.trim() || 'Meal'
    const calories = parseInt(aiForm.calories) || 0
    const protein = parseFloat(aiForm.protein) || 0
    const carbs = parseFloat(aiForm.carbs) || 0
    const fat = parseFloat(aiForm.fat) || 0
    const now = new Date().toISOString()

    await db.mealLogs.put({
      id: uuid(),
      date: getTodayString(),
      mealType,
      name, calories, protein, carbs, fat,
      createdAt: now,
    })
    const existing = await db.customFoods.where('name').equals(name).first()
    if (!existing) {
      await db.customFoods.put({ id: uuid(), name, calories, protein, carbs, fat, createdAt: now })
    }
    resetModal()
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
      setAiForm({
        name: String(data.name ?? aiQuery.trim()),
        calories: String(Math.round(Number(data.calories) || 0)),
        protein: String(Math.round((Number(data.protein) || 0) * 10) / 10),
        carbs: String(Math.round((Number(data.carbs) || 0) * 10) / 10),
        fat: String(Math.round((Number(data.fat) || 0) * 10) / 10),
      })
    } catch (err) {
      console.error('[AILog]', err)
      setAiError("Couldn't estimate nutrition. Try being more specific.")
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={resetModal} title="Log Meal" fullHeight>
      <div className="space-y-5">

        {/* Meal Type */}
        <Select
          label="Meal Type"
          options={MEAL_TYPES}
          value={mealType}
          onChange={(e) => setMealType(e.target.value as MealType)}
        />

        {/* ── AI Log ── */}
        <div className="space-y-3">
           <div className="bg-[#00FF87]/5 border border-[#00FF87]/15 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles size={13} className="text-[#00FF87]" />
                <p className="text-xs font-semibold text-[#00FF87]">AI Nutrition Estimator</p>
              </div>
              <p className="text-xs text-white/40 leading-snug">
                Describe what you ate in plain language. AI will estimate the nutrition and pre-fill the form for review.
              </p>
            </div>

          <textarea
            rows={2}
            value={aiQuery}
            onChange={(e) => setAiQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAILog() } }}
            placeholder="e.g. 2 scrambled eggs with 2 brown bread toast and butter"
            disabled={aiLoading}
            className="w-full bg-[#0D0D0D] border border-[#2A2A2A] rounded-xl px-3 py-2.5 text-sm text-white
                       placeholder:text-[#444] resize-none focus:outline-none focus:border-[#00FF87]/50
                       disabled:opacity-50 leading-relaxed"
          />

          <Button fullWidth size="lg" onClick={handleAILog} disabled={aiQuery.trim().length < 5 || aiLoading}>
            {aiLoading
              ? <><Loader2 size={15} className="animate-spin" /> Estimating…</>
              : <><Sparkles size={15} /> {aiForm ? 'Re-estimate' : 'Estimate Nutrition'}</>
            }
          </Button>

          {aiError && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2 text-xs text-red-400">
              {aiError}
            </div>
          )}

          {aiForm && !aiLoading && (
            <div className="space-y-3 pt-1">
              <div className="flex items-center gap-2">
                <Sparkles size={11} className="text-[#00FF87]/60" />
                <p className="text-[10px] text-[#00FF87]/60 uppercase tracking-wider">Review & edit before adding</p>
              </div>
              <Input
                label="Food / Meal Name"
                value={aiForm.name}
                onChange={(e) => setAiForm((f) => f && ({ ...f, name: e.target.value }))}
              />
              <Input
                label="Calories"
                type="number"
                suffix="kcal"
                placeholder="0"
                value={aiForm.calories}
                onChange={(e) => setAiForm((f) => f && ({ ...f, calories: e.target.value }))}
              />
              <div className="grid grid-cols-3 gap-3">
                <Input
                  label="Protein"
                  type="number"
                  suffix="g"
                  placeholder="0"
                  value={aiForm.protein}
                  onChange={(e) => setAiForm((f) => f && ({ ...f, protein: e.target.value }))}
                />
                <Input
                  label="Carbs"
                  type="number"
                  suffix="g"
                  placeholder="0"
                  value={aiForm.carbs}
                  onChange={(e) => setAiForm((f) => f && ({ ...f, carbs: e.target.value }))}
                />
                <Input
                  label="Fat"
                  type="number"
                  suffix="g"
                  placeholder="0"
                  value={aiForm.fat}
                  onChange={(e) => setAiForm((f) => f && ({ ...f, fat: e.target.value }))}
                />
              </div>
              <Button fullWidth size="lg" onClick={handleAddAiMeal} disabled={!aiForm.calories}>
                <Plus size={15} /> Add Meal
              </Button>
            </div>
          )}
        </div>

        {/* ── My Foods ── */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-[#555555] uppercase tracking-wider">My Foods</p>

          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555555]" />
            <input
              type="text"
              placeholder="Search your foods…"
              className="w-full bg-[#0D0D0D] border border-[#2A2A2A] rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-[#444444] outline-none focus:border-[#00FF87]"
              value={foodSearch}
              onChange={(e) => setFoodSearch(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            {filteredCustomFoods.length > 0 ? (
              filteredCustomFoods.map((food) => (
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
              ))
            ) : (
              <p className="text-xs text-[#444] text-center py-4">
                {foodSearch ? 'No matches found' : 'No foods saved yet — log with AI above to build your list'}
              </p>
            )}
          </div>
        </div>

      </div>
    </Modal>
  )
}
