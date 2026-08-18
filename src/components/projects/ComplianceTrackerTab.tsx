'use client';

import { useMemo, useState, useCallback } from 'react';
import { useToast } from '@/components/ui/Toast';
import Button from '@/components/ui/Button';
import { NotificationChannel } from '@/components/ui/BudgetPlanner';
import {
  BOQCategory,
  ProjectStageWithTasks,
  StageTask,
} from '@/lib/database.types';
import { createReminder } from '@/lib/services/projects';
import {
  createStageTask,
  deleteStageTask,
  toggleStageTask,
  updateStageTask,
} from '@/lib/services/stages';
import {
  buildComplianceCertificateMarker,
  ComplianceCertificateStatus,
  getComplianceRequirementStatus,
  getStageRequirements,
  isComplianceCertificateTask,
} from '@/lib/compliance';
import {
  Bell,
  CaretDown,
  CaretUp,
  Certificate,
  ChatCircleText,
  CheckCircle,
  ClipboardText,
  Envelope,
  Info,
  PaperPlaneTilt,
  Plus,
  ShieldCheck,
  Trash,
  Warning,
  WhatsappLogo,
} from '@phosphor-icons/react';

import '@/styles/compliance-tracker.css';

interface ComplianceTrackerTabProps {
  projectId: string;
  projectName: string;
  stages: ProjectStageWithTasks[];
  onStageUpdate: (updatedStage: ProjectStageWithTasks) => void;
  phoneNumber?: string | null;
  telegramChatId?: string | null;
  onRequestPhone: (payload?: { channel?: NotificationChannel }) => void;
  preferredChannel?: NotificationChannel;
  onNavigateToSettings?: () => void;
}

const STAGE_LABELS: Record<BOQCategory, string> = {
  substructure: 'Site Preparation & Foundation',
  superstructure: 'Structural Walls & Frame',
  roofing: 'Roofing',
  finishing: 'Interior & Finishing',
  exterior: 'External Work',
};

const CHANNEL_CONFIG: Record<NotificationChannel, { icon: React.ReactNode; label: string }> = {
  email: { icon: <Envelope size={16} weight="duotone" />, label: 'Email' },
  sms: { icon: <ChatCircleText size={16} weight="duotone" />, label: 'SMS' },
  whatsapp: { icon: <WhatsappLogo size={16} weight="duotone" />, label: 'WhatsApp' },
  telegram: { icon: <PaperPlaneTilt size={16} weight="duotone" />, label: 'Telegram' },
};

const tomorrowIsoDate = () => {
  const next = new Date();
  next.setDate(next.getDate() + 1);
  return next.toISOString().split('T')[0];
};

export default function ComplianceTrackerTab({
  projectId,
  projectName,
  stages,
  onStageUpdate,
  phoneNumber,
  telegramChatId,
  onRequestPhone,
  preferredChannel = 'email',
  onNavigateToSettings,
}: ComplianceTrackerTabProps) {
  const { success, error: showError } = useToast();
  const [newTaskByStage, setNewTaskByStage] = useState<Record<string, string>>({});
  const [isSavingTask, setIsSavingTask] = useState<Record<string, boolean>>({});
  const [collapsedStages, setCollapsedStages] = useState<Set<string>>(
    () => new Set(stages.filter((stage) => stage.is_applicable).slice(1).map((stage) => stage.id))
  );
  const [reminderDates, setReminderDates] = useState<Record<string, string>>({});
  const [openReminderKey, setOpenReminderKey] = useState<string | null>(null);
  const [addingTaskStageId, setAddingTaskStageId] = useState<string | null>(null);

  const applicableStages = useMemo(
    () => stages.filter((stage) => stage.is_applicable),
    [stages]
  );

  /* ---- Global stats ---- */
  const globalStats = useMemo(() => {
    let totalCerts = 0;
    let doneCerts = 0;
    let totalTasks = 0;
    let doneTasks = 0;

    applicableStages.forEach((stage) => {
      const reqs = getStageRequirements(stage.boq_category);
      totalCerts += reqs.length;
      doneCerts += reqs.filter(
        (r) => getComplianceRequirementStatus(stage.tasks, r.id) === 'done'
      ).length;

      const admin = stage.tasks.filter((t) => !isComplianceCertificateTask(t));
      totalTasks += admin.length;
      doneTasks += admin.filter((t) => t.is_completed).length;
    });

    const total = totalCerts + totalTasks;
    const done = doneCerts + doneTasks;
    const pending = total - done;
    return { totalCerts, doneCerts, totalTasks, doneTasks, total, done, pending };
  }, [applicableStages]);

  /* ---- Collapse toggle ---- */
  const toggleCollapse = useCallback((stageId: string) => {
    setCollapsedStages((prev) => {
      const next = new Set(prev);
      if (next.has(stageId)) next.delete(stageId);
      else next.add(stageId);
      return next;
    });
  }, []);

  /* ---- Reminder helpers ---- */
  const getReminderDate = (key: string) => reminderDates[key] || tomorrowIsoDate();
  const setReminderDate = (key: string, date: string) => {
    setReminderDates((prev) => ({ ...prev, [key]: date }));
  };

  const saveReminder = async (label: string, draftKey: string, itemId?: string) => {
    const channel = preferredChannel;
    const requiresPhone = channel === 'sms' || channel === 'whatsapp';
    if (requiresPhone && !phoneNumber) {
      onRequestPhone({ channel });
      return;
    }
    if (channel === 'telegram' && !telegramChatId) {
      showError('Add your Telegram chat ID in Account Settings before scheduling Telegram reminders.');
      onNavigateToSettings?.();
      return;
    }

    const message = `[${channel.toUpperCase()}] Compliance reminder for ${projectName}: ${label}`;
    const scheduledAt = new Date(`${getReminderDate(draftKey)}T09:00:00`);

    const { error } = await createReminder({
      project_id: projectId,
      item_id: itemId,
      reminder_type: 'deadline',
      message,
      scheduled_date: scheduledAt.toISOString(),
      phone_number: phoneNumber || '0000000000',
    });

    if (error) {
      showError(`Failed to schedule reminder: ${error.message}`);
      return;
    }

    success(`Reminder scheduled via ${CHANNEL_CONFIG[channel].label} for ${getReminderDate(draftKey)}`);
  };

  /* ---- Task CRUD ---- */
  const upsertStageTask = (stage: ProjectStageWithTasks, task: StageTask) => {
    const existing = stage.tasks.some((entry) => entry.id === task.id);
    const nextTasks = existing
      ? stage.tasks.map((entry) => (entry.id === task.id ? task : entry))
      : [...stage.tasks, task];
    onStageUpdate({ ...stage, tasks: nextTasks });
  };

  const handleAddTask = async (stage: ProjectStageWithTasks) => {
    const title = (newTaskByStage[stage.id] || '').trim();
    if (!title) {
      showError('Please enter a task name');
      return;
    }

    setIsSavingTask((prev) => ({ ...prev, [stage.id]: true }));

    try {
      const { task, error } = await createStageTask(stage.id, {
        title,
        description: 'Compliance/admin task',
      });

      if (error || !task) {
        showError(error?.message || 'Failed to add task. Please check your connection and try again.');
        return;
      }

      upsertStageTask(stage, task);
      setNewTaskByStage((prev) => ({ ...prev, [stage.id]: '' }));
      success('Task added');
    } catch {
      showError('An unexpected error occurred. Please try again.');
    } finally {
      setIsSavingTask((prev) => ({ ...prev, [stage.id]: false }));
    }
  };

  const handleToggleTask = async (stage: ProjectStageWithTasks, task: StageTask) => {
    const nextCompleted = !task.is_completed;
    const { task: updated, error } = await toggleStageTask(task.id, nextCompleted);
    if (error || !updated) {
      showError(error?.message || 'Failed to update task');
      return;
    }
    upsertStageTask(stage, updated);
  };

  const handleDeleteTask = async (stage: ProjectStageWithTasks, taskId: string) => {
    const { error } = await deleteStageTask(taskId);
    if (error) {
      showError(error.message);
      return;
    }
    onStageUpdate({
      ...stage,
      tasks: stage.tasks.filter((task) => task.id !== taskId),
    });
    success('Task deleted');
  };

  const handleCertificateStatusChange = async (
    stage: ProjectStageWithTasks,
    requirement: ReturnType<typeof getStageRequirements>[number],
    status: ComplianceCertificateStatus
  ) => {
    const markerPrefix = `${buildComplianceCertificateMarker(requirement.id, 'pending').split('|')[0]}`;
    const existingTask = stage.tasks.find((task) =>
      (task.verification_note || '').startsWith(markerPrefix)
    );

    const updates = {
      verification_note: buildComplianceCertificateMarker(requirement.id, status),
      is_completed: status === 'done',
      completed_at: status === 'done' ? new Date().toISOString() : null,
    };

    if (existingTask) {
      const { task: updatedTask, error } = await updateStageTask(existingTask.id, updates);
      if (error || !updatedTask) {
        showError(error?.message || 'Failed to update certificate status');
        return;
      }
      upsertStageTask(stage, updatedTask);
      success('Certificate status updated');
      return;
    }

    const { task: createdTask, error: createError } = await createStageTask(stage.id, {
      title: `Certificate: ${requirement.label}`,
      description: requirement.description,
    });
    if (createError || !createdTask) {
      showError(createError?.message || 'Failed to create certificate task');
      return;
    }

    const { task: updatedTask, error: updateError } = await updateStageTask(createdTask.id, updates);
    if (updateError || !updatedTask) {
      showError(updateError?.message || 'Failed to finalize certificate task');
      return;
    }

    upsertStageTask(stage, updatedTask);
    success('Certificate added');
  };

  /* ---- Render ---- */
  const channelInfo = CHANNEL_CONFIG[preferredChannel];
  const globalProgressPct = globalStats.total > 0
    ? Math.round((globalStats.done / globalStats.total) * 100)
    : 0;

  const nextAction = applicableStages.flatMap((stage) => {
    const certificate = getStageRequirements(stage.boq_category).find(
      (requirement) => getComplianceRequirementStatus(stage.tasks, requirement.id) !== 'done'
    );
    if (certificate) {
      return [{
        stage,
        label: certificate.label,
        type: 'Certificate',
        targetId: `compliance-cert-${stage.id}-${certificate.id}`,
      }];
    }

    const task = stage.tasks.find(
      (entry) => !isComplianceCertificateTask(entry) && !entry.is_completed
    );
    return task ? [{
      stage,
      label: task.title,
      type: 'Admin task',
      targetId: `compliance-task-${task.id}`,
    }] : [];
  })[0];

  const openStage = (stageId: string, targetId?: string) => {
    setCollapsedStages((previous) => {
      const next = new Set(previous);
      next.delete(stageId);
      return next;
    });

    if (targetId) {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          const target = document.getElementById(targetId);
          target?.focus({ preventScroll: true });
          target?.scrollIntoView({
            behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
            block: 'center',
          });
        });
      });
    }
  };

  return (
    <div className="compliance-tracker">
      <section className="compliance-overview" aria-labelledby="compliance-readiness-title">
        <div className="compliance-overview-main">
          <span className="compliance-overview-icon" aria-hidden="true">
            <ShieldCheck size={24} weight="duotone" />
          </span>
          <div className="compliance-overview-copy">
            <span className="compliance-eyebrow">Project readiness</span>
            <div className="compliance-overview-title-row">
              <h2 id="compliance-readiness-title">
                {globalStats.done} of {globalStats.total} items complete
              </h2>
              <strong>{globalProgressPct}%</strong>
            </div>
            <div
              className="compliance-overview-progress"
              role="progressbar"
              aria-label="Overall compliance progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={globalProgressPct}
            >
              <span style={{ width: `${globalProgressPct}%` }} />
            </div>
          </div>
        </div>

        <dl className="compliance-overview-counts">
          <div>
            <dt>Certificates</dt>
            <dd>{globalStats.doneCerts}/{globalStats.totalCerts}</dd>
          </div>
          <div>
            <dt>Admin tasks</dt>
            <dd>{globalStats.doneTasks}/{globalStats.totalTasks}</dd>
          </div>
          <div>
            <dt>Remaining</dt>
            <dd>{globalStats.pending}</dd>
          </div>
        </dl>

        {nextAction && (
          <button
            type="button"
            className="compliance-next-action"
            onClick={() => openStage(nextAction.stage.id, nextAction.targetId)}
          >
            <span>
              <small>Next {nextAction.type.toLowerCase()}</small>
              <strong>{nextAction.label}</strong>
            </span>
            <span className="compliance-next-stage">
              {STAGE_LABELS[nextAction.stage.boq_category]}
              <CaretDown size={16} />
            </span>
          </button>
        )}
      </section>

      <div className="compliance-channel-row">
        <span className="channel-icon" aria-hidden="true">{channelInfo.icon}</span>
        <span>Reminders: <strong>{channelInfo.label}</strong></span>
        {onNavigateToSettings && (
          <button type="button" onClick={onNavigateToSettings}>Change</button>
        )}
      </div>

      {/* Stage Sections */}
      <div className="compliance-stage-list">
        {applicableStages.map((stage) => {
          const requirements = getStageRequirements(stage.boq_category);
          const adminTasks = stage.tasks.filter((task) => !isComplianceCertificateTask(task));
          const completedCertificates = requirements.filter(
            (r) => getComplianceRequirementStatus(stage.tasks, r.id) === 'done'
          ).length;
          const completedAdminTasks = adminTasks.filter((task) => task.is_completed).length;
          const totalChecklistItems = requirements.length + adminTasks.length;
          const completedChecklistItems = completedCertificates + completedAdminTasks;
          const checklistProgressPct = totalChecklistItems > 0
            ? Math.round((completedChecklistItems / totalChecklistItems) * 100)
            : 0;
          const isCollapsed = collapsedStages.has(stage.id);

          return (
            <section key={stage.id} className={`compliance-stage-section ${checklistProgressPct === 100 ? 'is-complete' : ''}`}>
              {/* Clickable Stage Header */}
              <button
                type="button"
                className="compliance-stage-header"
                onClick={() => toggleCollapse(stage.id)}
                aria-expanded={!isCollapsed}
                aria-controls={isCollapsed ? undefined : `compliance-stage-${stage.id}`}
              >
                <div className="stage-heading">
                  <span className="stage-state" aria-hidden="true">
                    {checklistProgressPct === 100 ? <CheckCircle size={18} weight="fill" /> : <Certificate size={18} />}
                  </span>
                  <div>
                    <h3 className="stage-title">{STAGE_LABELS[stage.boq_category]}</h3>
                  <p className="stage-sub">
                    {requirements.length} certificate{requirements.length !== 1 ? 's' : ''} &middot;{' '}
                    {adminTasks.length} task{adminTasks.length !== 1 ? 's' : ''}
                  </p>
                  </div>
                </div>
                <div className="stage-progress-area">
                  <div className="stage-progress">
                    <div className="progress-label">
                      {completedChecklistItems}/{totalChecklistItems} done
                    </div>
                    <div className="progress-bar-bg">
                      <div
                        className="progress-bar-fill"
                        style={{ width: `${checklistProgressPct}%` }}
                      />
                    </div>
                  </div>
                  <span className="collapse-icon">
                    {isCollapsed ? <CaretDown size={18} /> : <CaretUp size={18} />}
                  </span>
                </div>
              </button>

              {/* Collapsible Body */}
              {!isCollapsed && (
                <div className="compliance-stage-body" id={`compliance-stage-${stage.id}`}>
                  {/* Certificates */}
                  {requirements.length > 0 && (
                    <div className="compliance-certificate-list">
                      <div className="compliance-section-label">
                        <Certificate size={14} weight="bold" />
                        Certificates
                      </div>
                      {requirements.map((requirement) => {
                        const status = getComplianceRequirementStatus(stage.tasks, requirement.id);
                        const draftKey = `cert-${stage.id}-${requirement.id}`;
                        const isDone = status === 'done';
                        const reminderOpen = openReminderKey === draftKey;

                        return (
                          <div
                            key={requirement.id}
                            id={`compliance-cert-${stage.id}-${requirement.id}`}
                            tabIndex={-1}
                            className={`compliance-cert-row ${isDone ? 'is-done' : ''}`}
                          >
                            <div className="cert-main">
                              <div className="cert-info">
                                <span className="cert-check">
                                  <CheckCircle size={14} weight="fill" />
                                </span>
                                <div className="cert-copy">
                                  <div className="cert-label">
                                    {requirement.label}
                                    {requirement.required && <span className="cert-required">Required</span>}
                                  </div>
                                  <p className="cert-desc">{requirement.description}</p>
                                </div>
                              </div>
                              <div className="cert-actions">
                                <select
                                  className={`compliance-status-select ${status}`}
                                  value={status}
                                  aria-label={`Status for ${requirement.label}`}
                                  onChange={(event) =>
                                    handleCertificateStatusChange(
                                      stage,
                                      requirement,
                                      event.target.value as ComplianceCertificateStatus
                                    )
                                  }
                                >
                                  <option value="pending">Pending</option>
                                  <option value="in_progress">In Progress</option>
                                  <option value="done">Done</option>
                                </select>
                                <button
                                  type="button"
                                  className={`compliance-icon-button ${reminderOpen ? 'is-active' : ''}`}
                                  aria-label={`Set reminder for ${requirement.label}`}
                                  aria-expanded={reminderOpen}
                                  onClick={() => setOpenReminderKey(reminderOpen ? null : draftKey)}
                                >
                                  <Bell size={17} />
                                </button>
                              </div>
                            </div>

                            {reminderOpen && (
                              <div className="compliance-reminder-panel">
                                <label htmlFor={`${draftKey}-date`}>Reminder date</label>
                                <input
                                  id={`${draftKey}-date`}
                                  type="date"
                                  value={getReminderDate(draftKey)}
                                  onChange={(event) => setReminderDate(draftKey, event.target.value)}
                                />
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  icon={<Bell size={14} />}
                                  onClick={() => saveReminder(requirement.label, draftKey)}
                                >
                                  Schedule
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Admin Tasks */}
                  <div>
                    <div className="compliance-section-label">
                      <ClipboardText size={14} weight="bold" />
                      Admin Tasks
                    </div>

                    {adminTasks.map((task) => {
                      const draftKey = `task-${task.id}`;
                      const reminderOpen = openReminderKey === draftKey;
                      return (
                        <div
                          key={task.id}
                          id={`compliance-task-${task.id}`}
                          tabIndex={-1}
                          className={`compliance-task-row ${task.is_completed ? 'is-done' : ''}`}
                        >
                          <div className="task-main-row">
                            <button
                              type="button"
                              className="compliance-task-toggle"
                              onClick={() => handleToggleTask(stage, task)}
                              aria-pressed={task.is_completed}
                            >
                              <span className="task-check">
                                <CheckCircle size={12} weight="fill" />
                              </span>
                              <span className="task-title">{task.title}</span>
                            </button>
                            <div className="task-actions-row">
                              <button
                                type="button"
                                className={`compliance-icon-button ${reminderOpen ? 'is-active' : ''}`}
                                aria-label={`Set reminder for ${task.title}`}
                                aria-expanded={reminderOpen}
                                onClick={() => setOpenReminderKey(reminderOpen ? null : draftKey)}
                              >
                                <Bell size={16} />
                              </button>
                              <button
                                type="button"
                                className="compliance-task-delete"
                                onClick={() => handleDeleteTask(stage, task.id)}
                                aria-label="Delete task"
                              >
                                <Trash size={16} />
                              </button>
                            </div>
                          </div>
                          {reminderOpen && (
                            <div className="compliance-reminder-panel">
                              <label htmlFor={`${draftKey}-date`}>Reminder date</label>
                              <input
                                id={`${draftKey}-date`}
                                type="date"
                                value={getReminderDate(draftKey)}
                                onChange={(event) => setReminderDate(draftKey, event.target.value)}
                              />
                              <Button
                                variant="secondary"
                                size="sm"
                                icon={<Bell size={14} />}
                                onClick={() => saveReminder(task.title, draftKey, task.id)}
                              >
                                Schedule
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {adminTasks.length === 0 && (
                      <p className="compliance-empty">No admin tasks yet for this stage.</p>
                    )}

                    {addingTaskStageId === stage.id ? (
                      <div className="compliance-add-task-row">
                        <label htmlFor={`add-task-${stage.id}`} className="sr-only">Task name</label>
                        <input
                          id={`add-task-${stage.id}`}
                          autoFocus
                          placeholder="Task name"
                          value={newTaskByStage[stage.id] || ''}
                          onChange={(event) =>
                            setNewTaskByStage((prev) => ({ ...prev, [stage.id]: event.target.value }))
                          }
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              handleAddTask(stage);
                            }
                            if (event.key === 'Escape') setAddingTaskStageId(null);
                          }}
                        />
                        <Button
                          variant="primary"
                          size="sm"
                          loading={Boolean(isSavingTask[stage.id])}
                          onClick={() => handleAddTask(stage)}
                        >
                          Add task
                        </Button>
                        <button type="button" className="compliance-cancel-button" onClick={() => setAddingTaskStageId(null)}>
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="compliance-add-task-trigger"
                        onClick={() => setAddingTaskStageId(stage.id)}
                      >
                        <Plus size={16} /> Add task
                      </button>
                    )}
                  </div>
                </div>
              )}
            </section>
          );
        })}
      </div>

      {applicableStages.length === 0 && (
        <div className="compliance-empty-state">
          <Warning size={28} />
          <p>
            No applicable stages found. Configure your project stages in{' '}
            <strong>Configurations</strong> first.
          </p>
        </div>
      )}

      <aside className="compliance-guidance-note">
        <Info size={17} aria-hidden="true" />
        <p>This checklist is a project aid. Confirm required approvals with your local authority and appointed professionals.</p>
      </aside>
    </div>
  );
}
