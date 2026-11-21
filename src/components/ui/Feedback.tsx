/**
 * App-wide feedback: toasts (with optional Undo) and confirmation dialogs.
 * `useFeedback()` gives any screen `toast()` and an awaitable `confirm()`.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertTriangle, CheckCircle2, Info } from '@/components/ui/icons';

import { useHaptics } from '@/hooks/useHaptics';
import { useI18n } from '@/i18n';
import { usePalette, useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

import { PremiumButton } from './Button';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

type ToastTone = 'success' | 'error' | 'info';

interface ToastState {
  id: number;
  message: string;
  tone: ToastTone;
  actionLabel?: string;
  onAction?: () => void;
}

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

interface FeedbackContextValue {
  toast: (message: string, options?: { tone?: ToastTone; actionLabel?: string; onAction?: () => void }) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const palette = usePalette();
  const { reduceMotion } = useTheme();
  const { t } = useI18n();
  const { fire } = useHaptics();
  const insets = useSafeAreaInsets();
  const [toastState, setToast] = useState<ToastState | null>(null);
  const [dialog, setDialog] = useState<(ConfirmOptions & { resolve: (value: boolean) => void }) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const counter = useRef(0);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const toast = useCallback<FeedbackContextValue['toast']>(
    (message, options) => {
      if (timer.current) clearTimeout(timer.current);
      const tone = options?.tone ?? 'success';
      if (tone === 'error') fire('error');
      counter.current += 1;
      setToast({ id: counter.current, message, tone, actionLabel: options?.actionLabel, onAction: options?.onAction });
      timer.current = setTimeout(() => setToast(null), options?.actionLabel ? 5000 : 2600);
    },
    [fire],
  );

  const confirm = useCallback<FeedbackContextValue['confirm']>((options) => {
    return new Promise<boolean>((resolve) => setDialog({ ...options, resolve }));
  }, []);

  const closeDialog = (result: boolean) => {
    if (result && dialog?.destructive) fire('warning');
    dialog?.resolve(result);
    setDialog(null);
  };

  const value = useMemo(() => ({ toast, confirm }), [toast, confirm]);
  const ToneIcon = toastState?.tone === 'error' ? AlertTriangle : toastState?.tone === 'info' ? Info : CheckCircle2;

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      {toastState ? (
        <Animated.View
          key={toastState.id}
          entering={reduceMotion ? FadeIn : SlideInDown.springify().damping(18)}
          exiting={reduceMotion ? FadeOut : SlideOutDown.duration(200)}
          style={[styles.toastWrap, { bottom: insets.bottom + 96 }]}
          pointerEvents="box-none"
          accessibilityLiveRegion="polite"
        >
          <View style={[styles.toast, { backgroundColor: palette.elevated, borderColor: palette.borderStrong }]}>
            <ToneIcon
              size={18}
              color={toastState.tone === 'error' ? palette.dangerText : palette.accentText}
              strokeWidth={2.2}
            />
            <Text variant="smallStrong" style={styles.toastText} numberOfLines={3}>
              {toastState.message}
            </Text>
            {toastState.actionLabel ? (
              <PressableScale
                onPress={() => {
                  toastState.onAction?.();
                  setToast(null);
                }}
                accessibilityLabel={toastState.actionLabel}
                hitSlop={10}
              >
                <Text variant="smallStrong" tone="accent">
                  {toastState.actionLabel}
                </Text>
              </PressableScale>
            ) : null}
          </View>
        </Animated.View>
      ) : null}
      <Modal transparent visible={!!dialog} animationType="fade" onRequestClose={() => closeDialog(false)} statusBarTranslucent>
        <Pressable style={[styles.dialogBackdrop, { backgroundColor: palette.overlay }]} onPress={() => closeDialog(false)}>
          {dialog ? (
            <Animated.View entering={reduceMotion ? FadeIn : ZoomIn.springify().damping(18)}>
              <Pressable style={[styles.dialog, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                <Text variant="h3" accessibilityRole="header">
                  {dialog.title}
                </Text>
                {dialog.message ? (
                  <Text variant="body" tone="secondary">
                    {dialog.message}
                  </Text>
                ) : null}
                <View style={styles.dialogActions}>
                  <PremiumButton
                    label={dialog.cancelLabel ?? t('common.cancel')}
                    variant="secondary"
                    size="md"
                    onPress={() => closeDialog(false)}
                    style={styles.flex}
                    haptic={null}
                  />
                  <PremiumButton
                    label={dialog.confirmLabel ?? t('common.confirm')}
                    variant={dialog.destructive ? 'danger' : 'primary'}
                    size="md"
                    onPress={() => closeDialog(true)}
                    style={styles.flex}
                    haptic={null}
                  />
                </View>
              </Pressable>
            </Animated.View>
          ) : null}
        </Pressable>
      </Modal>
    </FeedbackContext.Provider>
  );
}

export function useFeedback(): FeedbackContextValue {
  const context = useContext(FeedbackContext);
  if (!context) throw new Error('useFeedback must be used inside FeedbackProvider');
  return context;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  toastWrap: { position: 'absolute', left: space.gutter, right: space.gutter, alignItems: 'center' },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm + 2,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: 520,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  toastText: { flexShrink: 1 },
  dialogBackdrop: { flex: 1, justifyContent: 'center', padding: space.xxl },
  dialog: {
    borderRadius: radius.lg,
    padding: space.xl,
    gap: space.md,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: 480,
    alignSelf: 'center',
    width: '100%',
  },
  dialogActions: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
});
