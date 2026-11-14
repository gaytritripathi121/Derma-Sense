import React, { useEffect, useState } from 'react';
import { CalendarPlus, CheckSquare, Plus, Square, Trash2 } from 'lucide-react';
import DashboardCard from '../components/DashboardCard.jsx';
import { predictionService } from '../services/predictionService.js';

const CHECKLIST_STORAGE_KEY = 'dermasense_safecorner_checklist_v1';
const ABCDE_STORAGE_KEY = 'dermasense_abcde_log_v1';

export default function SafeCorner({ prediction }) {
  const [wakeTime, setWakeTime] = useState('07:00');
  const [sleepTime, setSleepTime] = useState('22:30');
  const [sensitiveSkin, setSensitiveSkin] = useState(false);
  const [plan, setPlan] = useState(null);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [error, setError] = useState('');

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

  const fetchPlan = async () => {
    setLoadingPlan(true);
    setError('');
    try {
      const data = await predictionService.generateSafeCornerPlan({
        predictedClass: prediction?.predictedClass || null,
        isLowConfidence: prediction ? Boolean(prediction.confidenceAssessment?.isLowConfidence) : true,
        patientHistory: prediction?.patientHistory || {},
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
  }, [prediction?.reportId]);

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
        notes: prediction
          ? `Follow-up for DermaSense AI screening ${prediction.reportId} (${prediction.predictedClass}, ${prediction.confidencePercentage}%).`
          : 'Bring ABCDE self-monitoring log to dermatology consultation.',
      });
      setIcsStatus('Downloaded dermasense-followup.ics calendar invite.');
    } catch (err) {
      setIcsStatus(err.message || 'Failed to export calendar reminder.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <h1 className="text-xl font-bold text-slate-900">
              Safe Corner — Supportive Skin Care &amp; Follow-Up Companion
            </h1>
            <p className="mt-1 text-sm text-slate-600 leading-relaxed">
              Non-prescriptive photoprotection routines, interactive daily habits, ABCDE observation logging, and dermatology appointment scheduling. Never replaces clinical treatment.
            </p>
          </div>
          {prediction && (
            <div className="text-right text-xs font-mono text-slate-600">
              <div>Linked Screening: {prediction.reportId}</div>
              <div>
                {prediction.predictedClass} · {prediction.confidencePercentage}%
              </div>
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
            {loadingPlan ? 'Updating...' : 'Update Daily Schedule'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm text-rose-800">
          {error}
        </div>
      )}

      {plan && (
        <>
          <div
            className={`rounded-xl border px-5 py-4 text-sm ${
              plan.canUseDiseaseSpecific
                ? 'border-blue-200 bg-blue-50 text-blue-950'
                : 'border-amber-300 bg-amber-50 text-amber-950'
            }`}
          >
            <div className="font-semibold">{plan.conditionGuidance.headline}</div>
            <p className="mt-1 text-xs leading-relaxed opacity-90">{plan.conditionGuidance.reason}</p>
            <ul className="mt-3 list-disc pl-5 space-y-1 text-xs">
              {plan.conditionGuidance.actionItems.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <DashboardCard
              className="lg:col-span-7"
              title="Daily Skin Protection Checklist"
              subtitle={`Completed today (${todayKey}): ${checkedIds.length}/${plan.schedule.length} items`}
            >
              <div className="divide-y divide-slate-100">
                {plan.schedule.map((item) => {
                  const checked = checkedIds.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggleCheck(item.id)}
                      className="flex w-full items-start gap-3 py-3.5 text-left hover:bg-slate-50 rounded-lg px-2 transition-colors"
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
            title="7-Day Preventive Routine Planner"
            subtitle="Structured weekly photoprotection and observation cadence."
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs text-slate-500">
                    <th className="py-2.5 pr-4 font-medium">Day</th>
                    <th className="py-2.5 pr-4 font-medium">Primary Focus</th>
                    <th className="py-2.5 font-medium">Key Habits</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {plan.weeklyPlan.map((d) => (
                    <tr key={d.day}>
                      <td className="py-3 pr-4 font-semibold text-slate-900 whitespace-nowrap">{d.day}</td>
                      <td className="py-3 pr-4 font-medium text-slate-800">{d.primaryFocus}</td>
                      <td className="py-3 text-slate-600">{d.tasks.join(' · ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DashboardCard>
        </>
      )}
    </div>
  );
}
