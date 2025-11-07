// ./tabs/components/MyJobsTab.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    View, Text, TextInput, Pressable, Image, FlatList, ListRenderItemInfo,
    Platform, Modal, ScrollView, SafeAreaView, Alert, Animated, PanResponder,
    Dimensions, Easing, StatusBar,
} from 'react-native';
import { SafeAreaInsetsContext, type EdgeInsets } from 'react-native-safe-area-context';
import type { FirebaseAuthTypes } from '@react-native-firebase/auth';
import firestore, { FirebaseFirestoreTypes as FT } from '@react-native-firebase/firestore';
import { COLORS as APP_COLORS } from '../../../config/AppConfig';

/* ================= TYPES ================= */
export type Freelancer = {
    id: string; name: string; category: string; rating: number;
    avatar?: string; intro?: string; skills?: string[];
};

type Props = {
    user?: FirebaseAuthTypes.User;
    freelancers?: Freelancer[];
    onPostJob?: () => void;       // nếu truyền thì dùng màn hình riêng
    onWallet?: () => void;
    onChat?: (f: Freelancer) => void;
    onSeeAll?: () => void;
    onPressFreelancer?: (f: Freelancer) => void;
};

/* ================= THEME ================= */
const COLORS = {
    text: APP_COLORS?.text ?? '#0F172A',
    primary: APP_COLORS?.primary ?? '#24786D',
    background: APP_COLORS?.background ?? '#FFFFFF',
    muted: '#6B7280',
    border: '#E5E7EB',
    star: '#FACC15',
    surface: '#FFFFFF',
    overlay: 'rgba(0,0,0,0.35)',
    chipBg: '#F3F4F6',
    fieldBg: '#FFFFFF',
    danger: '#B91C1C',
    green: '#23A86B',
    greenStrong: '#1B8F5A',
    grayBtn: '#F2F4F5',
};

const CATEGORIES = ['Sửa chữa', 'Thiết kế', 'Web Dev', 'Marketing'] as const;
type Category = typeof CATEGORIES[number];

const { height: SCREEN_H } = Dimensions.get('window');
const formatVi = (n: number) => n.toFixed(1).replace('.', ',');

/* ================= UTILS ================= */
const normalizeVN = (s: string) =>
    (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const splitSkills = (s: string) =>
    s.split(',').map(x => x.trim()).filter(Boolean);

/* ================= FIRESTORE HOOK ================= */
const col = () => firestore().collection('freelancers');
const toFreelancer = (d: FT.DocumentSnapshot): Freelancer => {
    const x = d.data() as any;
    return {
        id: d.id, name: x?.name ?? '', category: x?.category ?? '',
        rating: Number(x?.rating ?? 0), avatar: x?.avatar, intro: x?.intro,
        skills: Array.isArray(x?.skills) ? x.skills : [],
    };
};

type UseFreelancersOpts = { queryText?: string; category?: string; limit?: number; orderBy?: 'rating'|'createdAt'; };
function useFreelancers(opts: UseFreelancersOpts) {
    const { queryText = '', category, limit = 20, orderBy = 'rating' } = opts;
    const [items, setItems] = useState<Freelancer[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setLoading(true); setError(null);
        let q: FT.Query = col();
        if (category?.trim()) q = q.where('categoryLower', '==', category.trim().toLowerCase());
        q = orderBy === 'rating' ? q.orderBy('rating', 'desc') : q.orderBy('createdAt', 'desc');
        q = q.limit(limit);

        const unsub = q.onSnapshot(
            (snap) => {
                let rows = snap.docs.map(toFreelancer);
                const k = normalizeVN(queryText.trim());
                if (k) {
                    rows = rows.filter((f) => {
                        const hay = normalizeVN(f.name)+' '+normalizeVN(f.category)+' '+normalizeVN((f.skills||[]).join(' '));
                        return hay.includes(k);
                    });
                }
                setItems(rows); setLoading(false);
            },
            (e) => { setError(e?.message || 'Load thất bại'); setLoading(false); },
        );
        return () => unsub();
    }, [queryText, category, limit, orderBy]);

    return { items, loading, error };
}

/* ================= SMALL UI PARTS ================= */
const StarRating: React.FC<{ value: number; size?: number }> = ({ value, size = 14 }) => {
    const full = Math.floor(value); const half = value - full >= 0.5 ? 1 : 0;
    const empty = 5 - full - half;
    const stars = '★'.repeat(full) + (half ? '☆' : '') + '☆'.repeat(Math.max(0, empty - (half ? 1 : 0)));
    return <Text style={{ fontSize: size, lineHeight: size + 3, color: COLORS.star, letterSpacing: 1 }}>{stars}</Text>;
};

const ActionCard: React.FC<{ title: string; color: string; onPress?: () => void; emoji?: string; disabled?: boolean; }>
    = ({ title, color, onPress, emoji = '＋', disabled = false }) => (
    <Pressable
        accessibilityRole="button"
        onPress={disabled ? undefined : onPress}
        hitSlop={10}
        android_ripple={{ color: 'rgba(255,255,255,0.25)', borderless: false }}
        style={({ pressed }) => ({
            width: 104, height: 104, borderRadius: 22, backgroundColor: disabled ? '#A3A3A3' : color,
            justifyContent: 'center', alignItems: 'center', opacity: pressed ? 0.9 : 1,
        })}
    >
        <Text style={{ fontSize: 28, color: 'white', marginBottom: 6 }}>{emoji}</Text>
        <Text style={{ color: 'white', fontSize: 14, fontWeight: '700', textAlign: 'center' }} numberOfLines={2}>{title}</Text>
    </Pressable>
);

const Avatar: React.FC<{ uri?: string; size?: number }> = ({ uri, size = 44 }) =>
    uri ? (
        <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#F3F4F6' }} />
    ) : (
        <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' }}>
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
            backgroundColor: COLORS.surface, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12,
            borderWidth: 1, borderColor: 'rgba(16,24,40,0.04)',
            ...(Platform.OS === 'ios' ? { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } } : { elevation: 2 }),
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

const Label = ({children}:{children:React.ReactNode}) => (
    <Text style={{ fontSize: 12, color: COLORS.muted, marginBottom: 6 }}>{children}</Text>
);

const Field = ({value, onChangeText, placeholder, multiline=false, keyboardType='default'}: any) => (
    <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        keyboardType={keyboardType}
        multiline={multiline}
        numberOfLines={multiline ? 4 : 1}
        style={{
            borderWidth: 1, borderColor: COLORS.border, borderRadius: 12,
            paddingHorizontal: 12, paddingVertical: multiline ? 12 : 10,
            minHeight: multiline ? 96 : 44, color: COLORS.text, backgroundColor: COLORS.fieldBg,
        }}
    />
);

/* ================= MAIN ================= */
const MyJobsTab: React.FC<Props> = ({ freelancers, onPostJob, onWallet, onChat, onSeeAll, onPressFreelancer, user }) => {
    const insetsFromCtx = React.useContext(SafeAreaInsetsContext);
    const insets: EdgeInsets = insetsFromCtx ?? { top: 0, bottom: 0, left: 0, right: 0 };

    const [expanded, setExpanded] = useState(false);
    const [selected, setSelected] = useState<Freelancer | null>(null);
    const [showDetail, setShowDetail] = useState(false);
    const [query, setQuery] = useState('');
    const [showPostJob, setShowPostJob] = useState(false);

    // ===== Post Job form state
    const [title, setTitle] = useState('');
    const [desc, setDesc] = useState('');
    const [category, setCategory] = useState<Category>('Sửa chữa');
    const [budget, setBudget] = useState('');
    const [city, setCity] = useState('');
    const [skillsText, setSkillsText] = useState('');
    const [posterName, setPosterName] = useState('');
    const [posterContact, setPosterContact] = useState('');
    const [posterAddress, setPosterAddress] = useState('');

    const INITIAL_COUNT = 4;

    const { SNAP_TOP, SNAP_MID, SNAP_MIN, SNAP_MAX } = useMemo(() => {
        const top = Math.max(insets.top - 8, 0);
        const mid = SCREEN_H * 0.4;
        const max = SCREEN_H * 0.86;
        return { SNAP_TOP: top, SNAP_MID: mid, SNAP_MIN: top, SNAP_MAX: max };
    }, [insets.top]);

    // Firestore data
    const { items, loading, error } = useFreelancers({ queryText: query, limit: expanded ? 50 : 20, orderBy: 'rating' });
    const baseData = freelancers?.length ? freelancers : items;
    const filteredData = baseData;
    const visibleData = useMemo(() => (expanded ? filteredData : filteredData.slice(0, INITIAL_COUNT)), [expanded, filteredData]);
    const handleSeeAll = () => (onSeeAll ? onSeeAll() : setExpanded((v) => !v));
    const seeAllLabel = onSeeAll ? 'Xem tất cả' : expanded ? 'Thu gọn' : 'Xem tất cả';

    // Bottom Sheet
    const sheetY = useRef(new Animated.Value(SNAP_MID)).current;
    const dragOffsetY = useRef(0);
    const animateTo = (toY: number) => {
        Animated.timing(sheetY, { toValue: toY, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: false })
            .start(() => { dragOffsetY.current = toY; });
    };
    const openDetail = (item: Freelancer) => {
        if (onPressFreelancer) return onPressFreelancer(item);
        setSelected(item); setShowDetail(true); sheetY.setValue(SNAP_MID); dragOffsetY.current = SNAP_MID;
    };
    const handleQuickChat = () => {
        if (!selected) return Alert.alert('Chọn freelancer', 'Hãy chạm vào một freelancer trước, rồi bấm Chat.');
        onChat?.(selected);
    };
    const snapToNearest = () => {
        const y = dragOffsetY.current;
        if (y > SCREEN_H * 0.78) { setShowDetail(false); return; }
        const dTop = Math.abs(y - SNAP_TOP); const dMid = Math.abs(y - SNAP_MID);
        animateTo(dTop < dMid ? SNAP_TOP : SNAP_MID);
    };
    const panResponder = useRef(PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 4,
        onPanResponderGrant: () => { sheetY.stopAnimation((val: number) => { dragOffsetY.current = val; }); },
        onPanResponderMove: (_e, g) => { const next = Math.min(Math.max(dragOffsetY.current + g.dy, SNAP_MIN), SNAP_MAX); sheetY.setValue(next); },
        onPanResponderRelease: (_e, g) => { dragOffsetY.current = Math.min(Math.max(dragOffsetY.current + g.dy, SNAP_MIN), SNAP_MAX); snapToNearest(); },
        onPanResponderTerminate: () => { snapToNearest(); },
    })).current;

    const sheetStyle = {
        position: 'absolute' as const, left: 0, right: 0, top: sheetY, backgroundColor: COLORS.surface,
        borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 16, paddingBottom: 16,
        ...(Platform.OS === 'ios' ? { shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: -4 } } : { elevation: 10 }),
    };

    useEffect(() => {
        StatusBar.setBarStyle(showDetail ? 'light-content' : 'dark-content', true);
        if (Platform.OS === 'android') { StatusBar.setBackgroundColor(showDetail ? '#00000055' : 'transparent', true); StatusBar.setTranslucent(true); }
        return () => {
            StatusBar.setBarStyle('dark-content', true);
            if (Platform.OS === 'android') { StatusBar.setBackgroundColor('transparent', true); StatusBar.setTranslucent(true); }
        };
    }, [showDetail]);

    const bottomSafe = (insets.bottom ?? 0) + 56;

    /* --------- Post Job handlers --------- */
    const resetForm = () => {
        setTitle(''); setDesc(''); setCategory('Sửa chữa'); setBudget('');
        setCity(''); setSkillsText(''); setPosterName(''); setPosterContact(''); setPosterAddress('');
    };

    const handleOpenPostJob = () => {
        if (onPostJob) return onPostJob(); // dùng màn hình riêng nếu có
        if (!user) { Alert.alert('Cần đăng nhập', 'Bạn cần đăng nhập để đăng việc.'); return; }
        // auto điền từ user
        setPosterName(user.displayName ?? '');
        setPosterContact(user.email ?? '');
        setShowPostJob(true);
    };

    const submitPostJob = async () => {
        if (!user) return Alert.alert('Cần đăng nhập', 'Bạn cần đăng nhập để đăng việc.');
        if (!title.trim() || !desc.trim()) {
            return Alert.alert('Thiếu thông tin', 'Vui lòng nhập Tiêu đề và Mô tả.');
        }
        if (!city.trim()) {
            return Alert.alert('Thiếu Tỉnh/Thành phố', 'Vui lòng nhập Tỉnh/Thành phố.');
        }
        const budgetNum = Number(budget);
        if (Number.isNaN(budgetNum) || budgetNum < 0) {
            return Alert.alert('Ngân sách không hợp lệ', 'Vui lòng nhập số >= 0.');
        }

        try {
            const now = firestore.FieldValue.serverTimestamp();
            await firestore().collection('jobs').add({
                title: title.trim(),
                description: desc.trim(),
                category,
                categoryLower: category.toLowerCase(), // để lọc/rules
                budget: budgetNum,
                city: city.trim(),
                skills: splitSkills(skillsText),
                ownerId: user.uid,
                posterName: posterName.trim(),
                posterContact: posterContact.trim(), // SDT/Email/Zalo
                posterAddress: posterAddress.trim(),
                createdAt: now,
                updatedAt: now,
            });
            Alert.alert('Thành công', 'Đăng việc thành công.');
            setShowPostJob(false);
            resetForm();
        } catch (e: any) {
            Alert.alert('Lỗi', e?.message ?? 'Không thể đăng việc.');
        }
    };

    /* ================= RENDER ================= */
    return (
        <View style={{ flex: 1, backgroundColor: COLORS.background, paddingHorizontal: 16 }}>
            <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />

            {/* SEARCH */}
            <View style={{ paddingTop: 8, paddingBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', height: 44, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#FFFFFF', paddingHorizontal: 12 }}>
                    <Text style={{ fontSize: 16, marginRight: 6, color: '#111827' }}>🔍</Text>
                    <TextInput
                        value={query}
                        onChangeText={setQuery}
                        placeholder="Search jobs..."
                        placeholderTextColor="#9CA3AF"
                        style={{ flex: 1, fontSize: 14, color: COLORS.text, paddingVertical: 0 }}
                        returnKeyType="search"
                    />
                </View>
            </View>

            {/* ACTIONS */}
            <View style={{ paddingBottom: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <ActionCard title="Đăng việc" color={COLORS.green} emoji="＋" onPress={handleOpenPostJob} />
                    <ActionCard title="Nạp/Rút tiền" color={'#4F46E5'} emoji="💳" onPress={onWallet} />
                    <ActionCard title="Chat" color={'#7C3AED'} emoji="💬" onPress={handleQuickChat} disabled={!selected} />
                </View>
                {selected && (
                    <Text style={{ marginTop: 8, textAlign: 'right', color: COLORS.muted, fontSize: 12 }}>
                        Đã chọn: {selected.name} • {selected.category}
                    </Text>
                )}
            </View>

            {/* LIST */}
            <FlatList
                data={visibleData}
                keyExtractor={(it) => it.id}
                renderItem={({ item }: ListRenderItemInfo<Freelancer>) => <FreelancerCard item={item} onPress={() => openDetail(item)} />}
                ListHeaderComponent={
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, marginBottom: 12 }}>
                        <Text style={{ color: COLORS.text, fontSize: 18, fontWeight: '800' }}>Freelancers</Text>
                        <Pressable hitSlop={8} onPress={handleSeeAll}>
                            <Text style={{ color: COLORS.primary, fontSize: 14, fontWeight: '700' }}>{onSeeAll ? 'Xem tất cả' : seeAllLabel}</Text>
                        </Pressable>
                    </View>
                }
                contentContainerStyle={{ paddingBottom: bottomSafe + 24, backgroundColor: '#FFFFFF' }}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                    <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                        <Text style={{ color: COLORS.muted }}>{loading ? 'Đang tải…' : error ? `Lỗi: ${error}` : `Không tìm thấy kết quả cho “${query}”.`}</Text>
                    </View>
                }
            />

            {/* DETAIL SHEET */}
            <Modal visible={showDetail} transparent animationType="fade" onRequestClose={() => setShowDetail(false)}>
                <View style={{ flex: 1, backgroundColor: COLORS.overlay }}>
                    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: (insets.bottom ?? 0) + 68, backgroundColor: '#FFFFFF' }} />
                    <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} onPress={() => setShowDetail(false)} />
                    <Animated.View style={sheetStyle}>
                        <SafeAreaView>
                            <View {...panResponder.panHandlers} style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 6 }}>
                                <View style={{ width: 56, height: 5, backgroundColor: COLORS.border, borderRadius: 999 }} />
                            </View>
                            {selected && (
                                <ScrollView showsVerticalScrollIndicator={false}>
                                    <View style={{ alignItems: 'center', marginTop: 4 }}>
                                        <Avatar uri={selected.avatar} size={88} />
                                        <Text style={{ marginTop: 12, fontSize: 22, fontWeight: '800', color: COLORS.text }}>{selected.name}</Text>
                                        <Text style={{ marginTop: 4, fontSize: 14, color: COLORS.primary }}>{selected.category}</Text>
                                        <View style={{ marginTop: 6, flexDirection: 'row', alignItems: 'center' }}>
                                            <StarRating value={selected.rating} size={16} />
                                            <Text style={{ marginLeft: 8, color: COLORS.text, fontSize: 14 }}>{formatVi(selected.rating)}</Text>
                                        </View>
                                    </View>

                                    <View style={{ marginTop: 18, padding: 12, borderRadius: 12, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: COLORS.border }}>
                                        <Text style={{ color: COLORS.text, fontWeight: '700', marginBottom: 6 }}>Giới thiệu</Text>
                                        <Text style={{ color: COLORS.muted, lineHeight: 20 }}>{selected.intro ?? 'Chưa có mô tả. Bạn có thể lấy mô tả thật từ Firestore/API.'}</Text>
                                    </View>

                                    {!!selected.skills?.length && (
                                        <View style={{ marginTop: 14 }}>
                                            <Text style={{ color: COLORS.text, fontWeight: '700', marginBottom: 8 }}>Kỹ năng</Text>
                                            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                                                {selected.skills.map((s) => (
                                                    <View key={s} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#F9FAFB', marginRight: 8, marginBottom: 8 }}>
                                                        <Text style={{ color: COLORS.text, fontSize: 12 }}>{s}</Text>
                                                    </View>
                                                ))}
                                            </View>
                                        </View>
                                    )}

                                    <View style={{ marginTop: 16, flexDirection: 'row' }}>
                                        <Pressable onPress={() => { setShowDetail(false); if (selected) onChat?.(selected); }}
                                                   style={{ backgroundColor: '#4F46E5', paddingVertical: 12, borderRadius: 12, flex: 1, alignItems: 'center', marginRight: 12 }}>
                                            <Text style={{ color: 'white', fontWeight: '700' }}>💬 Chat</Text>
                                        </Pressable>
                                        <Pressable onPress={() => { setShowDetail(false); handleOpenPostJob(); }}
                                                   style={{ backgroundColor: COLORS.green, paddingVertical: 12, borderRadius: 12, flex: 1, alignItems: 'center' }}>
                                            <Text style={{ color: 'white', fontWeight: '700' }}>＋ Thuê ngay</Text>
                                        </Pressable>
                                    </View>

                                    <View style={{ height: (insets.bottom ?? 0) + 24 }} />
                                </ScrollView>
                            )}
                        </SafeAreaView>
                    </Animated.View>
                </View>
            </Modal>

            {/* POST JOB MODAL – giống ảnh */}
            <Modal visible={showPostJob} animationType="slide" onRequestClose={() => setShowPostJob(false)}>
                <SafeAreaView style={{ flex: 1, backgroundColor: '#FFF' }}>
                    <View style={{ paddingHorizontal: 16, paddingTop: 8, flex: 1 }}>
                        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                            <Text style={{ fontSize: 22, fontWeight: '800', color: COLORS.text, marginBottom: 12 }}>Đăng tin công việc</Text>

                            {/* Tiêu đề */}
                            <Label>Tiêu đề công việc</Label>
                            <Field value={title} onChangeText={setTitle} placeholder="Sửa máy lạnh tại Q3" />

                            {/* Mô tả */}
                            <View style={{ marginTop: 12 }}>
                                <Label>Mô tả chi tiết</Label>
                                <Field value={desc} onChangeText={setDesc} placeholder="Nhập mô tả..." multiline />
                            </View>

                            {/* Danh mục + Ngân sách */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
                                <View style={{ flex: 1, marginRight: 10 }}>
                                    <Label>Danh mục</Label>
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                                        {CATEGORIES.map(c => {
                                            const active = category === c;
                                            return (
                                                <Pressable
                                                    key={c}
                                                    onPress={() => setCategory(c)}
                                                    style={{
                                                        paddingHorizontal: 14, height: 44, borderRadius: 999,
                                                        borderWidth: 1, marginRight: 10, marginBottom: 10,
                                                        borderColor: active ? COLORS.green : COLORS.border,
                                                        backgroundColor: active ? COLORS.green : '#EFF6F3',
                                                        justifyContent: 'center',
                                                    }}
                                                >
                                                    <Text style={{ color: active ? '#FFF' : COLORS.text, fontWeight: '700' }}>{c}</Text>
                                                </Pressable>
                                            );
                                        })}
                                    </View>
                                </View>

                                <View style={{ flex: 1 }}>
                                    <Label>Ngân sách</Label>
                                    <Field value={budget} onChangeText={setBudget} placeholder="150000" keyboardType="numeric" />
                                </View>
                            </View>

                            {/* Thành phố */}
                            <View style={{ marginTop: 12 }}>
                                <Label>Tỉnh/Thành phố</Label>
                                <Field value={city} onChangeText={setCity} placeholder="TP. Hồ Chí Minh" />
                            </View>

                            {/* Kỹ năng */}
                            <View style={{ marginTop: 12 }}>
                                <Label>Kỹ năng (phân tách bằng dấu phẩy)</Label>
                                <Field value={skillsText} onChangeText={setSkillsText} placeholder="Điện lạnh cơ bản, Kiểm tra gas" />
                            </View>

                            {/* Tên + Liên hệ */}
                            <View style={{ flexDirection: 'row', marginTop: 12 }}>
                                <View style={{ flex: 1, marginRight: 10 }}>
                                    <Label>Tên người đăng</Label>
                                    <Field value={posterName} onChangeText={setPosterName} placeholder="Thanhhe" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Label>Liên hệ (SDT/Email/Zalo)</Label>
                                    <Field value={posterContact} onChangeText={setPosterContact} placeholder="VD: 09xx..., hoặc email" keyboardType="email-address" />
                                </View>
                            </View>

                            {/* Địa chỉ */}
                            <View style={{ marginTop: 12 }}>
                                <Label>Địa chỉ người đăng</Label>
                                <Field value={posterAddress} onChangeText={setPosterAddress} placeholder="VD: 123 Lê Lợi, Q1, TP.HCM" />
                            </View>

                            {/* Buttons */}
                            <View style={{ flexDirection: 'row', marginTop: 16, marginBottom: 24 }}>
                                <Pressable
                                    onPress={() => { setShowPostJob(false); }}
                                    style={{
                                        flex: 1, height: 52, borderRadius: 12, backgroundColor: COLORS.grayBtn,
                                        alignItems: 'center', justifyContent: 'center', marginRight: 10, borderWidth: 1, borderColor: COLORS.border,
                                    }}
                                >
                                    <Text style={{ color: COLORS.text, fontWeight: '700' }}>Hủy</Text>
                                </Pressable>

                                <Pressable
                                    onPress={submitPostJob}
                                    style={{
                                        flex: 1, height: 52, borderRadius: 12, backgroundColor: COLORS.green,
                                        alignItems: 'center', justifyContent: 'center',
                                    }}
                                >
                                    <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>Đăng việc ngay</Text>
                                </Pressable>
                            </View>
                        </ScrollView>
                    </View>
                </SafeAreaView>
            </Modal>
        </View>
    );
};

export default MyJobsTab;
