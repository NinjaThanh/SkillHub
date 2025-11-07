import React, { memo, useMemo } from 'react';
import { View, Text, Platform, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TAB_DEFS, INACTIVE, TabKey } from '../Home.tsx';
import { COLORS } from '../../config/AppConfig';

type Props = {
    active: TabKey;
    onChange: (tab: TabKey) => void;
};
function hexToRgba(hex: string, alpha: number) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!m) return `rgba(0,0,0,${alpha})`;
    const r = parseInt(m[1], 16);
    const g = parseInt(m[2], 16);
    const b = parseInt(m[3], 16);
    return `rgba(${r},${g},${b},${alpha})`;
}
const BottomTabBar: React.FC<Props> = ({ active, onChange }) => {
    const insets = useSafeAreaInsets();
    const barPaddingBottom = useMemo(
        () => Math.max(Platform.select({ ios: 12, android: 16 }) ?? 12, insets.bottom * 0.6),
        [insets.bottom]
    );
    return (
        <View
            style={{
                paddingHorizontal: 18,
                paddingTop: 8,
                paddingBottom: barPaddingBottom,
                borderTopWidth: 1,
                borderTopColor: '#E9EEF2',
                backgroundColor: '#fff',
                flexDirection: 'row',
                justifyContent: 'space-between',
            }}
        >
            {TAB_DEFS.map((tab) => {
                const isActive = active === tab.key;
                const iconBg = isActive
                    ? hexToRgba(COLORS.primary ?? '#24786D', 0.14) // ~alpha 14%
                    : '#F2F5F7';
                const iconColor = isActive ? (COLORS.primary ?? '#24786D') : INACTIVE;
                const labelColor = iconColor;

                return (
                    <Pressable
                        key={tab.key}
                        onPress={() => onChange(tab.key)}
                        android_ripple={{ color: hexToRgba('#000000', 0.08), borderless: true }}
                        style={{ alignItems: 'center', flex: 1 }}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: isActive }}
                        accessibilityLabel={tab.label}
                        hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                    >
                        <View
                            style={{
                                width: 44,
                                height: 44,
                                borderRadius: 22,
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: iconBg,
                            }}
                        >
                            <Text
                                style={{
                                    fontSize: 20,
                                    color: iconColor,
                                    // Giúp icon text (emoji) căn đẹp trên Android
                                    includeFontPadding: false,
                                    textAlignVertical: 'center',
                                } as any}
                            >
                                {tab.icon}
                            </Text>
                        </View>
                        <Text
                            style={{
                                marginTop: 6,
                                fontSize: 12,
                                fontWeight: isActive ? '800' as const : '600' as const,
                                color: labelColor,
                                includeFontPadding: false,
                            } as any}
                            numberOfLines={1}
                        >
                            {tab.label}
                        </Text>
                    </Pressable>
                );
            })}
        </View>
    );
};
export default memo(BottomTabBar);
