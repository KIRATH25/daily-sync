import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Check, SlidersHorizontal } from '@/components/ui/icons';

import { Text } from '@/components/ui/Text';
import type { Palette } from '@/theme/palette';
import { radius, space } from '@/theme/tokens';

/**
 * Miniature dashboard rendered with an explicit palette (not the global
 * theme) so Theme Studio can preview a candidate before it is applied.
 */
export const ThemePreview = memo(function ThemePreview({
  palette,
  labels,
}: {
  palette: Palette;
  labels: { docket: string; focus: string; tasks: string; sample: string; synced: string };
}) {
  return (
    <View style={[styles.root, { backgroundColor: palette.background, borderColor: palette.border }]}>
      <View style={styles.row}>
        <SlidersHorizontal size={14} color={palette.text} />
        <Text variant="smallStrong" color={palette.text} style={styles.flex}>
          {labels.docket}
        </Text>
        <Text variant="micro" color={palette.textSecondary} latin>
          09:41
        </Text>
      </View>
      <View style={styles.tiles}>
        <View style={[styles.tile, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <Text variant="micro" color={palette.textSecondary}>
            {labels.focus}
          </Text>
          <Text variant="h2" color={palette.text} latin>
            4.8
          </Text>
          <View style={[styles.bar, { backgroundColor: palette.elevated }]}>
            <View style={[styles.barFill, { backgroundColor: palette.accent }]} />
          </View>
        </View>
        <View style={[styles.tile, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <Text variant="micro" color={palette.textSecondary}>
            {labels.tasks}
          </Text>
          <Text variant="h2" color={palette.text} latin>
            12
            <Text variant="small" color={palette.textSecondary} latin>
              {' / 14'}
            </Text>
          </Text>
          <View style={[styles.spark, { borderColor: palette.accentText }]} />
        </View>
      </View>
      <View style={[styles.task, { backgroundColor: palette.surfaceAlt }]}>
        <View style={[styles.check, { backgroundColor: palette.accent }]}>
          <Check size={11} color={palette.onAccent} strokeWidth={3} />
        </View>
        <Text variant="small" color={palette.text} style={styles.flex} numberOfLines={1}>
          {labels.sample}
        </Text>
        <View style={[styles.pill, { backgroundColor: palette.highlight }]}>
          <Text variant="micro" color={palette.onHighlight}>
            {labels.synced}
          </Text>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: { borderRadius: radius.lg, padding: space.md, gap: space.sm, borderWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  tiles: { flexDirection: 'row', gap: space.sm },
  tile: { flex: 1, padding: space.md, borderRadius: radius.md, gap: 4, borderWidth: StyleSheet.hairlineWidth },
  bar: { height: 5, borderRadius: 3, overflow: 'hidden' },
  barFill: { width: '78%', height: '100%', borderRadius: 3 },
  spark: { height: 10, borderBottomWidth: 2, borderRightWidth: 2, borderBottomRightRadius: 10, width: '70%', alignSelf: 'flex-end' },
  task: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.sm, borderRadius: radius.sm },
  check: { width: 18, height: 18, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  pill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
});
