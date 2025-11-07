// ./tabs/components/MyJobsTab.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    View,
    Text,
    TextInput,
    Pressable,
    Image,
    FlatList,
    ListRenderItemInfo,
    Platform,
    Modal,
    ScrollView,
    SafeAreaView,
    Alert,
    Animated,
    PanResponder,
    Dimensions,
    Easing,
    StatusBar,
} from 'react-native';
import { SafeAreaInsetsContext, type EdgeInsets } from 'react-native-safe-area-context';
import type { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { COLORS as APP_COLORS } from '../../config/AppConfig';

export type Freelancer = {
    id: string;
    name: string;
    category: string;
    rating: number;
    avatar?: string;
    intro?: string;
    skills?: string[];
};

type Props = {
    user?: FirebaseAuthTypes.User;
    freelancers?: Freelancer[];
    onPostJob?: () => void;
    onWallet?: () => void;
    onChat?: (f: Freelancer) => void;
    onSeeAll?: () => void;
    onPressFreelancer?: (f: Freelancer) => void;
};

const COLORS = {
    text: APP_COLORS?.text ?? '#0F172A',
    primary: APP_COLORS?.primary ?? '#24786D',
    background: APP_COLORS?.background ?? '#FFFFFF',
    muted: '#9CA3AF',
    border: '#E5E7EB',
    star: '#FACC15',
    surface: '#FFFFFF',
    actionGreen: '#34D399',
    actionBlue: '#4F46E5',
    actionPurple: '#7C3AED',
    overlay: 'rgba(0,0,0,0.35)',
};

const { height: SCREEN_H } = Dimensions.get('window');
const formatVi = (n: number) => n.toFixed(1).replace('.', ',');

// --- helpers ---
const normalize = (s: string) =>
    (s || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

const StarRating: React.FC<{ value: number; size?: number }> = ({ value, size = 14 }) => {
    const full = Math.floor(value);
    const half = value - full >= 0.5 ? 1 : 0;
    const empty = 5 - full - half;
    const stars = '★'.repeat(full) + (half ? '☆' : '') + '☆'.repeat(Math.max(0, empty - (half ? 1 : 0)));
    return <Text style={{ fontSize: size, lineHeight: size + 3, color: COLORS.star, letterSpacing: 1 }}>{stars}</Text>;
};

const ActionCard: React.FC<{
    title: string;
    color: string;
    onPress?: () => void;
    emoji?: string;
    disabled?: boolean;
}> = ({ title, color, onPress, emoji = '＋', disabled = false }) => (
    <Pressable
        accessibilityRole="button"
        onPress={disabled ? undefined : onPress}
        hitSlop={10}
        android_ripple={{ color: 'rgba(255,255,255,0.25)', borderless: false }}
        style={({ pressed }) => ({
            width: 104,
            height: 104,
            borderRadius: 22,
            backgroundColor: disabled ? '#A3A3A3' : color,
            justifyContent: 'center',
            alignItems: 'center',
            opacity: pressed ? 0.9 : 1,
        })}
    >
        <Text style={{ fontSize: 28, color: 'white', marginBottom: 6 }}>{emoji}</Text>
        <Text style={{ color: 'white', fontSize: 14, fontWeight: '700', textAlign: 'center' }} numberOfLines={2}>
            {title}
        </Text>
    </Pressable>
);

const Avatar: React.FC<{ uri?: string; size?: number }> = ({ uri, size = 44 }) =>
    uri ? (
        <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#F3F4F6' }} />
    ) : (
        <View
            style={{
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: '#F3F4F6',
                justifyContent: 'center',
                alignItems: 'center',
            }}
        >
            <Text style={{ color: COLORS.muted, fontSize: size * 0.36 }}>👤</Text>
        </View>
    );

const FreelancerCard: React.FC<{ item: Freelancer; onPress?: () => void }> = ({ item, onPress }) => (
    <Pressable
        accessibilityRole="button"
        onPress={onPress}
        hitSlop={8}
        android_ripple={{ color: 'rgba(0,0,0,0.06)' }}
        style={({ pressed }) => ({
            backgroundColor: COLORS.surface,
            borderRadius: 16,
            paddingHorizontal: 14,
            paddingVertical: 12,
            marginBottom: 12,
            borderWidth: 1,
            borderColor: 'rgba(16,24,40,0.04)',
            ...(Platform.OS === 'ios'
                ? { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } }
                : { elevation: 2 }),
            opacity: pressed ? 0.96 : 1,
        })}
    >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Avatar uri={item.avatar} />
            <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={{ color: COLORS.text, fontSize: 16, fontWeight: '700' }}>{item.name}</Text>
                <Text style={{ color: COLORS.primary, fontSize: 13, marginTop: 2 }}>{item.category}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                    <StarRating value={item.rating} />
                    <Text style={{ marginLeft: 8, color: COLORS.text, fontSize: 13, opacity: 0.8 }}>{formatVi(item.rating)}</Text>
                </View>
            </View>
        </View>
    </Pressable>
);

// Demo data (xoá nếu đã có dữ liệu thật)
const DEFAULT_ITEMS: Freelancer[] = [
    { id: '1', name: 'Kathryn Murphy', category: 'Writing', rating: 5.0, skills: ['Copywriting', 'Blog', 'SEO'], intro: '10 năm viết nội dung chuẩn SEO, tone thân thiện, đúng deadline.' },
    { id: '2', name: 'Wade Warren', category: 'Web Development', rating: 4.5, skills: ['React', 'Node.js', 'PostgreSQL'], intro: 'Full-stack web, tối ưu performance & SEO.' },
    { id: '3', name: 'Cody Fisher', category: 'UI/UX Design', rating: 4.8, skills: ['Figma', 'Design System', 'Prototyping'], intro: 'Thiết kế theo Material 3, handoff rõ ràng.' },
    { id: '4', name: 'Annette Black', category: 'Mobile Apps', rating: 4.7, skills: ['Flutter', 'Firebase', 'CI/CD'], intro: 'Build & publish iOS/Android, kinh nghiệm 20+ apps.' },
    { id: '5', name: 'Jenny Wilson', category: 'Data Analysis', rating: 4.6, skills: ['Python', 'SQL', 'Power BI'], intro: 'Phân tích dữ liệu nghiệp vụ, dashboard dễ hiểu.' },
    { id: '6', name: 'Guy Hawkins', category: 'DevOps', rating: 4.9, skills: ['Docker', 'K8s', 'AWS'], intro: 'Thiết kế hạ tầng, tối ưu CI/CD, bảo mật.' },
];
const Chip: React.FC<{ label: string }> = ({ label }) => (
    <View
        style={{
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: COLORS.border,
            backgroundColor: '#F9FAFB',
            marginRight: 8,
            marginBottom: 8,
        }}
    >
        <Text style={{ color: COLORS.text, fontSize: 12 }}>{label}</Text>
    </View>
);
const SearchBar: React.FC<{ value: string; onChange: (s: string) => void; onSubmit?: () => void }> = ({value, onChange, onSubmit}) => (
    <View
        style={{
            flexDirection: 'row',
            alignItems: 'center',
            height: 44,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: COLORS.border,
            backgroundColor: '#FFFFFF',
            paddingHorizontal: 12,
        }}
    >
        <Text style={{ fontSize: 16, marginRight: 6, color: '#111827' }}>🔍</Text>
        <TextInput
            value={value}
            onChangeText={onChange}
            onSubmitEditing={onSubmit}
            placeholder="Search jobs..."
            placeholderTextColor="#9CA3AF"
            style={{ flex: 1, fontSize: 14, color: COLORS.text, paddingVertical: 0 }}
            returnKeyType="search"
        />
    </View>
);
const MyJobsTab: React.FC<Props> = ({freelancers, onPostJob, onWallet, onChat, onSeeAll, onPressFreelancer,}) => {
    const insetsFromCtx = React.useContext(SafeAreaInsetsContext);
    const insets: EdgeInsets = insetsFromCtx ?? { top: 0, bottom: 0, left: 0, right: 0 };
    const [expanded, setExpanded] = useState(false);
    const [selected, setSelected] = useState<Freelancer | null>(null);
    const [showDetail, setShowDetail] = useState(false);
    const [query, setQuery] = useState('');
    const INITIAL_COUNT = 4;
    const { SNAP_TOP, SNAP_MID, SNAP_MIN, SNAP_MAX } = useMemo(() => {
        const top = Math.max(insets.top - 8, 0);
        const mid = SCREEN_H * 0.40;
        const max = SCREEN_H * 0.86;
        return { SNAP_TOP: top, SNAP_MID: mid, SNAP_MIN: top, SNAP_MAX: max };
    }, [insets.top]);
    const baseData = freelancers?.length ? freelancers : DEFAULT_ITEMS;
    const filteredData = useMemo(() => {
        const q = normalize(query.trim());
        if (!q) return baseData;
        return baseData.filter((f) => {
            const hay = normalize(f.name) + ' ' + normalize(f.category) + ' ' + normalize((f.skills || []).join(' '));
            return hay.includes(q);
        });
    }, [baseData, query]);
    const visibleData = useMemo(
        () => (expanded ? filteredData : filteredData.slice(0, INITIAL_COUNT)),
        [expanded, filteredData]
    );
    const handleSeeAll = () => (onSeeAll ? onSeeAll() : setExpanded((v) => !v));
    const seeAllLabel = onSeeAll ? 'Xem tất cả' : expanded ? 'Thu gọn' : 'Xem tất cả';
    const sheetY = useRef(new Animated.Value(SNAP_MID)).current;
    const dragOffsetY = useRef(0);
    const animateTo = (toY: number) => {
        Animated.timing(sheetY, {
            toValue: toY,
            duration: 220,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
        }).start(() => {
            dragOffsetY.current = toY;
        });
    };
    const openDetail = (item: Freelancer) => {
        if (onPressFreelancer) return onPressFreelancer(item);
        setSelected(item);
        setShowDetail(true);
        sheetY.setValue(SNAP_MID);
        dragOffsetY.current = SNAP_MID;
    };
    const handleQuickChat = () => {
        if (!selected) {
            Alert.alert('Chọn freelancer', 'Hãy chạm vào một freelancer trước, rồi bấm Chat.');
            return;
        }
        onChat?.(selected);
    };
    const snapToNearest = () => {
        const y = dragOffsetY.current;
        if (y > SCREEN_H * 0.78) {
            setShowDetail(false);
            return;
        }
        const dTop = Math.abs(y - SNAP_TOP);
        const dMid = Math.abs(y - SNAP_MID);
        animateTo(dTop < dMid ? SNAP_TOP : SNAP_MID);
    };
    const panResponder = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: (_evt, g) => Math.abs(g.dy) > 4,
            onPanResponderGrant: () => {
                sheetY.stopAnimation((val: number) => {
                    dragOffsetY.current = val;
                });
            },
            onPanResponderMove: (_evt, g) => {
                const next = Math.min(Math.max(dragOffsetY.current + g.dy, SNAP_MIN), SNAP_MAX);
                sheetY.setValue(next);
            },
            onPanResponderRelease: (_evt, g) => {
                dragOffsetY.current = Math.min(Math.max(dragOffsetY.current + g.dy, SNAP_MIN), SNAP_MAX);
                snapToNearest();
            },
            onPanResponderTerminate: () => {
                snapToNearest();
            },
        })
    ).current;
    const sheetStyle = {
        position: 'absolute' as const,
        left: 0,
        right: 0,
        top: sheetY,
        backgroundColor: COLORS.surface,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingHorizontal: 16,
        paddingBottom: 16,
        ...(Platform.OS === 'ios'
            ? { shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: -4 } }
            : { elevation: 10 }),
    };
    useEffect(() => {
        StatusBar.setBarStyle(showDetail ? 'light-content' : 'dark-content', true);
        if (Platform.OS === 'android') {
            StatusBar.setBackgroundColor(showDetail ? '#00000055' : 'transparent', true);
            StatusBar.setTranslucent(true);
        }
        return () => {
            StatusBar.setBarStyle('dark-content', true);
            if (Platform.OS === 'android') {
                StatusBar.setBackgroundColor('transparent', true);
                StatusBar.setTranslucent(true);
            }
        };
    }, [showDetail]);
    const bottomSafe = (insets.bottom ?? 0) + 56; // chỗ trống cho tab bar
    return (
        <View style={{ flex: 1, backgroundColor: COLORS.background, paddingHorizontal: 16 }}>
            <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
            {/* SEARCH */}
            <View style={{ paddingTop: 8, paddingBottom: 12 }}>
                <SearchBar value={query} onChange={setQuery} />
            </View>
            {/* ACTIONS */}
            <View style={{ paddingBottom: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <ActionCard title="Đăng việc" color={COLORS.actionGreen} emoji="＋" onPress={onPostJob} />
                    <ActionCard title="Nạp/Rút tiền" color={COLORS.actionBlue} emoji="💳" onPress={onWallet} />
                    <ActionCard title="Chat" color={COLORS.actionPurple} emoji="💬" onPress={handleQuickChat} disabled={!selected} />
                </View>
                {selected && (
                    <Text style={{ marginTop: 8, textAlign: 'right', color: COLORS.muted, fontSize: 12 }}>
                        Đã chọn: {selected.name} • {selected.category}
                    </Text>
                )}
            </View>
            {}
            <FlatList
                data={visibleData}
                keyExtractor={(it) => it.id}
                renderItem={({ item }: ListRenderItemInfo<Freelancer>) => (
                    <FreelancerCard item={item} onPress={() => openDetail(item)} />
                )}
                ListHeaderComponent={
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, marginBottom: 12 }}>
                        <Text style={{ color: COLORS.text, fontSize: 18, fontWeight: '800' }}>Freelancers</Text>
                        <Pressable hitSlop={8} onPress={handleSeeAll}>
                            <Text style={{ color: COLORS.primary, fontSize: 14, fontWeight: '700' }}>{seeAllLabel}</Text>
                        </Pressable>
                    </View>
                }
                contentContainerStyle={{ paddingBottom: bottomSafe + 24, backgroundColor: '#FFFFFF' }}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                    <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                        <Text style={{ color: COLORS.muted }}>Không tìm thấy kết quả cho “{query}”.</Text>
                    </View>
                }
            />

            {}
            <Modal visible={showDetail} transparent animationType="fade" onRequestClose={() => setShowDetail(false)}>
                <View style={{ flex: 1, backgroundColor: COLORS.overlay }}>
                    {/* White curtain che overlay xám ở đáy để liền mạch với tab bar */}
                    <View
                        pointerEvents="none"
                        style={{
                            position: 'absolute',
                            left: 0,
                            right: 0,
                            bottom: 0,
                            height: (insets.bottom ?? 0) + 68,
                            backgroundColor: '#FFFFFF',
                        }}
                    />
                    {/* Backdrop tap-to-close */}
                    <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} onPress={() => setShowDetail(false)} />

                    <Animated.View style={sheetStyle}>
                        <SafeAreaView>
                            {/* Handle kéo sheet */}
                            <View {...panResponder.panHandlers} style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 6 }}>
                                <View style={{ width: 56, height: 5, backgroundColor: COLORS.border, borderRadius: 999 }} />
                            </View>

                            {selected && (
                                <ScrollView showsVerticalScrollIndicator={false}>
                                    {/* Header */}
                                    <View style={{ alignItems: 'center', marginTop: 4 }}>
                                        <Avatar uri={selected.avatar} size={88} />
                                        <Text style={{ marginTop: 12, fontSize: 22, fontWeight: '800', color: COLORS.text }}>{selected.name}</Text>
                                        <Text style={{ marginTop: 4, fontSize: 14, color: COLORS.primary }}>{selected.category}</Text>
                                        <View style={{ marginTop: 6, flexDirection: 'row', alignItems: 'center' }}>
                                            <StarRating value={selected.rating} size={16} />
                                            <Text style={{ marginLeft: 8, color: COLORS.text, fontSize: 14 }}>{formatVi(selected.rating)}</Text>
                                        </View>
                                    </View>

                                    {/* Giới thiệu */}
                                    <View
                                        style={{
                                            marginTop: 18,
                                            padding: 12,
                                            borderRadius: 12,
                                            backgroundColor: '#F9FAFB',
                                            borderWidth: 1,
                                            borderColor: COLORS.border,
                                        }}
                                    >
                                        <Text style={{ color: COLORS.text, fontWeight: '700', marginBottom: 6 }}>Giới thiệu</Text>
                                        <Text style={{ color: COLORS.muted, lineHeight: 20 }}>
                                            {selected.intro ?? 'Chưa có mô tả. Bạn có thể lấy mô tả thật từ Firestore/API.'}
                                        </Text>
                                    </View>

                                    {/* Kỹ năng */}
                                    {!!selected.skills?.length && (
                                        <View style={{ marginTop: 14 }}>
                                            <Text style={{ color: COLORS.text, fontWeight: '700', marginBottom: 8 }}>Kỹ năng</Text>
                                            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                                                {selected.skills.map((s) => (
                                                    <Chip key={s} label={s} />
                                                ))}
                                            </View>
                                        </View>
                                    )}

                                    {/* Actions */}
                                    <View style={{ marginTop: 16, flexDirection: 'row' }}>
                                        <Pressable
                                            onPress={() => {
                                                setShowDetail(false);
                                                if (selected) onChat?.(selected);
                                            }}
                                            style={{
                                                backgroundColor: COLORS.actionBlue,
                                                paddingVertical: 12,
                                                borderRadius: 12,
                                                flex: 1,
                                                alignItems: 'center',
                                                marginRight: 12,
                                            }}
                                        >
                                            <Text style={{ color: 'white', fontWeight: '700' }}>💬 Chat</Text>
                                        </Pressable>
                                        <Pressable
                                            onPress={() => {
                                                setShowDetail(false);
                                                onPostJob?.();
                                            }}
                                            style={{
                                                backgroundColor: COLORS.actionGreen,
                                                paddingVertical: 12,
                                                borderRadius: 12,
                                                flex: 1,
                                                alignItems: 'center',
                                            }}
                                        >
                                            <Text style={{ color: 'white', fontWeight: '700' }}>＋ Thuê ngay</Text>
                                        </Pressable>
                                    </View>

                                    {/* Spacer cho home indicator / tab bar */}
                                    <View style={{ height: (insets.bottom ?? 0) + 24 }} />
                                </ScrollView>
                            )}
                        </SafeAreaView>
                    </Animated.View>
                </View>
            </Modal>
        </View>
    );
};
export default MyJobsTab;
