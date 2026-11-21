import { useCallback } from 'react';

import { useFeedback } from '@/components/ui/Feedback';
import { setTaskCompleted } from '@/db/repositories/tasksRepo';
import { useI18n } from '@/i18n';
import type { Task } from '@/types/models';

import { useToday } from './useClock';

/** Toggle completion with an Undo toast; errors are surfaced, not swallowed. */
export function useTaskActions() {
  const today = useToday();
  const { toast } = useFeedback();
  const { t } = useI18n();

  const toggle = useCallback(
    async (task: Task) => {
      const completing = task.completedAt == null;
      try {
        const result = await setTaskCompleted(task.id, completing, today);
        if (completing) {
          toast(result.nextTaskId ? t('tasks.completedNext') : t('tasks.completedToast'), {
            actionLabel: t('common.undo'),
            onAction: () => {
              setTaskCompleted(task.id, false, today).catch(() => toast(t('error.saveFailed'), { tone: 'error' }));
            },
          });
        }
      } catch (error) {
        console.error('Task toggle failed', error);
        toast(t('error.saveFailed'), { tone: 'error' });
      }
    },
    [today, toast, t],
  );

  return { toggle };
}
