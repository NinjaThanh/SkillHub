// src/SignedIn/tabs/JobsTab.tsx
import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
    View, Text, Pressable, FlatList, ScrollView, TextInput,
    StyleSheet, ActivityIndicator, Alert, RefreshControl, Modal,
    KeyboardAvoidingView, Platform, Linking,
} from 'react-native';
import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import type { FirebaseAuthTypes } from '@react-native-firebase/auth';
import storage from '@react-native-firebase/storage';
import DocumentPicker, { types as DocTypes, isInProgress } from 'react-native-document-picker';

const COLORS = {
    primary: '#24786D',
    background: '#FFFFFF',
    text: '#0F172A',
    mutedText: '#6B7280',
    border: '#E5E7EB',
    card: '#FFFFFF',
    subtle: '#F2F4F5',
    danger: '#B91C1C',
    chip: '#EEF2F6',
    divider: '#E9EEF3',
};

type Props = { user: FirebaseAuthTypes.User; displayName: string };

export type Job = {
    id: string;
    title: string;
    description: string;
    location: string;
    budget: number;
    category: string;
    ownerId?: string;
    createdAt?: FirebaseFirestoreTypes.Timestamp | null;
    skills?: string[];
    posterName?: string;
    posterContact?: string;
    posterAddress?: string;
};

const CATEGORIES = ['All', 'Sửa chữa', 'Thiết kế', 'Web Dev', 'Marketing'] as const;

const VIETNAM_CITIES = [
    'Hà Nội','TP. Hồ Chí Minh','Đà Nẵng','Hải Phòng','Cần Thơ',
    'An Giang','Bà Rịa - Vũng Tàu','Bắc Giang','Bắc Kạn','Bạc Liêu','Bắc Ninh','Bến Tre','Bình Dương','Bình Định','Bình Phước','Bình Thuận',
    'Cà Mau','Cao Bằng','Đắk Lắk','Đắk Nông','Điện Biên','Đồng Nai','Đồng Tháp','Gia Lai','Hà Giang','Hà Nam','Hà Tĩnh','Hải Dương',
    'Hậu Giang','Hòa Bình','Hưng Yên','Khánh Hòa','Kiên Giang','Kon Tum','Lai Châu','Lâm Đồng','Lạng Sơn','Lào Cai','Long An',
    'Nam Định','Nghệ An','Ninh Bình','Ninh Thuận','Phú Thọ','Phú Yên','Quảng Bình','Quảng Nam','Quảng Ngãi','Quảng Ninh',
    'Quảng Trị','Sóc Trăng','Sơn La','Tây Ninh','Thái Bình','Thái Nguyên','Thanh Hóa','Thừa Thiên Huế','Tiền Giang',
    'Trà Vinh','Tuyên Quang','Vĩnh Long','Vĩnh Phúc','Yên Bái',
];

const currency = (n: number) =>
    `₫${(Number(n) || 0).toLocaleString('vi-VN', { maximumFractionDigits: 0 })}`;
const shortUid = (uid: string) => (uid?.length > 6 ? uid.slice(0, 6) : uid || '');
const normalizeCategory = (s?: string) => (s || '').trim();
const normSkills = (skills?: any): string[] =>
    Array.isArray(skills) ? skills.map((x) => String(x || '').trim()).filter(Boolean) : [];
const formatDate = (ts?: FirebaseFirestoreTypes.Timestamp | null) =>
    ts?.toDate ? ts.toDate().toLocaleString('vi-VN') : '—';

const formatBytes = (n?: number) => {
    if (typeof n !== 'number' || !isFinite(n) || n < 0) return null;
    if (n < 1024) return `${n} B`;
    const kb = n / 1024;
    if (kb < 1024) return `${kb.toFixed(2)} KB`;
    const mb = kb / 1024;
    if (mb < 1024) return `${mb.toFixed(2)} MB`;
    const gb = mb / 1024;
    return `${gb.toFixed(2)} GB`;
};

const DETAIL_SHEET_MAX = '85%';
const DETAIL_SHEET_PADDING = 360;

const matchErr = (
    e: unknown,
    needle: 'failed-precondition' | 'invalid-argument' | 'permission-denied'
) => {
    const code = (e as any)?.code ?? (e as any)?.nativeErrorCode ?? (e as any)?.name ?? '';
    const msg = (e as any)?.message ?? (e as any)?.nativeErrorMessage ?? '';
    const hay = `${String(code).toLowerCase()} ${String(msg).toLowerCase()}`;
    return hay.includes(needle);
};

/* ----------------------- City Picker ----------------------- */
const CityPickerModal: React.FC<{
    visible: boolean;
    onClose: () => void;
    onSelect: (city: string) => void;
    initial?: string;
}> = ({ visible, onClose, onSelect, initial }) => {
    const [q, setQ] = useState('');
    useEffect(() => { if (visible) setQ(''); }, [visible]);

    const list = useMemo(() => {
        const s = q.trim().toLowerCase();
        if (!s) return VIETNAM_CITIES;
        return VIETNAM_CITIES.filter(c => c.toLowerCase().includes(s));
    }, [q]);

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.25)', justifyContent: 'flex-end' }}>
                <View style={[styles.modalSheet, { paddingBottom: 8, maxHeight: DETAIL_SHEET_MAX as any }]}>
                    <Text style={styles.modalTitle}>Chọn Tỉnh/Thành phố</Text>
                    <TextInput
                        value={q}
                        onChangeText={setQ}
                        placeholder="Tìm kiếm..."
                        placeholderTextColor="#9CA3AF"
                        style={[styles.input, { marginBottom: 10 }]}
                        autoCorrect
                        autoCapitalize="words"
                        selectionColor={COLORS.primary}
                    />
                    <View style={{ maxHeight: 360 }}>
                        <ScrollView keyboardShouldPersistTaps="handled">
                            {list.map(city => {
                                const active = initial && city === initial;
                                return (
                                    <Pressable
                                        key={city}
                                        onPress={() => { onSelect(city); onClose(); }}
                                        style={{
                                            paddingVertical: 12, paddingHorizontal: 10,
                                            backgroundColor: active ? COLORS.subtle : 'transparent',
                                            borderRadius: 10,
                                        }}
                                    >
                                        <Text style={{ color: COLORS.text, fontWeight: active ? '800' : '600' }}>{city}</Text>
                                    </Pressable>
                                );
                            })}
                        </ScrollView>
                    </View>
                    <Pressable style={[styles.btn, styles.btnGhost, { marginTop: 10 }]} onPress={onClose}>
                        <Text style={[styles.btnText, { color: COLORS.text }]}>Đóng</Text>
                    </Pressable>
                </View>
            </View>
        </Modal>
    );
};

/* ----------------------- Post Job ----------------------- */
const PostJobModal: React.FC<{
    visible: boolean;
    onClose: () => void;
    onPosted: () => void;
    user: FirebaseAuthTypes.User;
    defaultPosterName?: string;
}> = ({ visible, onClose, onPosted, user, defaultPosterName }) => {
    const [title, setTitle] = useState('Sửa máy lạnh tại Q3');
    const [desc, setDesc] = useState('');
    const [category, setCategory] =
        useState<'Sửa chữa' | 'Thiết kế' | 'Web Dev' | 'Marketing'>('Sửa chữa');
    const [budgetText, setBudgetText] = useState('150000');
    const [location, setLocation] = useState('TP. Hồ Chí Minh');
    const [skillsText, setSkillsText] = useState('Điện lạnh cơ bản, Kiểm tra gas');
    const [posterName, setPosterName] = useState(defaultPosterName || '');
    const [posterContact, setPosterContact] = useState('');
    const [posterAddress, setPosterAddress] = useState('');

    const [posting, setPosting] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const [showCityPicker, setShowCityPicker] = useState(false);

    const reset = () => {
        setTitle('Sửa máy lạnh tại Q3');
        setDesc('');
        setCategory('Sửa chữa');
        setBudgetText('150000');
        setLocation('TP. Hồ Chí Minh');
        setSkillsText('Điện lạnh cơ bản, Kiểm tra gas');
        setPosterName(defaultPosterName || '');
        setPosterContact('');
        setPosterAddress('');
        setErr(null);
    };

    const parseBudget = (s: string) => {
        const num = Number(String(s).replace(/[^\d]/g, ''));
        return isNaN(num) ? 0 : num;
    };
    const splitSkills = (s: string): string[] =>
        s.split(',').map((x) => x.trim()).filter(Boolean);

    const submit = async () => {
        const budget = parseBudget(budgetText);
        if (!title.trim()) return setErr('Vui lòng nhập tiêu đề công việc');
        if (!desc.trim()) return setErr('Vui lòng nhập mô tả chi tiết');
        if (budget <= 0) return setErr('Ngân sách phải lớn hơn 0');
        if (!location.trim()) return setErr('Vui lòng chọn địa điểm');

        try {
            setPosting(true);
            setErr(null);
            await firestore().collection('jobs').add({
                title: title.trim(),
                description: desc.trim(),
                location: location.trim(),
                budget,
                category,
                ownerId: user.uid,
                createdAt: firestore.FieldValue.serverTimestamp(),
                skills: splitSkills(skillsText),
                posterName: posterName?.trim() || undefined,
                posterContact: posterContact?.trim() || undefined,
                posterAddress: posterAddress?.trim() || undefined,
            });
            reset();
            onClose();
            onPosted();
        } catch (e: any) {
            Alert.alert('Đăng việc lỗi', e?.message ?? 'Vui lòng thử lại');
        } finally {
            setPosting(false);
        }
    };

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.25)', justifyContent: 'flex-end' }}
            >
                <View style={[styles.modalSheet, { maxHeight: DETAIL_SHEET_MAX as any }]}>
                    <ScrollView
                        keyboardShouldPersistTaps="handled"
                        contentContainerStyle={{ paddingBottom: 16 }}
                        showsVerticalScrollIndicator={false}
                    >
                        <Text style={styles.modalTitle}>Đăng tin công việc</Text>

                        <View style={styles.fieldBlock}>
                            <Text style={styles.label}>Tiêu đề công việc</Text>
                            <TextInput
                                value={title}
                                onChangeText={setTitle}
                                placeholder="VD: Sửa máy lạnh tại Q3"
                                style={styles.input}
                                placeholderTextColor="#9CA3AF"
                                autoCapitalize="sentences"
                                autoCorrect
                                selectionColor={COLORS.primary}
                                textContentType="none"
                            />
                        </View>

                        <View style={styles.fieldBlock}>
                            <Text style={styles.label}>Mô tả chi tiết</Text>
                            <TextInput
                                value={desc}
                                onChangeText={setDesc}
                                placeholder="Nhập mô tả..."
                                style={[styles.input, { height: 96 }]}
                                multiline
                                placeholderTextColor="#9CA3AF"
                                autoCapitalize="sentences"
                                autoCorrect
                                selectionColor={COLORS.primary}
                            />
                        </View>

                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.label}>Danh mục</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 6 }}>
                                    {(['Sửa chữa', 'Thiết kế', 'Web Dev', 'Marketing'] as const).map((c) => {
                                        const active = c === category;
                                        return (
                                            <Pressable key={c} onPress={() => setCategory(c)} style={[styles.chip, active && styles.chipActive]}>
                                                <Text style={[styles.chipText, active && styles.chipTextActive]}>{c}</Text>
                                            </Pressable>
                                        );
                                    })}
                                </ScrollView>
                            </View>

                            <View style={{ flex: 1 }}>
                                <Text style={styles.label}>Ngân sách</Text>
                                <TextInput
                                    value={budgetText}
                                    onChangeText={setBudgetText}
                                    keyboardType="number-pad"
                                    placeholder="VD: ₫150.000"
                                    style={styles.input}
                                    placeholderTextColor="#9CA3AF"
                                    selectionColor={COLORS.primary}
                                />
                            </View>
                        </View>

                        <View style={styles.fieldBlock}>
                            <Text style={styles.label}>Tỉnh/Thành phố</Text>
                            <Pressable onPress={() => setShowCityPicker(true)} style={[styles.input, { justifyContent: 'center' }]}>
                                <Text style={{ color: location ? COLORS.text : '#9CA3AF', fontSize: 14 }}>
                                    {location || 'Chọn Tỉnh/Thành phố'}
                                </Text>
                            </Pressable>
                        </View>

                        <View style={styles.fieldBlock}>
                            <Text style={styles.label}>Kỹ năng (phân tách bằng dấu phẩy)</Text>
                            <TextInput
                                value={skillsText}
                                onChangeText={setSkillsText}
                                placeholder="VD: Điện lạnh cơ bản, Kiểm tra gas"
                                style={styles.input}
                                placeholderTextColor="#9CA3AF"
                                autoCapitalize="sentences"
                                autoCorrect
                                selectionColor={COLORS.primary}
                            />
                        </View>

                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.label}>Tên người đăng</Text>
                                <TextInput
                                    value={posterName}
                                    onChangeText={setPosterName}
                                    placeholder="VD: Anh Dũng"
                                    style={styles.input}
                                    placeholderTextColor="#9CA3AF"
                                    autoCapitalize="words"
                                    autoCorrect
                                    selectionColor={COLORS.primary}
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.label}>Liên hệ (SĐT/Email/Zalo)</Text>
                                <TextInput
                                    value={posterContact}
                                    onChangeText={setPosterContact}
                                    placeholder="VD: 09xx..., hoặc email"
                                    style={styles.input}
                                    placeholderTextColor="#9CA3AF"
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    keyboardType="default"
                                    selectionColor={COLORS.primary}
                                />
                            </View>
                        </View>

                        <View style={styles.fieldBlock}>
                            <Text style={styles.label}>Địa chỉ người đăng</Text>
                            <TextInput
                                value={posterAddress}
                                onChangeText={setPosterAddress}
                                placeholder="VD: 123 Lê Lợi, Q1, TP.HCM"
                                style={styles.input}
                                placeholderTextColor="#9CA3AF"
                                autoCapitalize="sentences"
                                autoCorrect
                                selectionColor={COLORS.primary}
                            />
                        </View>

                        {!!err && <Text style={{ color: COLORS.danger, marginTop: 2 }}>{err}</Text>}

                        <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                            <Pressable style={[styles.btn, styles.btnGhost]} disabled={posting} onPress={() => { reset(); onClose(); }}>
                                <Text style={[styles.btnText, { color: COLORS.text }]}>Hủy</Text>
                            </Pressable>
                            <Pressable style={[styles.btn, styles.btnPrimaryBig]} disabled={posting} onPress={submit}>
                                <Text style={[styles.btnText, { color: '#fff' }]}>{posting ? 'Đang đăng...' : 'Đăng việc ngay'}</Text>
                            </Pressable>
                        </View>

                        <CityPickerModal
                            visible={showCityPicker}
                            onClose={() => setShowCityPicker(false)}
                            onSelect={setLocation}
                            initial={location}
                        />
                    </ScrollView>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

/* ----------------------- Apply (Upload CV) ----------------------- */
const ApplyJobModal: React.FC<{
    visible: boolean;
    onClose: () => void;
    job?: Job;
    user: FirebaseAuthTypes.User;
    displayName: string;
}> = ({ visible, onClose, job, user, displayName }) => {
    const [applicantName, setApplicantName] = useState(displayName || '');
    const [contact, setContact] = useState('');
    const [message, setMessage] = useState('Chào anh/chị, em quan tâm công việc này và có thể bắt đầu sớm.');
    const [cvUrl, setCvUrl] = useState('');

    const [pickedFile, setPickedFile] = useState<{
        uri: string; name: string; size?: number; type?: string;
    } | null>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    useEffect(() => {
        if (visible) {
            setApplicantName(displayName || '');
            setContact('');
            setMessage('Chào anh/chị, em quan tâm công việc này và có thể bắt đầu sớm.');
            setCvUrl('');
            setPickedFile(null);
            setUploading(false);
            setUploadProgress(0);
        }
    }, [visible, displayName]);

    const pickFile = async () => {
        try {
            const res = await DocumentPicker.pickSingle({
                type: [DocTypes.pdf, DocTypes.doc, DocTypes.docx, DocTypes.plainText],
                copyTo: 'cachesDirectory',
                presentationStyle: 'fullScreen',
            });
            const uri = res.fileCopyUri ?? res.uri;
            setPickedFile({
                uri,
                name: res.name ?? 'CV',
                size: typeof res.size === 'number' && isFinite(res.size) ? res.size : undefined, // safe
                type: res.type ?? 'application/octet-stream',
            });
        } catch (e) {
            if (DocumentPicker.isCancel(e) || isInProgress(e)) return;
            Alert.alert('Chọn tệp thất bại', 'Vui lòng thử lại.');
        }
    };

    const uploadFile = async () => {
        if (!pickedFile || !job?.id) return;
        try {
            setUploading(true);
            setUploadProgress(0);
            const safeName = pickedFile.name?.replace(/[^\w.\-]+/g, '_') || `cv_${Date.now()}.bin`;
            const path = `applications/${job.id}/${user.uid}/${Date.now()}_${safeName}`;
            const ref = storage().ref(path);

            const task = ref.putFile(pickedFile.uri);
            task.on('state_changed', s => {
                if (s.totalBytes) setUploadProgress(s.bytesTransferred / s.totalBytes);
            });
            await task;
            const url = await ref.getDownloadURL();
            setCvUrl(url);
            Alert.alert('Tải lên xong', 'Đã đính kèm CV vào hồ sơ.');
        } catch (e: any) {
            Alert.alert('Tải tệp lỗi', e?.message ?? 'Không thể tải tệp. Thử lại sau.');
        } finally {
            setUploading(false);
        }
    };

    const submit = async () => {
        if (!job?.id) return;
        if (job?.ownerId && job.ownerId === user.uid) {
            Alert.alert('Không thể nộp', 'Bạn không thể nộp hồ sơ vào công việc của chính mình.');
            return;
        }
        if (!applicantName.trim()) return Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên của bạn.');
        if (!contact.trim()) return Alert.alert('Thiếu thông tin', 'Vui lòng nhập liên hệ (SĐT/Email/Zalo).');
        if (uploading) return Alert.alert('Đang tải tệp', 'Vui lòng đợi tải tệp xong rồi mới gửi.');

        try {
            const dup = await firestore()
                .collection('applications')
                .where('jobId', '==', job.id)
                .where('applicantId', '==', user.uid)
                .limit(1)
                .get();
            if (!dup.empty) {
                Alert.alert('Bạn đã nộp rồi', 'Hồ sơ của bạn cho công việc này đã tồn tại.');
                return;
            }

            await firestore().collection('applications').add({
                jobId: job.id,
                jobTitle: job.title,
                ownerId: job.ownerId ?? null,
                applicantId: user.uid,
                applicantName: applicantName.trim(),
                contact: contact.trim(),
                message: message.trim(),
                cvUrl: (cvUrl || '').trim() || null,
                status: 'pending', // pending | viewed | accepted | rejected
                createdAt: firestore.FieldValue.serverTimestamp(),
            });

            Alert.alert('Đã nộp hồ sơ', 'Nhà tuyển dụng sẽ sớm liên hệ bạn.');
            onClose();
        } catch (e: any) {
            Alert.alert('Nộp hồ sơ lỗi', e?.message ?? 'Vui lòng thử lại.');
        }
    };

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.25)', justifyContent: 'flex-end' }}
            >
                <View style={[styles.modalSheet, { maxHeight: DETAIL_SHEET_MAX as any }]}>
                    {/* Scroll để “ô đính kèm CV” không bị che & luôn xem được hết nội dung */}
                    <ScrollView
                        keyboardShouldPersistTaps="handled"
                        contentContainerStyle={{ paddingBottom: 16 }}
                        showsVerticalScrollIndicator={false}
                    >
                        <Text style={styles.modalTitle}>Nộp hồ sơ</Text>

                        <View style={styles.detailCard}>
                            <Text style={styles.detailTitle} numberOfLines={2}>{job?.title || '—'}</Text>
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Tỉnh/TP</Text>
                                <Text style={styles.detailValue}>{job?.location || '—'}</Text>
                            </View>
                            <View style={styles.divider} />
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Ngân sách</Text>
                                <Text style={[styles.detailValue, { fontWeight: '800' }]}>{currency(job?.budget || 0)}</Text>
                            </View>
                        </View>

                        <View style={styles.fieldBlock}>
                            <Text style={styles.label}>Tên ứng viên</Text>
                            <TextInput
                                value={applicantName}
                                onChangeText={setApplicantName}
                                placeholder="VD: Phạm Thanh Dũng"
                                placeholderTextColor="#9CA3AF"
                                style={styles.input}
                                selectionColor={COLORS.primary}
                                autoCapitalize="words"
                            />
                        </View>

                        <View style={styles.fieldBlock}>
                            <Text style={styles.label}>Liên hệ (SĐT/Email/Zalo)</Text>
                            <TextInput
                                value={contact}
                                onChangeText={setContact}
                                placeholder="VD: 09xx..., hoặc email"
                                placeholderTextColor="#9CA3AF"
                                style={styles.input}
                                selectionColor={COLORS.primary}
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                        </View>

                        <View style={styles.fieldBlock}>
                            <Text style={styles.label}>Lời nhắn</Text>
                            <TextInput
                                value={message}
                                onChangeText={setMessage}
                                placeholder="Giới thiệu ngắn gọn kinh nghiệm, thời gian bắt đầu..."
                                placeholderTextColor="#9CA3AF"
                                style={[styles.input, { height: 96 }]}
                                multiline
                                selectionColor={COLORS.primary}
                            />
                        </View>

                        {/* Đính kèm CV – full width, viền nét đứt, nổi bật */}
                        <View style={[styles.fieldBlock, { zIndex: 2 }]}>
                            <Text style={styles.label}>Đính kèm CV (PDF/DOC/DOCX)</Text>

                            {!pickedFile ? (
                                <Pressable style={styles.uploadDrop} onPress={pickFile}>
                                    <Text style={[styles.btnText, { color: COLORS.text }]}>Chọn tệp từ máy</Text>
                                    <Text style={{ color: COLORS.mutedText, fontSize: 12, marginTop: 4 }}>
                                        Hỗ trợ .pdf .doc .docx .txt
                                    </Text>
                                </Pressable>
                            ) : (
                                <View style={{ gap: 8 }}>
                                    <View style={styles.uploadInfo}>
                                        <Text style={{ color: COLORS.text, fontWeight: '800' }} numberOfLines={1}>
                                            {pickedFile.name}
                                        </Text>
                                        {formatBytes(pickedFile.size) && (
                                            <Text style={{ color: COLORS.mutedText, fontSize: 12 }}>
                                                {formatBytes(pickedFile.size)}
                                            </Text>
                                        )}
                                        {!!cvUrl && (
                                            <Text style={{ color: COLORS.mutedText, fontSize: 12, marginTop: 4 }}>
                                                Đã tải lên • URL sẽ gửi cùng hồ sơ
                                            </Text>
                                        )}
                                    </View>

                                    {uploading ? (
                                        <View style={{ gap: 6 }}>
                                            <View style={styles.progressWrap}>
                                                <View style={[styles.progressBar, { width: `${Math.round(uploadProgress * 100)}%` }]} />
                                            </View>
                                            <Text style={{ color: COLORS.mutedText, fontSize: 12 }}>
                                                Đang tải lên… {Math.round(uploadProgress * 100)}%
                                            </Text>
                                        </View>
                                    ) : (
                                        <View style={{ flexDirection: 'row', gap: 10 }}>
                                            <Pressable style={[styles.btn, styles.btnGhost]} onPress={() => setPickedFile(null)}>
                                                <Text style={[styles.btnText, { color: COLORS.text }]}>Xoá tệp</Text>
                                            </Pressable>
                                            <Pressable style={[styles.btn, styles.btnPrimaryBig, { flex: 2 }]} onPress={uploadFile}>
                                                <Text style={[styles.btnText, { color: '#fff' }]}>
                                                    {cvUrl ? 'Tải lại' : 'Tải tệp lên'}
                                                </Text>
                                            </Pressable>
                                        </View>
                                    )}
                                </View>
                            )}
                        </View>

                        <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                            <Pressable style={[styles.btn, styles.btnGhost]} disabled={uploading} onPress={onClose}>
                                <Text style={[styles.btnText, { color: COLORS.text }]}>Hủy</Text>
                            </Pressable>
                            <Pressable style={[styles.btn, styles.btnPrimaryBig]} disabled={uploading} onPress={submit}>
                                <Text style={[styles.btnText, { color: '#fff' }]}>Gửi hồ sơ</Text>
                            </Pressable>
                        </View>
                    </ScrollView>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

/* ----------------------- Detail ----------------------- */
const JobDetailModal: React.FC<{
    visible: boolean;
    job?: Job;
    onClose: () => void;
    onApply?: (job: Job) => void;
}> = ({ visible, job, onClose, onApply }) => {
    const openContact = () => {
        if (!job?.posterContact) return;
        const c = job.posterContact.trim();
        if (c.includes('@')) { Linking.openURL(`mailto:${c}`).catch(() => {}); return; }
        if (/^\+?\d[\d\s\-().]*$/.test(c)) { Linking.openURL(`tel:${c.replace(/[^\d+]/g, '')}`).catch(() => {}); return; }
        if (/^https?:\/\//i.test(c)) { Linking.openURL(c).catch(() => {}); }
    };

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <View style={{ flex: 1, justifyContent: 'flex-end' }}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
                    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.25)' }} />
                </Pressable>

                <View style={[styles.modalSheet, { maxHeight: DETAIL_SHEET_MAX as any }]}>
                    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 16 }}>
                        <View style={{ alignItems: 'center', marginBottom: 4 }}>
                            <View style={{ width: 44, height: 4, borderRadius: 2, backgroundColor: COLORS.divider, marginTop: 4, marginBottom: 6 }} />
                            <Pressable
                                onPress={onClose}
                                style={{ position: 'absolute', right: 4, top: -2, padding: 8 }}
                                hitSlop={8}
                                accessibilityRole="button"
                                accessibilityLabel="Đóng"
                            >
                                <Text style={{ fontSize: 18, fontWeight: '900', color: COLORS.mutedText }}>✕</Text>
                            </Pressable>
                        </View>

                        <Text style={styles.modalTitle}>Chi tiết công việc</Text>

                        <View style={styles.detailCard}>
                            <Text style={styles.detailTitle}>{job?.title}</Text>
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Danh mục</Text>
                                <Text style={styles.detailValue}>{job?.category}</Text>
                            </View>
                            <View style={styles.divider} />
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Tỉnh/TP</Text>
                                <Text style={styles.detailValue}>{job?.location}</Text>
                            </View>
                            <View style={styles.divider} />
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Ngân sách</Text>
                                <Text style={[styles.detailValue, { fontWeight: '800' }]}>{currency(job?.budget || 0)}</Text>
                            </View>
                            <View style={styles.divider} />
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Đăng lúc</Text>
                                <Text style={styles.detailValue}>{formatDate(job?.createdAt)}</Text>
                            </View>

                            {!!job?.skills?.length && (
                                <>
                                    <View style={styles.divider} />
                                    <Text style={[styles.label, { marginTop: 8, marginBottom: 6 }]}>Kỹ năng yêu cầu</Text>
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                        {job?.skills?.map((s) => (
                                            <View key={s} style={styles.skillChip}>
                                                <Text style={styles.skillChipText}>{s}</Text>
                                            </View>
                                        ))}
                                    </View>
                                </>
                            )}
                        </View>

                        <View style={styles.detailCard}>
                            <Text style={[styles.label, { marginBottom: 6 }]}>Mô tả chi tiết</Text>
                            <Text style={{ color: COLORS.text, lineHeight: 20 }}>
                                {job?.description || '—'}
                            </Text>
                        </View>

                        <View style={styles.detailCard}>
                            <Text style={[styles.label, { marginBottom: 6 }]}>Thông tin người đăng</Text>
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Tên</Text>
                                <Text style={styles.detailValue}>{job?.posterName || '—'}</Text>
                            </View>
                            <View style={styles.divider} />
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Liên hệ</Text>
                                <Text style={styles.detailValue}>{job?.posterContact || '—'}</Text>
                            </View>
                            <View style={styles.divider} />
                            <View style={styles.detailRow}>
                                <Text style={styles.detailLabel}>Địa chỉ</Text>
                                <Text style={[styles.detailValue, { flex: 1 }]} numberOfLines={2}>
                                    {job?.posterAddress || '—'}
                                </Text>
                            </View>

                            {job?.posterContact ? (
                                <Pressable style={[styles.btn, styles.btnPrimaryBig, { marginTop: 12 }]} onPress={openContact}>
                                    <Text style={[styles.btnText, { color: '#fff' }]}>Liên hệ ngay</Text>
                                </Pressable>
                            ) : null}
                        </View>

                        {job ? (
                            <Pressable style={[styles.btn, styles.btnPrimaryBig]} onPress={() => onApply?.(job)}>
                                <Text style={[styles.btnText, { color: '#fff' }]}>Nộp hồ sơ</Text>
                            </Pressable>
                        ) : null}

                        <Pressable style={[styles.btn, styles.btnGhost, { marginTop: 10 }]} onPress={onClose}>
                            <Text style={[styles.btnText, { color: COLORS.text }]}>Đóng</Text>
                        </Pressable>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};

/* ----------------------- Main Tab ----------------------- */
const JobsTab: React.FC<Props> = ({ user, displayName }) => {
    const [selectedCat, setSelectedCat] = useState<string>('All');
    const [jobs, setJobs] = useState<Job[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showPost, setShowPost] = useState(false);

    const [detailJob, setDetailJob] = useState<Job | undefined>(undefined);
    const [showDetail, setShowDetail] = useState(false);

    const [applyJob, setApplyJob] = useState<Job | undefined>(undefined);
    const [showApply, setShowApply] = useState(false);

    const listRef = useRef<FlatList<Job> | null>(null);

    useEffect(() => {
        const colRef = firestore().collection('jobs');

        if (selectedCat === 'All') {
            let unsub1: (() => void) | null = null;
            let unsub2: (() => void) | null = null;

            unsub1 = colRef.orderBy('createdAt', 'desc').onSnapshot(
                snap => {
                    const list: Job[] = snap.docs.map(d => {
                        const data = d.data() as Omit<Job, 'id'>;
                        return {
                            id: d.id,
                            title: String(data.title || ''),
                            description: String(data.description || ''),
                            location: String(data.location || ''),
                            budget: Number((data as any).budget || 0),
                            category: normalizeCategory((data as any).category),
                            ownerId: (data as any).ownerId,
                            createdAt: (data as any).createdAt ?? null,
                            skills: normSkills((data as any).skills),
                            posterName: (data as any).posterName,
                            posterContact: (data as any).posterContact,
                            posterAddress: (data as any).posterAddress,
                        };
                    });
                    setJobs(list);
                    setLoading(false);
                },
                err => {
                    if (matchErr(err, 'failed-precondition') || matchErr(err, 'invalid-argument')) {
                        if (unsub1) { unsub1(); unsub1 = null; }
                        unsub2 = colRef.onSnapshot(
                            snap2 => {
                                const list: Job[] = snap2.docs.map(d => {
                                    const data = d.data() as Omit<Job, 'id'>;
                                    return {
                                        id: d.id,
                                        title: String(data.title || ''),
                                        description: String(data.description || ''),
                                        location: String(data.location || ''),
                                        budget: Number((data as any).budget || 0),
                                        category: normalizeCategory((data as any).category),
                                        ownerId: (data as any).ownerId,
                                        createdAt: (data as any).createdAt ?? null,
                                        skills: normSkills((data as any).skills),
                                        posterName: (data as any).posterName,
                                        posterContact: (data as any).posterContact,
                                        posterAddress: (data as any).posterAddress,
                                    };
                                });
                                list.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
                                setJobs(list);
                                setLoading(false);
                            },
                            e2 => { Alert.alert('Lỗi tải dữ liệu', (e2 as any)?.message ?? 'Vui lòng thử lại'); setLoading(false); }
                        );
                        return;
                    }

                    if (matchErr(err, 'permission-denied')) {
                        Alert.alert('Lỗi tải dữ liệu', 'Bạn không có quyền đọc dữ liệu. Kiểm tra Firestore Rules hoặc quyền người dùng.');
                        setLoading(false);
                        return;
                    }

                    Alert.alert('Lỗi tải dữ liệu', (err as any)?.message ?? 'Vui lòng thử lại');
                    setLoading(false);
                }
            );

            return () => { if (unsub1) unsub1(); if (unsub2) unsub2(); };
        }

        const unsub = colRef.where('category', '==', selectedCat).onSnapshot(
            snap => {
                const list: Job[] = snap.docs.map(d => {
                    const data = d.data() as Omit<Job, 'id'>;
                    return {
                        id: d.id,
                        title: String(data.title || ''),
                        description: String(data.description || ''),
                        location: String(data.location || ''),
                        budget: Number((data as any).budget || 0),
                        category: normalizeCategory((data as any).category),
                        ownerId: (data as any).ownerId,
                        createdAt: (data as any).createdAt ?? null,
                        skills: normSkills((data as any).skills),
                        posterName: (data as any).posterName,
                        posterContact: (data as any).posterContact,
                        posterAddress: (data as any).posterAddress,
                    };
                });
                list.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
                setJobs(list);
                setLoading(false);
            },
            err => {
                if (matchErr(err, 'permission-denied')) {
                    Alert.alert('Lỗi tải dữ liệu', 'Bạn không có quyền đọc dữ liệu. Kiểm tra lại Firestore Rules hoặc quyền người dùng.');
                } else if (matchErr(err, 'failed-precondition') || matchErr(err, 'invalid-argument')) {
                    Alert.alert('Lỗi tải dữ liệu', 'Truy vấn yêu cầu index hoặc tham số truy vấn không hợp lệ. Tạo composite index trong Firestore console hoặc điều chỉnh filter/order.');
                } else {
                    Alert.alert('Lỗi tải dữ liệu', (err as any)?.message ?? 'Vui lòng thử lại');
                }
                setLoading(false);
            }
        );

        return () => unsub();
    }, [selectedCat]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        setTimeout(() => setRefreshing(false), 400);
    }, []);

    const renderSkillsRow = (skills?: string[]) => {
        const top = (skills || []).slice(0, 3);
        if (top.length === 0) return null;
        return (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {top.map((s) => (
                    <View key={s} style={styles.skillChip}>
                        <Text style={styles.skillChipText}>{s}</Text>
                    </View>
                ))}
            </View>
        );
    };

    const openDetail = (job: Job) => {
        const data = selectedCat === 'All'
            ? jobs
            : jobs.filter(j => normalizeCategory(j.category).toLowerCase() === selectedCat.toLowerCase());

        const index = data.findIndex(it => it.id === job.id);
        if (index >= 0) {
            listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.1 });
            setTimeout(() => { setDetailJob(job); setShowDetail(true); }, 180);
        } else {
            setDetailJob(job);
            setShowDetail(true);
        }
    };

    const openApply = (job: Job) => {
        setApplyJob(job);
        setShowApply(true);
    };

    const renderJob = ({ item }: { item: Job }) => (
        <View style={styles.card}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.desc}>{item.description}</Text>

            {renderSkillsRow(item.skills)}

            {!!item.posterAddress && (
                <Text style={[styles.desc, { marginTop: 2 }]} numberOfLines={2}>
                    Đ/c người đăng: {item.posterAddress}
                </Text>
            )}

            <View style={styles.bottomRow}>
                <Text style={styles.location}>{item.location}</Text>
                <Text style={styles.price}>{currency(item.budget)}</Text>
            </View>
            <View style={styles.actions}>
                <Pressable style={styles.btnOutline} onPress={() => openDetail(item)}>
                    <Text style={styles.btnOutlineText}>Xem chi tiết</Text>
                </Pressable>
                <Pressable style={styles.btnPrimary} onPress={() => openApply(item)}>
                    <Text style={styles.btnPrimaryText}>Nộp hồ sơ</Text>
                </Pressable>
            </View>
        </View>
    );

    const listData = useMemo(() => {
        if (selectedCat === 'All') return jobs;
        const cat = selectedCat.toLowerCase();
        return jobs.filter(j => normalizeCategory(j.category).toLowerCase() === cat);
    }, [jobs, selectedCat]);

    return (
        <View style={styles.container}>
            <View style={styles.headerRow}>
                <View>
                    <Text style={styles.headerTitle}>Việc làm</Text>
                    <Text style={styles.headerSub}>
                        Xin chào, <Text style={{ fontWeight: '700', color: COLORS.text }}>{displayName}</Text>
                        {!!user?.uid && <Text style={{ color: COLORS.mutedText }}> · UID {shortUid(user.uid)}</Text>}
                    </Text>
                </View>
                <Pressable style={styles.postBtn} onPress={() => setShowPost(true)}>
                    <Text style={styles.postBtnText}>Đăng việc</Text>
                </Pressable>
            </View>

            <View style={styles.categoryWrap}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.categoryContainer}
                    keyboardShouldPersistTaps="handled"
                >
                    {CATEGORIES.map(cat => {
                        const active = cat === selectedCat;
                        return (
                            <Pressable key={cat} onPress={() => setSelectedCat(cat)} style={[styles.chip, active && styles.chipActive]}>
                                <Text style={[styles.chipText, active && styles.chipTextActive]}>{cat}</Text>
                            </Pressable>
                        );
                    })}
                </ScrollView>
            </View>

            {loading ? (
                <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 30 }} />
            ) : listData.length === 0 ? (
                <View style={{ alignItems: 'center', marginTop: 40 }}>
                    <Text style={{ color: COLORS.mutedText, fontSize: 14 }}>Không có công việc nào.</Text>
                </View>
            ) : (
                <FlatList
                    ref={listRef}
                    data={listData}
                    keyExtractor={(it) => it.id}
                    renderItem={renderJob}
                    contentContainerStyle={[
                        styles.listContainer,
                        showDetail && { paddingBottom: DETAIL_SHEET_PADDING },
                    ]}
                    onScrollToIndexFailed={(info) => {
                        const { index, highestMeasuredFrameIndex, averageItemLength } = info;
                        const offset = Math.max(0, (highestMeasuredFrameIndex + 1) * (averageItemLength || 120));
                        listRef.current?.scrollToOffset({ offset, animated: true });
                        setTimeout(() => {
                            listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.1 });
                        }, 180);
                    }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
                />
            )}

            <PostJobModal
                visible={showPost}
                onClose={() => setShowPost(false)}
                onPosted={() => {}}
                user={user}
                defaultPosterName={displayName}
            />

            <JobDetailModal
                visible={showDetail}
                job={detailJob}
                onClose={() => setShowDetail(false)}
                onApply={(j) => openApply(j)}
            />

            <ApplyJobModal
                visible={showApply}
                onClose={() => setShowApply(false)}
                job={applyJob}
                user={user}
                displayName={displayName}
            />
        </View>
    );
};

export default JobsTab;

/* ----------------------- Styles ----------------------- */
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    headerRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
        paddingHorizontal: 18, paddingTop: 14, paddingBottom: 8,
    },
    headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text },
    headerSub: { marginTop: 2, fontSize: 12, color: COLORS.mutedText },
    postBtn: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 6 },
    postBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.text },
    categoryWrap: { marginBottom: 6, marginTop: 4 },
    categoryContainer: { paddingHorizontal: 16, alignItems: 'center' },
    chip: {
        alignSelf: 'center', height: 36, paddingHorizontal: 16, borderRadius: 18,
        marginHorizontal: 4, justifyContent: 'center', backgroundColor: '#F2F4F5',
    },
    chipActive: { backgroundColor: COLORS.primary },
    chipText: { color: COLORS.text, fontSize: 13, fontWeight: '500' },
    chipTextActive: { color: '#fff', fontWeight: '700' },
    listContainer: { paddingHorizontal: 16, paddingBottom: 24 },
    card: {
        backgroundColor: COLORS.card, borderRadius: 14, padding: 14,
        marginBottom: 12, borderWidth: 1, borderColor: COLORS.border,
    },
    title: { fontSize: 15, fontWeight: '800', color: COLORS.text, marginBottom: 4 },
    desc: { fontSize: 13, color: COLORS.mutedText, marginBottom: 8 },
    skillChip: {
        paddingHorizontal: 10, paddingVertical: 6,
        borderRadius: 12, backgroundColor: COLORS.chip, borderWidth: 1, borderColor: '#D7DEE8',
    },
    skillChipText: { fontSize: 12, color: COLORS.text, fontWeight: '600' },
    bottomRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
    location: { fontSize: 12, color: COLORS.mutedText },
    price: { fontSize: 14, fontWeight: '800', color: COLORS.text },
    actions: { flexDirection: 'row' },
    btnOutline: { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingVertical: 9, alignItems: 'center', marginRight: 8 },
    btnOutlineText: { fontSize: 13, fontWeight: '700', color: COLORS.text },
    btnPrimary: { flex: 1, backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 9, alignItems: 'center' },
    btnPrimaryText: { fontSize: 13, fontWeight: '800', color: '#fff' },

    modalSheet: {
        backgroundColor: '#fff',
        padding: 18,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 16,
    },
    modalTitle: { fontSize: 22, fontWeight: '900', color: COLORS.text, marginBottom: 8 },
    fieldBlock: { marginTop: 10 },
    label: { color: COLORS.text, fontWeight: '800', marginBottom: 6 },
    input: {
        backgroundColor: COLORS.subtle,
        borderWidth: 1, borderColor: COLORS.border,
        borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12,
        color: COLORS.text, fontSize: 14,
    },
    btn: { flex: 1, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    btnGhost: { backgroundColor: COLORS.subtle, borderWidth: 1, borderColor: COLORS.border },
    btnPrimaryBig: { backgroundColor: COLORS.primary },
    btnText: { fontSize: 15, fontWeight: '800' },

    detailCard: {
        backgroundColor: COLORS.card,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: COLORS.border,
        padding: 12,
        marginBottom: 12,
    },
    detailTitle: { fontSize: 18, fontWeight: '900', color: COLORS.text, marginBottom: 6 },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 6,
    },
    detailLabel: { color: COLORS.mutedText, fontWeight: '600' },
    detailValue: { color: COLORS.text, fontWeight: '700' },
    divider: { height: 1, backgroundColor: COLORS.divider, marginVertical: 4, borderRadius: 1 },

    // Upload area
    uploadDrop: {
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: COLORS.border,
        backgroundColor: COLORS.subtle,
        borderRadius: 12,
        minHeight: 64,
        alignItems: 'center',
        justifyContent: 'center',
    },
    uploadInfo: {
        padding: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 12,
        backgroundColor: COLORS.subtle,
    },
    progressWrap: {
        height: 6,
        backgroundColor: COLORS.divider,
        borderRadius: 6,
        overflow: 'hidden',
    },
    progressBar: {
        height: 6,
        backgroundColor: COLORS.primary,
    },
});
