import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Bot, Brain, Check, ChevronDown, ChevronUp,
  Loader2, RefreshCw, Send, Sparkles, Square, User, Wand2, X,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { v4 as uuid } from "uuid";
import { db } from "../db";
import type { Plan } from "../db/types";
import { chat, streamChat, type ChatMessage } from "../services/gemini";
import {
  buildHealthContext,
  buildExerciseContext,
  buildPlanContext,
  SYSTEM_PROMPT,
  PLAN_SYSTEM_PROMPT,
} from "../services/healthContext";
import { useActivePlan } from "../hooks/useActivePlan";
import { extractJson } from "../utils/extractJson";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizePlan(raw: any): Partial<Plan> {
  return {
    name: raw.name ?? "AI Generated Plan",
    description: raw.description,
    calorieTarget: Number(raw.calorieTarget) || 2000,
    waterTarget: Number(raw.waterTarget) || 3000,
    weekTemplate: (raw.weekTemplate ?? []).map((day: any) => ({
      dayOfWeek: day.dayOfWeek,
      isRest: Boolean(day.isRest),
      label: day.label ?? (day.isRest ? "Rest" : "Workout"),
      exercises: (day.exercises ?? []).map((ex: any) => ({
        exerciseId: ex.exerciseId ?? uuid(),
        name: ex.name ?? "",
        sets: Number(ex.sets) || 3,
        reps: Number(ex.reps) || 10,
        weight: Number(ex.weight) || 0,
        unit: ex.unit ?? "kg",
        restSeconds: Number(ex.restSeconds) || 60,
      })),
    })),
  };
}

// ── Plan Preview ──────────────────────────────────────────────────────────────

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function PlanPreview({
  plan, loading, modifyInput, onModifyChange,
  onModify, onAccept, onReset, saving, saved, isUpdate,
}: {
  plan: Partial<Plan>;
  loading: boolean;
  modifyInput: string;
  onModifyChange: (v: string) => void;
  onModify: () => void;
  onAccept: () => void;
  onReset: () => void;
  saving: boolean;
  saved: boolean;
  isUpdate?: boolean;
}) {
  const navigate = useNavigate();
  const [expandedDay, setExpandedDay] = useState<number | null>(null);
  const sorted = [...(plan.weekTemplate ?? [])].sort(
    (a, b) => a.dayOfWeek - b.dayOfWeek
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Plan header */}
      <div className="bg-[#1A1A1A] rounded-2xl p-4 border border-white/10">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-white truncate">{plan.name}</h2>
            {plan.description && (
              <p className="text-xs text-white/50 mt-0.5 leading-snug">{plan.description}</p>
            )}
          </div>
          <button
            onClick={onReset}
            className="text-white/30 hover:text-white/60 transition-colors shrink-0 mt-0.5"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex gap-2">
          <div className="flex-1 bg-[#0D0D0D] rounded-xl px-3 py-2 text-center">
            <p className="text-[10px] text-white/40 mb-0.5">Calories</p>
            <p className="text-sm font-bold text-[#00FF87]">{plan.calorieTarget} kcal</p>
          </div>
          <div className="flex-1 bg-[#0D0D0D] rounded-xl px-3 py-2 text-center">
            <p className="text-[10px] text-white/40 mb-0.5">Water</p>
            <p className="text-sm font-bold text-blue-400">
              {((plan.waterTarget ?? 3000) / 1000).toFixed(1)} L
            </p>
          </div>
        </div>
      </div>

      {/* Day schedule */}
      <div className="space-y-1.5">
        {sorted.map((day) => {
          const isExpanded = expandedDay === day.dayOfWeek;
          return (
            <div
              key={day.dayOfWeek}
              className={`rounded-xl border overflow-hidden ${
                day.isRest
                  ? "border-white/5 bg-[#111]"
                  : "border-[#FF6B35]/20 bg-[#1A1A1A]"
              }`}
            >
              <button
                className="w-full flex items-center gap-3 px-4 py-3"
                onClick={() => !day.isRest && setExpandedDay(isExpanded ? null : day.dayOfWeek)}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                    day.isRest ? "bg-[#2A2A2A] text-[#555]" : "bg-[#FF6B35]/15 text-[#FF6B35]"
                  }`}
                >
                  {DAY_LABELS[day.dayOfWeek]}
                </div>
                <div className="flex-1 text-left">
                  <p className={`text-sm font-semibold ${day.isRest ? "text-white/35" : "text-white"}`}>
                    {day.label}
                  </p>
                  {!day.isRest && (
                    <p className="text-xs text-white/30">{day.exercises.length} exercises</p>
                  )}
                </div>
                {!day.isRest && (
                  isExpanded
                    ? <ChevronUp size={14} className="text-white/30 shrink-0" />
                    : <ChevronDown size={14} className="text-white/30 shrink-0" />
                )}
              </button>

              {isExpanded && !day.isRest && (
                <div className="px-4 pb-3 space-y-2 border-t border-white/5">
                  {day.exercises.map((ex, i) => (
                    <div key={i} className="flex items-start gap-3 pt-2">
                      <div className="w-5 h-5 rounded-full bg-[#FF6B35]/15 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-[9px] font-bold text-[#FF6B35]">{i + 1}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-medium truncate">{ex.name}</p>
                        <p className="text-xs text-white/40">
                          {ex.sets}×{ex.reps}
                          {ex.unit !== "bodyweight"
                            ? ` · ${ex.weight}${ex.unit}`
                            : " · Bodyweight"}
                          {` · ${ex.restSeconds}s rest`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modify */}
      {!saved && (
        <div className="bg-[#1A1A1A] rounded-2xl p-3 border border-white/10">
          <p className="text-xs text-white/40 mb-2 font-medium">Request changes</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={modifyInput}
              onChange={(e) => onModifyChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") onModify(); }}
              placeholder="e.g. More chest work on Monday, swap squats for leg press…"
              disabled={loading}
              className="flex-1 bg-[#0D0D0D] border border-white/10 rounded-xl px-3 py-2
                         text-white text-xs placeholder:text-white/20
                         focus:outline-none focus:border-[#00FF87]/40 disabled:opacity-50"
            />
            <button
              onClick={onModify}
              disabled={!modifyInput.trim() || loading}
              className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center
                         hover:bg-white/15 transition-colors disabled:opacity-30 shrink-0"
            >
              {loading
                ? <Loader2 size={14} className="animate-spin text-white/60" />
                : <Send size={14} className="text-white/60" />}
            </button>
          </div>
        </div>
      )}

      {/* Accept / saved */}
      {saved ? (
        <div className="bg-[#00FF87]/10 border border-[#00FF87]/30 rounded-2xl p-4 text-center">
          <Check size={20} className="text-[#00FF87] mx-auto mb-2" />
          <p className="text-sm font-semibold text-white">
            {isUpdate ? "Plan updated!" : "Plan saved!"}
          </p>
          <p className="text-xs text-white/40 mb-3">
            {isUpdate ? "Your active plan has been updated." : "Activate it from the Plans page."}
          </p>
          {!isUpdate && (
            <button
              onClick={() => navigate("/plan")}
              className="text-xs text-[#00FF87] font-semibold underline underline-offset-2"
            >
              View Plans →
            </button>
          )}
        </div>
      ) : (
        <button
          onClick={onAccept}
          disabled={saving}
          className="w-full py-3 rounded-xl bg-[#00FF87] text-black font-bold text-sm
                     hover:bg-[#00FF87]/90 active:scale-[0.98] transition-all
                     disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          {saving ? "Saving…" : isUpdate ? "Save Changes" : "Accept & Save Plan"}
        </button>
      )}
    </div>
  );
}

// ── Suggestions ───────────────────────────────────────────────────────────────

const FEEDBACK_SUGGESTIONS = [
  "Analyze my progress this week",
  "How is my nutrition tracking?",
  "Suggest improvements to my routine",
  "Am I hitting my water goals?",
];

const PLAN_SUGGESTIONS = [
  "4-day push/pull/legs for intermediate",
  "Beginner full-body 3-day plan",
  "5-day hypertrophy program",
  "Home workout with no equipment",
];

// ── Main component ────────────────────────────────────────────────────────────

export default function AICoach() {
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<"feedback" | "plan">(() =>
    searchParams.get("mode") === "plan" ? "plan" : "feedback"
  );

  const activePlan = useActivePlan();
  // undefined = still loading, null = no active plan, Plan = has active plan
  const isUpdateMode = Boolean(activePlan);

  // Shared context
  const [healthContext, setHealthContext] = useState<string | null>(null);
  const [exerciseContext, setExerciseContext] = useState<string | null>(null);
  const [planContext, setPlanContext] = useState<string | null>(null);
  const contextReady = healthContext !== null && exerciseContext !== null && planContext !== null;

  useEffect(() => {
    buildHealthContext().then(setHealthContext);
    buildExerciseContext().then(setExerciseContext);
    buildPlanContext().then(setPlanContext);
  }, []);

  // ── Feedback state ──────────────────────────────────────────────────────────
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [feedbackInput, setFeedbackInput] = useState("");
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackError, setFeedbackError] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const lastUserMsgRef = useRef<string>("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendFeedback(text: string) {
    if (!text.trim() || feedbackLoading || !contextReady) return;

    lastUserMsgRef.current = text.trim();
    setFeedbackError(false);

    const userMsg: ChatMessage = { role: "user", content: text.trim() };
    const history: ChatMessage[] =
      messages.length === 0
        ? [
            { role: "user", content: `${SYSTEM_PROMPT}\n\n${healthContext}` },
            { role: "model", content: "Understood. I have your health data loaded and I'm ready to help." },
            userMsg,
          ]
        : [...messages, userMsg];

    setMessages((prev) => [...prev, userMsg, { role: "model", content: "" }]);
    setFeedbackInput("");
    setFeedbackLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await streamChat(
        history,
        (chunk) => {
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            updated[updated.length - 1] = { ...last, content: last.content + chunk };
            return updated;
          });
        },
        controller.signal
      );
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        console.error("[Feedback]", err);
        setFeedbackError(true);
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "model",
            content: "Something went wrong. Please try again.",
          };
          return updated;
        });
      }
    } finally {
      setFeedbackLoading(false);
      abortRef.current = null;
    }
  }

  function retryFeedback() {
    if (!lastUserMsgRef.current) return;
    const text = lastUserMsgRef.current;
    // Remove the last user + error model pair before retrying
    setMessages((prev) => prev.slice(0, -2));
    setFeedbackError(false);
    sendFeedback(text);
  }

  // ── Plan state ──────────────────────────────────────────────────────────────
  const [planQuery, setPlanQuery] = useState("");
  const [generatedPlan, setGeneratedPlan] = useState<Partial<Plan> | null>(null);
  const [planHistory, setPlanHistory] = useState<ChatMessage[]>([]);
  const [modifyInput, setModifyInput] = useState("");
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Pre-populate plan preview with active plan when in update mode
  useEffect(() => {
    if (mode === "plan" && activePlan !== undefined && generatedPlan === null) {
      if (activePlan) setGeneratedPlan(normalizePlan(activePlan));
    }
  }, [mode, activePlan]); // eslint-disable-line react-hooks/exhaustive-deps

  async function generatePlan(query: string) {
    if (!query.trim() || planLoading || !contextReady) return;
    setPlanLoading(true);
    setPlanError(null);

    const userContent = [
      PLAN_SYSTEM_PROMPT,
      `\nAvailable exercises:\n${exerciseContext}`,
      `\nUser profile:\n${planContext}`,
      `\nPlan request: ${query.trim()}`,
    ].join("\n");

    const conversation: ChatMessage[] = [{ role: "user", content: userContent }];

    try {
      const response = await chat(conversation);
      const plan = normalizePlan(extractJson(response));
      setGeneratedPlan(plan);
      setPlanHistory([...conversation, { role: "model", content: response }]);
    } catch (err) {
      console.error("[generatePlan]", err);
      setPlanError("Failed to generate plan. Please try again.");
    } finally {
      setPlanLoading(false);
    }
  }

  async function modifyPlan() {
    if (!modifyInput.trim() || planLoading || !generatedPlan) return;
    setPlanLoading(true);
    setPlanError(null);

    // If no history yet (update mode first call), build full context including current plan
    const baseHistory: ChatMessage[] =
      planHistory.length === 0
        ? [
            {
              role: "user",
              content: [
                PLAN_SYSTEM_PROMPT,
                `\nAvailable exercises:\n${exerciseContext}`,
                `\nUser profile:\n${planContext}`,
                `\nCurrent plan JSON:\n${JSON.stringify(generatedPlan)}`,
              ].join("\n"),
            },
            {
              role: "model",
              content: JSON.stringify(generatedPlan),
            },
          ]
        : planHistory;

    const updatedHistory: ChatMessage[] = [
      ...baseHistory,
      {
        role: "user",
        content: `Modify the plan: ${modifyInput.trim()}\n\nReturn the complete updated JSON only.`,
      },
    ];

    try {
      const response = await chat(updatedHistory);
      const plan = normalizePlan(extractJson(response));
      setGeneratedPlan(plan);
      setPlanHistory([...updatedHistory, { role: "model", content: response }]);
      setModifyInput("");
    } catch (err) {
      console.error("[modifyPlan]", err);
      setPlanError("Failed to modify plan. Please try again.");
    } finally {
      setPlanLoading(false);
    }
  }

  async function acceptPlan() {
    if (!generatedPlan || saving) return;
    setSaving(true);
    try {
      if (activePlan) {
        await db.plans.update(activePlan.id, {
          ...generatedPlan,
          updatedAt: new Date().toISOString(),
        });
      } else {
        await db.plans.add({
          ...generatedPlan,
          id: uuid(),
          isActive: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as Plan);
      }
      setSaved(true);
    } catch {
      setPlanError("Failed to save plan. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function resetPlan() {
    setGeneratedPlan(activePlan ? normalizePlan(activePlan) : null);
    setPlanHistory([]);
    setModifyInput("");
    setPlanError(null);
    setSaved(false);
    setPlanQuery("");
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-[#0D0D0D]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#00FF87]/10 flex items-center justify-center">
            <Sparkles size={16} className="text-[#00FF87]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">AI Coach</p>
            <p className="text-xs text-white/40">Powered by Gemini</p>
          </div>
        </div>
        {mode === "feedback" && messages.length > 0 && (
          <button
            onClick={() => { abortRef.current?.abort(); setMessages([]); }}
            className="text-white/40 hover:text-white/70 transition-colors"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Mode tabs */}
      <div className="flex gap-1 mx-4 mt-3 p-1 bg-[#1A1A1A] rounded-xl shrink-0">
        {([
          { key: "feedback", label: "Progress Feedback", Icon: Brain },
          { key: "plan", label: isUpdateMode ? "Update with AI" : "Create Plan", Icon: Wand2 },
        ] as const).map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setMode(key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg
                        text-xs font-semibold transition-all ${
              mode === key
                ? "bg-[#0D0D0D] text-white shadow-sm"
                : "text-white/40 hover:text-white/60"
            }`}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">

        {/* ── Feedback mode ── */}
        {mode === "feedback" && (
          messages.length === 0 ? (
            <div className="flex flex-col items-center gap-6 pt-6 pb-4">
              <div className="w-16 h-16 rounded-2xl bg-[#00FF87]/10 flex items-center justify-center">
                <Bot size={32} className="text-[#00FF87]" />
              </div>
              <div className="text-center">
                <p className="text-white font-semibold mb-1">Your personal health coach</p>
                <p className="text-white/40 text-sm">Ask me anything about your progress, plans, or goals</p>
              </div>
              <div className="w-full grid grid-cols-2 gap-2">
                {FEEDBACK_SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendFeedback(s)}
                    disabled={!contextReady}
                    className="text-left p-3 rounded-xl bg-[#1A1A1A] border border-white/10
                               text-white/70 text-xs leading-snug
                               hover:border-[#00FF87]/40 hover:text-white
                               active:scale-95 transition-all disabled:opacity-40"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                >
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                      msg.role === "user" ? "bg-[#00FF87]/20" : "bg-white/10"
                    }`}
                  >
                    {msg.role === "user"
                      ? <User size={14} className="text-[#00FF87]" />
                      : <Bot size={14} className="text-white/70" />}
                  </div>
                  <div
                    className={`max-w-[80%] px-3 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-[#00FF87]/15 text-white rounded-tr-sm whitespace-pre-wrap"
                        : "bg-[#1A1A1A] text-white/85 rounded-tl-sm"
                    } ${
                      feedbackLoading && i === messages.length - 1 && !msg.content
                        ? "animate-pulse"
                        : ""
                    }`}
                  >
                    {msg.role === "user" ? (
                      msg.content || (feedbackLoading ? "▋" : "")
                    ) : msg.content ? (
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                          h1: ({ children }) => <h1 className="text-base font-bold mb-2 text-white">{children}</h1>,
                          h2: ({ children }) => <h2 className="text-sm font-bold mb-2 text-white">{children}</h2>,
                          h3: ({ children }) => <h3 className="text-sm font-semibold mb-1.5 text-white">{children}</h3>,
                          ul: ({ children }) => <ul className="list-disc list-outside pl-4 mb-2 space-y-1">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal list-outside pl-4 mb-2 space-y-1">{children}</ol>,
                          li: ({ children }) => <li className="leading-snug">{children}</li>,
                          strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
                          em: ({ children }) => <em className="italic text-white/70">{children}</em>,
                          code: ({ children }) => <code className="bg-white/10 px-1 py-0.5 rounded text-xs font-mono">{children}</code>,
                          blockquote: ({ children }) => <blockquote className="border-l-2 border-[#00FF87]/50 pl-3 text-white/60 italic mb-2">{children}</blockquote>,
                          hr: () => <hr className="border-white/10 my-2" />,
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    ) : feedbackLoading ? "▋" : ""}
                  </div>
                </div>
              ))}
              {feedbackError && (
                <div className="flex justify-start pl-10">
                  <button
                    onClick={retryFeedback}
                    disabled={feedbackLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl
                               bg-white/5 border border-white/10 text-white/50 text-xs
                               hover:bg-white/10 hover:text-white/80 active:scale-95
                               transition-all disabled:opacity-30"
                  >
                    <RefreshCw size={11} />
                    Retry
                  </button>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )
        )}

        {/* ── Plan mode ── */}
        {mode === "plan" && (
          !generatedPlan ? (
            <div className="flex flex-col gap-4 pt-2">
              <div className="flex flex-col items-center gap-3 pb-2">
                <div className="w-14 h-14 rounded-2xl bg-[#FF6B35]/10 flex items-center justify-center">
                  <Wand2 size={28} className="text-[#FF6B35]" />
                </div>
                <div className="text-center">
                  <p className="text-white font-semibold mb-0.5">AI Plan Creator</p>
                  <p className="text-white/40 text-xs">Describe your goal — I'll build a full weekly plan</p>
                </div>
              </div>
              <div className="bg-[#1A1A1A] rounded-2xl p-4 border border-white/10">
                <textarea
                  rows={3}
                  value={planQuery}
                  onChange={(e) => setPlanQuery(e.target.value)}
                  placeholder="e.g. 4-day push/pull/legs plan for an intermediate lifter focused on hypertrophy"
                  disabled={planLoading || !contextReady}
                  className="w-full bg-transparent text-white text-sm placeholder:text-white/25
                             resize-none focus:outline-none leading-relaxed disabled:opacity-50"
                />
                <div className="flex justify-end mt-3">
                  <button
                    onClick={() => generatePlan(planQuery)}
                    disabled={!planQuery.trim() || planLoading || !contextReady}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FF6B35] text-white
                               text-sm font-semibold hover:bg-[#FF6B35]/90 active:scale-95
                               transition-all disabled:opacity-30"
                  >
                    {planLoading
                      ? <><Loader2 size={14} className="animate-spin" /> Generating…</>
                      : <><Wand2 size={14} /> Generate Plan</>}
                  </button>
                </div>
              </div>
               {planError && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-xs text-red-400">
                  <p>{planError}</p>
                  <button
                    onClick={() => generatePlan(planQuery)}
                    disabled={planLoading || !planQuery.trim()}
                    className="flex items-center gap-1.5 mt-2 text-red-400/70 hover:text-red-400
                               transition-colors disabled:opacity-30"
                  >
                    <RefreshCw size={11} />
                    Retry
                  </button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                {PLAN_SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setPlanQuery(s)}
                    disabled={!contextReady}
                    className="text-left p-3 rounded-xl bg-[#1A1A1A] border border-white/10
                               text-white/70 text-xs leading-snug
                               hover:border-[#FF6B35]/40 hover:text-white
                               active:scale-95 transition-all disabled:opacity-40"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="pt-1">
              {isUpdateMode && !saved && (
                <div className="flex items-center gap-2 mb-3 px-1">
                  <div className="w-6 h-6 rounded-lg bg-[#FF6B35]/15 flex items-center justify-center shrink-0">
                    <Wand2 size={13} className="text-[#FF6B35]" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white">Update with AI</p>
                    <p className="text-[10px] text-white/40">Request changes below to modify your active plan</p>
                  </div>
                </div>
              )}
              <PlanPreview
                plan={generatedPlan}
                loading={planLoading}
                modifyInput={modifyInput}
                onModifyChange={setModifyInput}
                onModify={modifyPlan}
                onAccept={acceptPlan}
                onReset={resetPlan}
                saving={saving}
                saved={saved}
                isUpdate={isUpdateMode}
              />
               {planError && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-xs text-red-400 mt-3">
                  <p>{planError}</p>
                  <button
                    onClick={modifyInput.trim() ? modifyPlan : () => generatePlan(planQuery)}
                    disabled={planLoading}
                    className="flex items-center gap-1.5 mt-2 text-red-400/70 hover:text-red-400
                               transition-colors disabled:opacity-30"
                  >
                    <RefreshCw size={11} />
                    Retry
                  </button>
                </div>
              )}
            </div>
          )
        )}
      </div>

      {/* Feedback input bar */}
      {mode === "feedback" && (
        <div className="px-4 py-3 border-t border-white/10 shrink-0">
          <div className="flex items-end gap-2">
            <textarea
              rows={1}
              value={feedbackInput}
              onChange={(e) => setFeedbackInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendFeedback(feedbackInput);
                }
              }}
              placeholder={contextReady ? "Ask your AI coach…" : "Loading your data…"}
              disabled={feedbackLoading || !contextReady}
              className="flex-1 bg-[#1A1A1A] border border-white/10 rounded-xl px-3 py-2.5
                         text-white text-sm placeholder:text-white/30 resize-none
                         focus:outline-none focus:border-[#00FF87]/50
                         disabled:opacity-50 max-h-32"
              style={{ fieldSizing: "content" } as React.CSSProperties}
            />
            {feedbackLoading ? (
              <button
                onClick={() => { abortRef.current?.abort(); setFeedbackLoading(false); }}
                className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center
                           text-red-400 hover:bg-red-500/30 transition-colors shrink-0"
              >
                <Square size={16} />
              </button>
            ) : (
              <button
                onClick={() => sendFeedback(feedbackInput)}
                disabled={!feedbackInput.trim() || !contextReady}
                className="w-10 h-10 rounded-xl bg-[#00FF87] flex items-center justify-center
                           text-black hover:bg-[#00FF87]/90 active:scale-95
                           transition-all disabled:opacity-30 shrink-0"
              >
                <Send size={16} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
