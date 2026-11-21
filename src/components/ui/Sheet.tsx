import { useEffect, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { GestureDetector, GestureHandlerRootView, ScrollView, usePanGesture } from 'react-native-gesture-handler';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from '@/components/ui/icons';

import { useI18n } from '@/i18n';
import { usePalette, useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';

import { IconButton } from './IconButton';
import { Text } from './Text';

export interface DSBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  /** Content below the scroll area (primary actions) */
  footer?: ReactNode;
  /** Max height as fraction of the screen */
  maxHeight?: number;
  scroll?: boolean;
}

/**
 * Bottom sheet built on RN Modal: slides up with a spring, dims the
 * background, closes on backdrop tap, Android back, or a downward drag on
 * the handle. Keyboard-aware so inputs and the footer stay visible.
 */
export function DSBottomSheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxHeight = 0.9,
  scroll = true,
}: DSBottomSheetProps) {
  const palette = usePalette();
  const { reduceMotion } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  // Stay mounted while the close animation runs; mount immediately on open
  // (state adjusted during render rather than in an effect).
  const [mounted, setMounted] = useState(visible);
  if (visible && !mounted) setMounted(true);
  const translate = useSharedValue(height);
  const backdrop = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translate.set(height);
      const frame = requestAnimationFrame(() => {
        translate.set(reduceMotion ? withTiming(0, { duration: 160 }) : withSpring(0, { damping: 22, stiffness: 210, mass: 0.9 }));
        backdrop.set(withTiming(1, { duration: 220 }));
      });
      return () => cancelAnimationFrame(frame);
    }
    backdrop.set(withTiming(0, { duration: 180 }));
    translate.set(
      withTiming(height, { duration: 220, easing: Easing.in(Easing.cubic) }, (finished) => {
        if (finished) runOnJS(setMounted)(false);
      }),
    );
    return undefined;
  }, [visible, height, reduceMotion, translate, backdrop]);

  const pan = usePanGesture({
    activeOffsetY: [-1000, 8],
    onUpdate: (event) => {
      'worklet';
      translate.set(Math.max(0, event.translationY));
    },
    onDeactivate: (event) => {
      'worklet';
      if (event.translationY > 110 || event.velocityY > 900) {
        runOnJS(onClose)();
      } else {
        translate.set(withSpring(0, { damping: 20, stiffness: 240 }));
      }
    },
  });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translate.get() }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.get() }));

  if (!mounted) return null;

  return (
    <Modal transparent visible={mounted} onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent animationType="none">
      {/* Modals render outside the app's root view, so gestures need their own root on Android. */}
      <GestureHandlerRootView style={styles.flex}>
      {/* Edge-to-edge Android no longer resizes the window for the keyboard, so pad on both platforms. */}
      <KeyboardAvoidingView style={styles.container} behavior="padding">
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: palette.overlay }, backdropStyle]}>
          <Pressable style={styles.flex} onPress={onClose} accessibilityLabel={t('common.close')} accessibilityRole="button" />
        </Animated.View>
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: palette.surface,
              maxHeight: height * maxHeight,
              paddingBottom: Math.max(insets.bottom, space.lg),
              borderColor: palette.border,
            },
            sheetStyle,
          ]}
          accessibilityViewIsModal
        >
          <GestureDetector gesture={pan}>
            <View style={styles.handleArea}>
              <View style={[styles.handle, { backgroundColor: palette.borderStrong }]} />
              {title ? (
                <View style={styles.header}>
                  <View style={styles.headerText}>
                    <Text variant="h2" accessibilityRole="header">
                      {title}
                    </Text>
                    {subtitle ? (
                      <Text variant="small" tone="secondary">
                        {subtitle}
                      </Text>
                    ) : null}
                  </View>
                  <IconButton icon={X} label={t('common.close')} onPress={onClose} size={38} />
                </View>
              ) : null}
            </View>
          </GestureDetector>
          {scroll ? (
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.content}
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>
          ) : (
            <View style={styles.content}>{children}</View>
          )}
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </Animated.View>
      </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
  },
  handleArea: { paddingTop: space.sm, paddingHorizontal: space.gutter },
  handle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, marginBottom: space.md },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingBottom: space.md },
  headerText: { flex: 1, gap: 2 },
  content: { paddingHorizontal: space.gutter, paddingBottom: space.lg, gap: space.lg },
  footer: { paddingHorizontal: space.gutter, paddingTop: space.sm, gap: space.sm },
});
