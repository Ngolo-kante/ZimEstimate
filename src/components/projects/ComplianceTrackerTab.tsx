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
  CERTIFICATE_STATUS_META,
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
  HourglassHigh,
  PaperPlaneTilt,
  Plus,
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

  return (
    <div>
      {/* Summary Stats */}
      <div className="compliance-summary-bar">
        <div className="compliance-stat-card">
          <div className="stat-icon certificates">
            <Certificate size={22} weight="duotone" />
          </div>
          <div className="stat-text">
            <div className="stat-value">{globalStats.doneCerts}/{globalStats.totalCerts}</div>
            <div className="stat-label">Certificates</div>
          </div>
        </div>
        <div className="compliance-stat-card">
          <div className="stat-icon tasks">
            <ClipboardText size={22} weight="duotone" />
          </div>
          <div className="stat-text">
            <div className="stat-value">{globalStats.doneTasks}/{globalStats.totalTasks}</div>
            <div className="stat-label">Admin Tasks</div>
          </div>
        </div>
        <div className="compliance-stat-card">
          <div className="stat-icon completed">
            <CheckCircle size={22} weight="duotone" />
          </div>
          <div className="stat-text">
            <div className="stat-value">{globalStats.done}</div>
            <div className="stat-label">Completed</div>
          </div>
        </div>
        <div className="compliance-stat-card">
          <div className="stat-icon pending">
            <HourglassHigh size={22} weight="duotone" />
          </div>
          <div className="stat-text">
            <div className="stat-value">{globalStats.pending}</div>
            <div className="stat-label">Pending</div>
          </div>
        </div>
      </div>

      {/* Notification Channel Indicator */}
      <div className="compliance-channel-indicator">
        <span className="channel-icon">{channelInfo.icon}</span>
        <span className="channel-text">
          Reminders via <strong>{channelInfo.label}</strong>
        </span>
        {onNavigateToSettings ? (
          <button
            type="button"
            className="channel-hint-link"
            onClick={onNavigateToSettings}
          >
            Change in Settings
          </button>
        ) : (
          <span className="channel-hint">Change in Settings</span>
        )}
      </div>

      {/* Stage Sections */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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
            <section key={stage.id} className="compliance-stage-section">
              {/* Clickable Stage Header */}
              <button
                type="button"
                className="compliance-stage-header"
                onClick={() => toggleCollapse(stage.id)}
                aria-expanded={!isCollapsed}
              >
                <div>
                  <h3 className="stage-title">{STAGE_LABELS[stage.boq_category]}</h3>
                  <p className="stage-sub">
                    {requirements.length} certificate{requirements.length !== 1 ? 's' : ''} &middot;{' '}
                    {adminTasks.length} task{adminTasks.length !== 1 ? 's' : ''}
                  </p>
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
                <div className="compliance-stage-body">
                  {/* Certificates */}
                  {requirements.length > 0 && (
                    <div style={{ marginBottom: '24px' }}>
                      <div className="compliance-section-label">
                        <Certificate size={14} weight="bold" />
                        Certificates
                      </div>
                      {requirements.map((requirement) => {
                        const status = getComplianceRequirementStatus(stage.tasks, requirement.id);
                        const statusMeta = CERTIFICATE_STATUS_META[status];
                        const draftKey = `cert-${stage.id}-${requirement.id}`;
                        const isDone = status === 'done';

                        return (
                          <div
                            key={requirement.id}
                            className={`compliance-cert-row ${isDone ? 'is-done' : ''}`}
                          >
                            <div className="cert-main">
                              <div className="cert-info">
                                <span className="cert-check">
                                  <CheckCircle size={14} weight="fill" />
                                </span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div className="cert-label">{requirement.label}</div>
                                  <p className="cert-desc">{requirement.description}</p>
                                </div>
                                {requirement.required && (
                                  <span className="cert-required-badge">Required</span>
                                )}
                              </div>
                              <div className="cert-actions">
                                <span className={`compliance-status-badge ${status}`}>
                                  {statusMeta.label}
                                </span>
                                <select
                                  className="compliance-status-select"
                                  value={status}
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
                              </div>
                            </div>

                            {/* Reminder row — just date + bell, channel is shown in top banner */}
                            <div className="compliance-reminder-row">
                              <input
                                type="date"
                                value={getReminderDate(draftKey)}
                                onChange={(e) => setReminderDate(draftKey, e.target.value)}
                              />
                              <Button
                                variant="secondary"
                                size="sm"
                                icon={<Bell size={14} />}
                                onClick={() => saveReminder(requirement.label, draftKey)}
                              >
                                Remind Me
                              </Button>
                            </div>
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
                      return (
                        <div key={task.id} className={`compliance-task-row ${task.is_completed ? 'is-done' : ''}`}>
                          <div className="task-main-row">
                            <button
                              type="button"
                              className="compliance-task-toggle"
                              onClick={() => handleToggleTask(stage, task)}
                            >
                              <span className="task-check">
                                <CheckCircle size={12} weight="fill" />
                              </span>
                              <span className="task-title">{task.title}</span>
                            </button>
                            <div className="task-actions-row">
                              <div className="compliance-reminder-inline">
                                <input
                                  type="date"
                                  className="reminder-date-sm"
                                  value={getReminderDate(draftKey)}
                                  onChange={(e) => setReminderDate(draftKey, e.target.value)}
                                />
                                <button
                                  type="button"
                                  className="reminder-bell-btn"
                                  title="Set reminder"
                                  onClick={() => saveReminder(task.title, draftKey, task.id)}
                                >
                                  <Bell size={14} />
                                </button>
                              </div>
                              <button
                                className="compliance-task-delete"
                                onClick={() => handleDeleteTask(stage, task.id)}
                                aria-label="Delete task"
                              >
                                <Trash size={16} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {adminTasks.length === 0 && (
                      <p className="compliance-empty">No admin tasks yet for this stage.</p>
                    )}

                    {/* Add task form */}
                    <div className="compliance-add-task-row">
                      <input
                        placeholder="Add admin/compliance task..."
                        value={newTaskByStage[stage.id] || ''}
                        onChange={(event) =>
                          setNewTaskByStage((prev) => ({ ...prev, [stage.id]: event.target.value }))
                        }
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            handleAddTask(stage);
                          }
                        }}
                      />
                      <Button
                        variant="primary"
                        size="sm"
                        icon={<Plus size={14} />}
                        loading={Boolean(isSavingTask[stage.id])}
                        onClick={() => handleAddTask(stage)}
                      >
                        Add
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </section>
          );
        })}
      </div>

      {applicableStages.length === 0 && (
        <div className="compliance-stage-section" style={{ padding: '40px', textAlign: 'center' }}>
          <Warning size={32} style={{ color: 'var(--color-text-muted)', marginBottom: '12px' }} />
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
            No applicable stages found. Configure your project stages in{' '}
            <strong>Configurations</strong> first.
          </p>
        </div>
      )}
    </div>
  );
}
