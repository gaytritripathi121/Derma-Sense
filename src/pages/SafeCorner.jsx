import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CalendarPlus,
  CheckSquare,
  HeartHandshake,
  MessageSquareText,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  ShieldAlert,
  Square,
  Stethoscope,
  Sun,
  Trash2,
  X,
} from 'lucide-react';
import DashboardCard from '../components/DashboardCard.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { CLASS_CODES, CLASS_NAMES } from '../data/classMapping.js';
import { predictionService } from '../services/predictionService.js';

const CHECKLIST_STORAGE_KEY = 'dermasense_safecorner_checklist_v1';
const ABCDE_STORAGE_KEY = 'dermasense_abcde_log_v1';
const CUSTOM_SCHEDULE_KEY = 'dermasense_safecorner_custom_schedule_v1';
const CUSTOM_WEEKLY_KEY = 'dermasense_safecorner_custom_weekly_v1';

export default function SafeCorner({ prediction }) {
  const { user } = useAuth();
  const [accountLatest, setAccountLatest] = useState(null);

  const [wakeTime, setWakeTime] = useState('07:00');
  const [sleepTime, setSleepTime] = useState('22:30');
  const [sensitiveSkin, setSensitiveSkin] = useState(false);
  const [plan, setPlan] = useState(null);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [error, setError] = useState('');

  // Editable Daily Schedule state
  const [customSchedule, setCustomSchedule] = useState(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(CUSTOM_SCHEDULE_KEY) || 'null');
      return Array.isArray(parsed) && parsed.length ? parsed : null;
    } catch {
      return null;
    }
  });
  const [editingScheduleId, setEditingScheduleId] = useState(null);
  const [scheduleDraft, setScheduleDraft] = useState({
    time: '',
    period: '',
    category: '',
    title: '',
    details: '',
  });
  const [addingScheduleItem, setAddingScheduleItem] = useState(false);
  const [newScheduleItem, setNewScheduleItem] = useState({
    time: '12:00 PM',
    period: 'Midday',
    category: 'Custom Care',
    title: '',
    details: '',
  });

  // Editable 7-Day Planner state
  const [customWeeklyPlan, setCustomWeeklyPlan] = useState(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(CUSTOM_WEEKLY_KEY) || 'null');
      return Array.isArray(parsed) && parsed.length ? parsed : null;
    } catch {
      return null;
    }
  });
  const [editingDay, setEditingDay] = useState(null);
  const [dayDraft, setDayDraft] = useState({ primaryFocus: '', tasksText: '' });

  const todayKey = new Date().toISOString().slice(0, 10);
  const [checkedIds, setCheckedIds] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(CHECKLIST_STORAGE_KEY) || '{}');
      return saved.date === todayKey && Array.isArray(saved.ids) ? saved.ids : [];
    } catch {
      return [];
    }
  });

  const [abcdeLogs, setAbcdeLogs] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(ABCDE_STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  });
  const [newLogSite, setNewLogSite] = useState('');
  const [newLogNotes, setNewLogNotes] = useState('');
  const [newLogFlags, setNewLogFlags] = useState({ A: false, B: false, C: false, D: false, E: false });

  const [apptDateTime, setApptDateTime] = useState(() => {
    const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    d.setHours(10, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [apptClinic, setApptClinic] = useState('Dermatology Outpatient Clinic');
  const [apptTitle, setApptTitle] = useState('Dermatologist Skin Lesion Evaluation');
  const [icsStatus, setIcsStatus] = useState('');

  useEffect(() => {
    let active = true;
    if (prediction || !user) {
      setAccountLatest(null);
      return undefined;
    }
    predictionService
      .getHistory()
      .then((res) => {
        if (!active) return;
        const latest = res?.items?.[0] || null;
        if (latest && latest.predictedClass) {
          setAccountLatest({
            reportId: latest.reportId,
            predictedClass: latest.predictedClass,
            fullCategoryName: latest.fullCategoryName || CLASS_NAMES[latest.predictedClass],
            confidence: latest.confidence,
            confidencePercentage: latest.confidencePercentage,
            confidenceAssessment: {
              isLowConfidence: Boolean(latest.isLowConfidence),
            },
            patientHistory: {},
            fromSavedAccount: true,
          });
        } else {
          setAccountLatest(null);
        }
      })
      .catch(() => {
        if (active) setAccountLatest(null);
      });
    return () => {
      active = false;
    };
  }, [prediction, user]);

  const effectivePrediction = prediction || accountLatest;

  const isValidCategory = Boolean(
    effectivePrediction?.predictedClass && CLASS_CODES.includes(effectivePrediction.predictedClass)
  );
  const rawConfidence =
    typeof effectivePrediction?.confidence === 'number' ? effectivePrediction.confidence : null;
  const isLowConfidence = !isValidCategory
    ? true
    : typeof effectivePrediction?.confidenceAssessment?.isLowConfidence === 'boolean'
      ? effectivePrediction.confidenceAssessment.isLowConfidence
      : rawConfidence === null || rawConfidence < 0.7;

  const fetchPlan = async () => {
    setLoadingPlan(true);
    setError('');
    try {
      const data = await predictionService.generateSafeCornerPlan({
        predictedClass: isValidCategory ? effectivePrediction.predictedClass : null,
        isLowConfidence,
        patientHistory: effectivePrediction?.patientHistory || {},
        wakeTime,
        sleepTime,
        preferences: { sensitiveSkin },
      });
      setPlan(data);
    } catch (err) {
      setError(err.message || 'Unable to generate Safe Corner plan.');
    } finally {
      setLoadingPlan(false);
    }
  };

  useEffect(() => {
    fetchPlan();
  }, [
    effectivePrediction?.reportId,
    effectivePrediction?.predictedClass,
    effectivePrediction?.confidence,
    effectivePrediction?.confidenceAssessment?.isLowConfidence,
  ]);

  const displayedSchedule = customSchedule || plan?.schedule || [];
  const displayedWeeklyPlan = customWeeklyPlan || plan?.weeklyPlan || [];

  const saveCustomSchedule = (nextSchedule) => {
    setCustomSchedule(nextSchedule);
    if (nextSchedule) {
      localStorage.setItem(CUSTOM_SCHEDULE_KEY, JSON.stringify(nextSchedule));
    } else {
      localStorage.removeItem(CUSTOM_SCHEDULE_KEY);
    }
  };

  const handleStartEditSchedule = (item) => {
    setEditingScheduleId(item.id);
    setScheduleDraft({
      time: item.time,
      period: item.period,
      category: item.category,
      title: item.title,
      details: item.details,
    });
  };

  const handleSaveScheduleItem = (id) => {
    if (!scheduleDraft.title.trim()) return;
    const base = [...displayedSchedule];
    const next = base.map((item) =>
      item.id === id
        ? {
            ...item,
            time: scheduleDraft.time.trim() || item.time,
            period: scheduleDraft.period.trim() || item.period,
            category: scheduleDraft.category.trim() || item.category,
            title: scheduleDraft.title.trim(),
            details: scheduleDraft.details.trim(),
          }
        : item
    );
    saveCustomSchedule(next);
    setEditingScheduleId(null);
  };

  const handleDeleteScheduleItem = (id) => {
    const next = displayedSchedule.filter((item) => item.id !== id);
    saveCustomSchedule(next);
    if (editingScheduleId === id) setEditingScheduleId(null);
  };

  const handleAddScheduleItem = (e) => {
    e.preventDefault();
    if (!newScheduleItem.title.trim()) return;
    const created = {
      id: `custom-${Date.now().toString(36)}`,
      time: newScheduleItem.time.trim() || '12:00 PM',
      period: newScheduleItem.period.trim() || 'Custom',
      category: newScheduleItem.category.trim() || 'Personal Care',
      title: newScheduleItem.title.trim(),
      details: newScheduleItem.details.trim() || 'Custom skin-care routine step.',
    };
    saveCustomSchedule([...displayedSchedule, created]);
    setNewScheduleItem({
      time: '12:00 PM',
      period: 'Midday',
      category: 'Custom Care',
      title: '',
      details: '',
    });
    setAddingScheduleItem(false);
  };

  const handleResetSchedule = () => {
    setEditingScheduleId(null);
    setAddingScheduleItem(false);
    saveCustomSchedule(null);
  };

  const saveCustomWeekly = (nextWeekly) => {
    setCustomWeeklyPlan(nextWeekly);
    if (nextWeekly) {
      localStorage.setItem(CUSTOM_WEEKLY_KEY, JSON.stringify(nextWeekly));
    } else {
      localStorage.removeItem(CUSTOM_WEEKLY_KEY);
    }
  };

  const handleStartEditDay = (row) => {
    setEditingDay(row.day);
    setDayDraft({
      primaryFocus: row.primaryFocus,
      tasksText: (row.tasks || []).join('\n'),
    });
  };

  const handleSaveDay = (dayName) => {
    if (!dayDraft.primaryFocus.trim()) return;
    const parsedTasks = dayDraft.tasksText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    const next = displayedWeeklyPlan.map((d) =>
      d.day === dayName
        ? {
            ...d,
            primaryFocus: dayDraft.primaryFocus.trim(),
            tasks: parsedTasks.length ? parsedTasks : d.tasks,
          }
        : d
    );
    saveCustomWeekly(next);
    setEditingDay(null);
  };

  const handleResetWeekly = () => {
    setEditingDay(null);
    saveCustomWeekly(null);
  };

  const toggleCheck = (id) => {
    const next = checkedIds.includes(id)
      ? checkedIds.filter((x) => x !== id)
      : [...checkedIds, id];
    setCheckedIds(next);
    localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify({ date: todayKey, ids: next }));
  };

  const addAbcdeEntry = (e) => {
    e.preventDefault();
    if (!newLogSite.trim() && !newLogNotes.trim()) return;
    const entry = {
      id: Date.now().toString(36),
      date: new Date().toLocaleDateString('en-US'),
      site: newLogSite.trim() || 'Unspecified site',
      flags: Object.entries(newLogFlags)
        .filter(([, v]) => v)
        .map(([k]) => k),
      notes: newLogNotes.trim() || 'Routine self-check recorded.',
    };
    const next = [entry, ...abcdeLogs];
    setAbcdeLogs(next);
    localStorage.setItem(ABCDE_STORAGE_KEY, JSON.stringify(next));
    setNewLogSite('');
    setNewLogNotes('');
    setNewLogFlags({ A: false, B: false, C: false, D: false, E: false });
  };

  const deleteAbcdeEntry = (id) => {
    const next = abcdeLogs.filter((x) => x.id !== id);
    setAbcdeLogs(next);
    localStorage.setItem(ABCDE_STORAGE_KEY, JSON.stringify(next));
  };

  const handleExportIcs = async (e) => {
    e.preventDefault();
    setIcsStatus('');
    try {
      await predictionService.exportCalendarIcs({
        title: apptTitle,
        dateTimeIso: apptDateTime,
        durationMinutes: 45,
        location: apptClinic,
        notes: isValidCategory
          ? `Follow-up for DermaSense AI screening ${effectivePrediction.reportId} (${effectivePrediction.predictedClass}, ${effectivePrediction.confidencePercentage}%).`
          : 'Bring ABCDE self-monitoring log to dermatology consultation.',
      });
      setIcsStatus('Downloaded dermasense-followup.ics calendar invite.');
    } catch (err) {
      setIcsStatus(err.message || 'Failed to export calendar reminder.');
    }
  };

  const guide = plan?.educationalGuide || null;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-950">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
          <div>
            <div className="font-semibold">
              Educational Skin-Care &amp; Screening Awareness — Not a Medical Diagnosis
            </div>
            <p className="mt-1 text-amber-900 leading-relaxed">
              {guide?.medicalDisclaimer ||
                'DermaSense AI Safe Corner provides educational skin-health and prevention guidance only. An automated screening result is never a confirmed diagnosis, never establishes that a lesion is harmless, and never replaces professional dermatological evaluation.'}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <h1 className="text-xl font-bold text-slate-900">
              Safe Corner — Dynamic Educational Skin Care &amp; Follow-Up Companion
            </h1>
            <p className="mt-1 text-sm text-slate-600 leading-relaxed">
              Educational skin-care guidance, clinical warning signs, sun-protection habits, dermatologist discussion prompts, ABCDE logging, and an editable personal routine planner.
            </p>
          </div>
          {isValidCategory ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-right text-xs">
              <div className="font-mono text-slate-500">
                {effectivePrediction.fromSavedAccount ? 'Latest Account Screening' : 'Linked Screening'}:{' '}
                {effectivePrediction.reportId}
              </div>
              <div className="mt-0.5 font-semibold text-slate-900">
                {effectivePrediction.predictedClass} — {effectivePrediction.fullCategoryName}
              </div>
              <div
                className={`mt-0.5 font-mono font-medium ${
                  isLowConfidence ? 'text-rose-700' : 'text-blue-700'
                }`}
              >
                Confidence: {effectivePrediction.confidencePercentage ?? '—'}% (
                {isLowConfidence ? 'Below 70% threshold' : 'Above 70% threshold'})
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-600">
              <div className="font-semibold text-slate-800">No Active Valid Screening Result</div>
              <Link
                to="/analyze"
                className="mt-1 inline-flex items-center gap-1 font-medium text-blue-700 hover:underline"
              >
                Run Lesion Screening
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-4 items-end border-t border-slate-200 pt-5">
          <label className="block">
            <span className="text-xs font-medium text-slate-700">Wake Time</span>
            <input
              type="time"
              value={wakeTime}
              onChange={(e) => setWakeTime(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono text-slate-900"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-700">Sleep Time</span>
            <input
              type="time"
              value={sleepTime}
              onChange={(e) => setSleepTime(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono text-slate-900"
            />
          </label>
          <label className="flex items-center gap-2.5 py-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={sensitiveSkin}
              onChange={(e) => setSensitiveSkin(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600"
            />
            Sensitive / UV-reactive skin
          </label>
          <button
            type="button"
            onClick={fetchPlan}
            disabled={loadingPlan}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-slate-400 whitespace-nowrap"
          >
            {loadingPlan ? 'Updating...' : 'Update Recommended Plan'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm text-rose-800">
          {error}
        </div>
      )}

      {plan?.uncertaintyWarning && (
        <div className="rounded-xl border border-rose-300 bg-rose-50 px-5 py-4 text-sm text-rose-950">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-700" />
            <div className="space-y-1.5">
              <div className="font-semibold text-rose-900">{plan.uncertaintyWarning.title}</div>
              <p className="text-xs leading-relaxed text-rose-900">
                {plan.uncertaintyWarning.message}
              </p>
              <p className="text-xs font-medium leading-relaxed text-rose-950">
                {plan.uncertaintyWarning.recommendation}
              </p>
            </div>
          </div>
        </div>
      )}

      {plan && (
        <>
          <div
            className={`rounded-xl border px-5 py-5 text-sm ${
              plan.canUseDiseaseSpecific
                ? 'border-blue-200 bg-blue-50 text-blue-950'
                : 'border-slate-200 bg-white text-slate-900'
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide opacity-75">
                  {plan.canUseDiseaseSpecific
                    ? `Category-Specific Educational Guidance · ${guide?.categoryCode}`
                    : 'General Skin-Health Guidance'}
                </div>
                <h2 className="mt-1 text-lg font-bold">{plan.conditionGuidance.headline}</h2>
              </div>
              {guide?.urgencyLevel && (
                <span className="rounded-lg border border-current/20 bg-white/70 px-3 py-1 text-xs font-semibold">
                  {guide.urgencyLevel}
                </span>
              )}
            </div>
            <p className="mt-2 text-xs leading-relaxed opacity-90">{plan.conditionGuidance.reason}</p>
            {guide?.overview && (
              <p className="mt-3 text-sm leading-relaxed">{guide.overview}</p>
            )}
            <div className="mt-4">
              <div className="text-xs font-semibold">Recommended Next Steps</div>
              <ul className="mt-1.5 list-disc pl-5 space-y-1 text-xs leading-relaxed">
                {plan.conditionGuidance.actionItems.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          </div>

          {guide && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <DashboardCard
                title="Relevant Warning Signs to Watch For"
                subtitle="Promptly arrange an in-person clinical evaluation if any of these features are present."
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                  <ul className="list-disc pl-4 space-y-2 text-xs text-slate-700 leading-relaxed">
                    {guide.warningSigns.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              </DashboardCard>

              <DashboardCard
                title="Appropriate Gentle Skin-Care Advice"
                subtitle="Supportive non-prescriptive habits to protect skin comfort while avoiding irritation."
              >
                <div className="flex items-start gap-3">
                  <HeartHandshake className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
                  <ul className="list-disc pl-4 space-y-2 text-xs text-slate-700 leading-relaxed">
                    {guide.skinCareAdvice.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              </DashboardCard>

              <DashboardCard
                title="When Professional Dermatological Assessment Is Appropriate"
                subtitle="An educational screening model cannot confirm or exclude skin cancer."
              >
                <div className="flex items-start gap-3">
                  <Stethoscope className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
                  <div className="space-y-3 text-xs text-slate-700 leading-relaxed">
                    <p>{guide.whenToSeeDermatologist}</p>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 font-medium text-slate-900">
                      Assessment Priority: {guide.urgencyLevel}
                    </div>
                  </div>
                </div>
              </DashboardCard>

              <DashboardCard
                title="Prevention & Sun-Protection Advice"
                subtitle="Evidence-aligned UV shielding and skin observation habits."
              >
                <div className="flex items-start gap-3">
                  <Sun className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                  <ul className="list-disc pl-4 space-y-2 text-xs text-slate-700 leading-relaxed">
                    {guide.preventionAndSunProtection.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              </DashboardCard>
            </div>
          )}

          {guide?.dermatologistQuestions?.length > 0 && (
            <DashboardCard
              title="What You Can Discuss With a Dermatologist"
              subtitle="Helpful questions and observations to bring to your clinical consultation alongside your PDF report."
            >
              <div className="flex items-start gap-3">
                <MessageSquareText className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
                <ul className="grid grid-cols-1 gap-2.5 md:grid-cols-2 text-xs text-slate-700 leading-relaxed">
                  {guide.dermatologistQuestions.map((q, idx) => (
                    <li
                      key={idx}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5"
                    >
                      {q}
                    </li>
                  ))}
                </ul>
              </div>
            </DashboardCard>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <DashboardCard
              className="lg:col-span-7"
              title="Daily Skin Protection Checklist (Editable)"
              subtitle={`Completed today (${todayKey}): ${
                displayedSchedule.filter((s) => checkedIds.includes(s.id)).length
              }/${displayedSchedule.length} items${customSchedule ? ' · Customized' : ''}`}
              action={
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAddingScheduleItem((v) => !v)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Step
                  </button>
                  {customSchedule && (
                    <button
                      type="button"
                      onClick={handleResetSchedule}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Reset
                    </button>
                  )}
                </div>
              }
            >
              {addingScheduleItem && (
                <form
                  onSubmit={handleAddScheduleItem}
                  className="mb-4 rounded-lg border border-blue-200 bg-blue-50/50 p-4 space-y-3 text-xs"
                >
                  <div className="font-semibold text-slate-900">Add Custom Daily Routine Step</div>
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                    <input
                      type="text"
                      value={newScheduleItem.time}
                      onChange={(e) =>
                        setNewScheduleItem({ ...newScheduleItem, time: e.target.value })
                      }
                      placeholder="Time (e.g. 2:00 PM)"
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5"
                    />
                    <input
                      type="text"
                      value={newScheduleItem.period}
                      onChange={(e) =>
                        setNewScheduleItem({ ...newScheduleItem, period: e.target.value })
                      }
                      placeholder="Period (e.g. Afternoon)"
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5"
                    />
                    <input
                      type="text"
                      value={newScheduleItem.category}
                      onChange={(e) =>
                        setNewScheduleItem({ ...newScheduleItem, category: e.target.value })
                      }
                      placeholder="Category (e.g. Sun Protection)"
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5"
                    />
                  </div>
                  <input
                    type="text"
                    value={newScheduleItem.title}
                    onChange={(e) =>
                      setNewScheduleItem({ ...newScheduleItem, title: e.target.value })
                    }
                    placeholder="Step title (required)"
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5"
                    required
                  />
                  <textarea
                    rows={2}
                    value={newScheduleItem.details}
                    onChange={(e) =>
                      setNewScheduleItem({ ...newScheduleItem, details: e.target.value })
                    }
                    placeholder="Details or reminders..."
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 font-medium text-white hover:bg-blue-700"
                    >
                      <Save className="h-3.5 w-3.5" />
                      Add to Checklist
                    </button>
                    <button
                      type="button"
                      onClick={() => setAddingScheduleItem(false)}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              <div className="divide-y divide-slate-100">
                {displayedSchedule.map((item) => {
                  const checked = checkedIds.includes(item.id);
                  const isEditing = editingScheduleId === item.id;

                  if (isEditing) {
                    return (
                      <div key={item.id} className="py-3.5 px-2 space-y-2.5 bg-slate-50 rounded-lg my-1">
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 text-xs">
                          <input
                            type="text"
                            value={scheduleDraft.time}
                            onChange={(e) =>
                              setScheduleDraft({ ...scheduleDraft, time: e.target.value })
                            }
                            placeholder="Time"
                            className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono"
                          />
                          <input
                            type="text"
                            value={scheduleDraft.period}
                            onChange={(e) =>
                              setScheduleDraft({ ...scheduleDraft, period: e.target.value })
                            }
                            placeholder="Period"
                            className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5"
                          />
                          <input
                            type="text"
                            value={scheduleDraft.category}
                            onChange={(e) =>
                              setScheduleDraft({ ...scheduleDraft, category: e.target.value })
                            }
                            placeholder="Category"
                            className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5"
                          />
                        </div>
                        <input
                          type="text"
                          value={scheduleDraft.title}
                          onChange={(e) =>
                            setScheduleDraft({ ...scheduleDraft, title: e.target.value })
                          }
                          placeholder="Routine title"
                          className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm"
                        />
                        <textarea
                          rows={2}
                          value={scheduleDraft.details}
                          onChange={(e) =>
                            setScheduleDraft({ ...scheduleDraft, details: e.target.value })
                          }
                          placeholder="Routine details"
                          className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                        />
                        <div className="flex items-center gap-2 text-xs">
                          <button
                            type="button"
                            onClick={() => handleSaveScheduleItem(item.id)}
                            className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 font-medium text-white hover:bg-blue-700"
                          >
                            <Save className="h-3.5 w-3.5" />
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingScheduleId(null)}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
                          >
                            <X className="h-3.5 w-3.5" />
                            Cancel
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={item.id}
                      className="flex items-start justify-between gap-2 py-3.5 px-2 hover:bg-slate-50 rounded-lg transition-colors"
                    >
                      <button
                        type="button"
                        onClick={() => toggleCheck(item.id)}
                        className="flex flex-1 items-start gap-3 text-left min-w-0"
                      >
                        {checked ? (
                          <CheckSquare className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                        ) : (
                          <Square className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span className="font-mono font-semibold text-slate-800">{item.time}</span>
                            <span aria-hidden="true">·</span>
                            <span>{item.period}</span>
                            <span aria-hidden="true">·</span>
                            <span>{item.category}</span>
                          </div>
                          <div
                            className={`mt-1 text-sm font-medium ${
                              checked ? 'line-through text-slate-400' : 'text-slate-900'
                            }`}
                          >
                            {item.title}
                          </div>
                          <p className="mt-1 text-xs text-slate-600 leading-relaxed">{item.details}</p>
                        </div>
                      </button>

                      <div className="flex items-center gap-1 shrink-0 pt-0.5">
                        <button
                          type="button"
                          onClick={() => handleStartEditSchedule(item)}
                          className="rounded p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700"
                          aria-label={`Edit ${item.title}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteScheduleItem(item.id)}
                          className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                          aria-label={`Delete ${item.title}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </DashboardCard>

            <div className="lg:col-span-5 space-y-6">
              <DashboardCard
                title="Dermatologist Appointment Reminder (.ics)"
                subtitle="Export a calendar event with a 24-hour reminder alarm for your clinician visit."
              >
                <form onSubmit={handleExportIcs} className="space-y-3">
                  <label className="block">
                    <span className="text-xs font-medium text-slate-700">Appointment Title</span>
                    <input
                      type="text"
                      value={apptTitle}
                      onChange={(e) => setApptTitle(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-slate-700">Date &amp; Time</span>
                    <input
                      type="datetime-local"
                      value={apptDateTime}
                      onChange={(e) => setApptDateTime(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-slate-700">Clinic / Location</span>
                    <input
                      type="text"
                      value={apptClinic}
                      onChange={(e) => setApptClinic(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </label>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 whitespace-nowrap"
                  >
                    <CalendarPlus className="h-4 w-4" />
                    Export .ics Calendar Invite
                  </button>
                  {icsStatus && <div className="text-xs text-emerald-700">{icsStatus}</div>}
                </form>
              </DashboardCard>

              <DashboardCard
                title="ABCDE Self-Monitoring Log"
                subtitle="Track Asymmetry, Border, Color, Diameter, and Evolution notes locally in your browser."
              >
                <form onSubmit={addAbcdeEntry} className="space-y-3">
                  <input
                    type="text"
                    placeholder="Lesion location (e.g. Left forearm)"
                    value={newLogSite}
                    onChange={(e) => setNewLogSite(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                  <div className="flex flex-wrap gap-3 text-xs">
                    {['A', 'B', 'C', 'D', 'E'].map((letter) => (
                      <label key={letter} className="inline-flex items-center gap-1.5 font-mono">
                        <input
                          type="checkbox"
                          checked={newLogFlags[letter]}
                          onChange={(e) =>
                            setNewLogFlags({ ...newLogFlags, [letter]: e.target.checked })
                          }
                        />
                        {letter}
                      </label>
                    ))}
                  </div>
                  <input
                    type="text"
                    placeholder="Observation notes (size in mm, color shift, itching)"
                    value={newLogNotes}
                    onChange={(e) => setNewLogNotes(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Log Observation
                  </button>
                </form>

                <div className="mt-4 space-y-2 max-h-56 overflow-y-auto">
                  {abcdeLogs.length === 0 ? (
                    <p className="text-xs text-slate-500">No ABCDE entries logged yet.</p>
                  ) : (
                    abcdeLogs.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-start justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs"
                      >
                        <div>
                          <div className="font-semibold text-slate-900">
                            {entry.site} · <span className="font-mono text-slate-500">{entry.date}</span>
                          </div>
                          {entry.flags.length > 0 && (
                            <div className="mt-0.5 font-mono text-amber-800">
                              Noted ABCDE criteria: {entry.flags.join(', ')}
                            </div>
                          )}
                          <p className="mt-1 text-slate-600">{entry.notes}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteAbcdeEntry(entry.id)}
                          className="text-slate-400 hover:text-rose-600"
                          aria-label="Delete log entry"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </DashboardCard>
            </div>
          </div>

          <DashboardCard
            title="7-Day Preventive Routine Planner (Editable)"
            subtitle={`Customize your weekly photoprotection and observation cadence. Edits are saved automatically in your browser.${
              customWeeklyPlan ? ' (Customized)' : ''
            }`}
            action={
              customWeeklyPlan && (
                <button
                  type="button"
                  onClick={handleResetWeekly}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset Planner to Default
                </button>
              )
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs text-slate-500">
                    <th className="py-2.5 pr-4 font-medium">Day</th>
                    <th className="py-2.5 pr-4 font-medium">Primary Focus</th>
                    <th className="py-2.5 pr-4 font-medium">Key Habits</th>
                    <th className="py-2.5 text-right font-medium">Edit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {displayedWeeklyPlan.map((d) => {
                    const isEditing = editingDay === d.day;
                    return (
                      <tr key={d.day} className="align-top">
                        <td className="py-3 pr-4 font-semibold text-slate-900 whitespace-nowrap">
                          {d.day}
                        </td>
                        <td className="py-3 pr-4 font-medium text-slate-800">
                          {isEditing ? (
                            <input
                              type="text"
                              value={dayDraft.primaryFocus}
                              onChange={(e) =>
                                setDayDraft({ ...dayDraft, primaryFocus: e.target.value })
                              }
                              aria-label={`${d.day} primary focus`}
                              className="w-full min-w-[200px] rounded-md border border-slate-300 px-2.5 py-1.5 text-xs"
                            />
                          ) : (
                            d.primaryFocus
                          )}
                        </td>
                        <td className="py-3 pr-4 text-slate-600">
                          {isEditing ? (
                            <div>
                              <textarea
                                rows={3}
                                value={dayDraft.tasksText}
                                onChange={(e) =>
                                  setDayDraft({ ...dayDraft, tasksText: e.target.value })
                                }
                                aria-label={`${d.day} key habits (one per line)`}
                                className="w-full min-w-[260px] rounded-md border border-slate-300 px-2.5 py-1.5 text-xs"
                              />
                              <div className="mt-1 text-[11px] text-slate-400">
                                Enter one habit per line
                              </div>
                            </div>
                          ) : (
                            d.tasks.join(' · ')
                          )}
                        </td>
                        <td className="py-3 text-right whitespace-nowrap">
                          {isEditing ? (
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleSaveDay(d.day)}
                                className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1 font-medium text-white hover:bg-blue-700"
                              >
                                <Save className="h-3 w-3" />
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingDay(null)}
                                className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-50"
                              >
                                <X className="h-3 w-3" />
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleStartEditDay(d)}
                              className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-50"
                              aria-label={`Edit ${d.day} plan`}
                            >
                              <Pencil className="h-3 w-3" />
                              Edit
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </DashboardCard>
        </>
      )}
    </div>
  );
}
