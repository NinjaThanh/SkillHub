// src/SignedIn/tabs/ProfileTab.tsx
import React from 'react';
import {
    View, Text, Image, TouchableOpacity, StyleSheet,
    ActivityIndicator, Platform, TextInput, Alert,
} from 'react-native';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import storage from '@react-native-firebase/storage';
import { launchImageLibrary, Asset } from 'react-native-image-picker';

const COLORS = {
    primary: '#4CAF50',
    text: '#0F172A',
    textSecondary: '#6B7280',
    border: '#E9EEF3',
    cardBg: '#FFFFFF',
    chip: '#EEF2F6',
    screenBg: '#FFFFFF',
};

type Props = {
    user: FirebaseAuthTypes.User;
    displayName: string;
    signingOut?: boolean;
    onSignOut?: () => void;
    onPostJob?: () => void;
    onPayment?: () => void;
    onChat?: () => void;
};

const ProfileTab: React.FC<Props> = ({
                                         user,
                                         displayName,
                                         signingOut = false,
                                         onSignOut,
                                         onPostJob,
                                         onPayment,
                                         onChat,
                                     }) => {
    const [editing, setEditing] = React.useState(false);
    const [uploadingAvatar, setUploadingAvatar] = React.useState(false);
    const [cacheBust, setCacheBust] = React.useState<string | undefined>(
        user.photoURL ? `${user.photoURL}` : undefined
    );
    const contentTypeFromExt = (ext: string) => {
        const e = ext.toLowerCase();
        if (e === 'jpg' || e === 'jpeg') return 'image/jpeg';
        if (e === 'png') return 'image/png';
        if (e === 'webp') return 'image/webp';
        if (e === 'heic') return 'image/heic';
        return 'image/jpeg';
    };
    const pickAndUploadAvatar = React.useCallback(async () => {
        if (uploadingAvatar) return;
        try {
            const res = await launchImageLibrary({
                mediaType: 'photo',
                selectionLimit: 1,
                //quality: 0.85,
                maxWidth: 1024,
                maxHeight: 1024,
                includeExtra: true,
                includeBase64: false,
            });
            const asset: Asset | undefined = res.assets?.[0];
            if (!asset?.uri) return;
            setUploadingAvatar(true);
            const originalName = asset.fileName ?? `avatar_${Date.now()}`;
            const origExt = (originalName.split('.').pop() || '').toLowerCase();
            const ext = ['heic', 'heif'].includes(origExt) ? 'jpg' : (origExt || 'jpg');
            const mime = ['heic', 'heif'].includes(origExt)
                ? 'image/jpeg'
                : (asset.type || contentTypeFromExt(ext));
            if (asset.fileSize != null && asset.fileSize >= 8 * 1024 * 1024) {
                Alert.alert('Ảnh quá lớn', 'Vui lòng chọn ảnh nhỏ hơn 8MB.');
                return;
            }
            const pathInBucket = `avatars/${user.uid}.${ext}`;
            const ref = storage().ref(pathInBucket);
            await ref.putFile(asset.uri, { contentType: mime });
            const url = await ref.getDownloadURL();
            await user.updateProfile({ photoURL: url });
            await user.reload();
            setCacheBust(`${url}?cb=${Date.now()}`);
            Alert.alert('Thành công', 'Đã cập nhật ảnh đại diện.');
        } catch (e: any) {
            const msg = e?.message ?? String(e);
            if (!msg.includes('User cancelled')) {
                Alert.alert('Lỗi', msg);
            }
        } finally {
            setUploadingAvatar(false);
        }
    }, [uploadingAvatar, user]);
    const [localName, setLocalName] = React.useState(displayName || '');
    const [savingName, setSavingName] = React.useState(false);
    const showName = localName?.trim() || 'Người dùng';
    const handleSaveName = async () => {
        try {
            setSavingName(true);
            const newName = localName.trim();
            await user.updateProfile({ displayName: newName || undefined });
            await user.reload();
            Alert.alert('Thành công', 'Đã cập nhật tên hiển thị.');
        } catch (e: any) {
            Alert.alert('Lỗi', e?.message ?? String(e));
        } finally {
            setSavingName(false);
        }
    };
    const handleCancelName = () => setLocalName(displayName || '');
    const [localEmail, setLocalEmail] = React.useState(user.email ?? '');
    const [currentPwForEmail, setCurrentPwForEmail] = React.useState('');
    const [savingEmail, setSavingEmail] = React.useState(false);
    const canPasswordReauth = !!user.email && (user.providerData || []).some(p => p.providerId === 'password');
    const reauthWithPassword = async (email: string, currentPw: string) => {
        const credential = auth.EmailAuthProvider.credential(email, currentPw);
        await user.reauthenticateWithCredential(credential);
    };
    const handleSaveEmail = async () => {
        const newEmail = localEmail.trim();
        if (!newEmail) {
            Alert.alert('Email không hợp lệ', 'Vui lòng nhập email mới.');
            return;
        }
        try {
            setSavingEmail(true);
            if (canPasswordReauth) {
                if (!currentPwForEmail) {
                    Alert.alert('Cần xác thực lại', 'Vui lòng nhập mật khẩu hiện tại để đổi email.');
                    return;
                }
                await reauthWithPassword(user.email!, currentPwForEmail);
            }
            await user.updateEmail(newEmail);
            await user.reload();
            Alert.alert('Thành công', 'Đã cập nhật email.');
            setCurrentPwForEmail('');
        } catch (e: any) {
            if (String(e?.code || '').includes('requires-recent-login')) {
                Alert.alert(
                    'Cần đăng nhập lại',
                    canPasswordReauth
                        ? 'Phiên đăng nhập đã cũ. Nhập đúng mật khẩu hiện tại rồi thử lại.'
                        : 'Phiên đăng nhập đã cũ. Hãy đăng nhập lại bằng Google/Apple rồi thử lại.'
                );
            } else {
                Alert.alert('Lỗi', e?.message ?? String(e));
            }
        } finally {
            setSavingEmail(false);
        }
    };
    const handleCancelEmail = () => {
        setLocalEmail(user.email ?? '');
        setCurrentPwForEmail('');
    };
    const [currentPw, setCurrentPw] = React.useState('');
    const [newPw, setNewPw] = React.useState('');
    const [confirmPw, setConfirmPw] = React.useState('');
    const [savingPw, setSavingPw] = React.useState(false);
    const handleSavePassword = async () => {
        if (newPw.length < 6) return Alert.alert('Mật khẩu yếu', 'Tối thiểu 6 ký tự.');
        if (newPw !== confirmPw) return Alert.alert('Không khớp', 'Xác nhận không trùng.');
        try {
            setSavingPw(true);
            if (!user.email) return Alert.alert('Không thể đổi', 'Tài khoản không có email/mật khẩu.');
            if (!currentPw) return Alert.alert('Thiếu mật khẩu', 'Nhập mật khẩu hiện tại để xác thực.');
            await reauthWithPassword(user.email, currentPw);
            await user.updatePassword(newPw);
            Alert.alert('Thành công', 'Đã cập nhật mật khẩu.');
            setCurrentPw(''); setNewPw(''); setConfirmPw('');
        } catch (e: any) {
            if (String(e?.code || '').includes('requires-recent-login')) {
                Alert.alert('Cần đăng nhập lại', 'Phiên đăng nhập đã cũ. Vui lòng đăng nhập lại.');
            } else {
                Alert.alert('Lỗi', e?.message ?? String(e));
            }
        } finally {
            setSavingPw(false);
        }
    };
    const handleCancelPassword = () => { setCurrentPw(''); setNewPw(''); setConfirmPw(''); };
    return (
        <View style={styles.screen}>
            <Text style={styles.header}>Hồ sơ của bạn</Text>

            <View style={styles.card}>
                {/* Avatar + info */}
                <View style={styles.row}>
                    <View style={styles.avatarWrap}>
                        <TouchableOpacity
                            onPress={pickAndUploadAvatar}
                            activeOpacity={0.8}
                            disabled={uploadingAvatar}
                        >
                            {cacheBust ? (
                                <Image
                                    source={{ uri: cacheBust }}
                                    style={[styles.avatar, uploadingAvatar && { opacity: 0.5 }]}
                                />
                            ) : (
                                <View style={[styles.avatar, styles.avatarPlaceholder, uploadingAvatar && { opacity: 0.5 }]} />
                            )}
                        </TouchableOpacity>

                        {uploadingAvatar && (
                            <View style={styles.avatarOverlay}>
                                <ActivityIndicator color="#fff" />
                            </View>
                        )}
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.userName}>{showName}</Text>
                        <Text style={styles.inlineInfo}>
                            <Text style={styles.inlineLabel}>UID: </Text>
                            <Text
                                style={[
                                    styles.inlineValue,
                                    { fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }) },
                                ]}
                                numberOfLines={1}
                            >
                                {user.uid}
                            </Text>
                        </Text>
                        {user.email ? (
                            <Text style={styles.inlineInfo}>
                                <Text style={styles.inlineLabel}>Email: </Text>
                                <Text style={styles.inlineValue}>
                                    {user.email}{' '}
                                    <Text style={{ color: COLORS.textSecondary }}>
                                        ({user.emailVerified ? 'Đã xác minh' : 'Chưa xác minh'})
                                    </Text>
                                </Text>
                            </Text>
                        ) : null}
                    </View>
                </View>
                {/* Nút hành động */}
                <View style={styles.actionsRow}>
                    <TouchableOpacity
                        style={[styles.actionBtn, styles.actionOutlined, { marginRight: 12 }]}
                        onPress={onPostJob}
                        disabled={uploadingAvatar}
                    >
                        <Text style={[styles.actionText, styles.actionDark, uploadingAvatar && { opacity: 0.5 }]}>
                            Đăng{'\n'}việc
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.actionBtn, styles.actionOutlined, { marginRight: 12 }]}
                        onPress={onPayment}
                        disabled={uploadingAvatar}
                    >
                        <Text style={[styles.actionText, styles.actionDark, uploadingAvatar && { opacity: 0.5 }]}>
                            Thanh{'\n'}toán
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.actionBtn, styles.actionFilled]}
                        onPress={onChat}
                        disabled={uploadingAvatar}
                    >
                        {uploadingAvatar
                            ? <ActivityIndicator color="#fff" />
                            : <Text style={[styles.actionText, styles.actionLight]}>Chat</Text>}
                    </TouchableOpacity>
                </View>
                {/* Toggle chỉnh sửa */}
                <TouchableOpacity
                    onPress={() => !uploadingAvatar && setEditing(v => !v)}
                    style={{ alignSelf: 'flex-start' }}
                >
                    <Text style={[styles.editLink, uploadingAvatar && { opacity: 0.5 }]}>
                        {editing ? 'Đóng chỉnh sửa' : 'Chỉnh sửa hồ sơ'}
                    </Text>
                </TouchableOpacity>
                <View style={styles.divider} />
                {/* Form chỉnh sửa */}
                {editing && (
                    <View
                        style={{ marginTop: 12, opacity: uploadingAvatar ? 0.6 : 1 }}
                        pointerEvents={uploadingAvatar ? 'none' : 'auto'}
                    >
                        {/* --- Tên hiển thị --- */}
                        <EditField
                            title="Tên hiển thị"
                            value={localName}
                            onChangeText={setLocalName}
                            onSave={handleSaveName}
                            onCancel={handleCancelName}
                            saving={savingName || uploadingAvatar}
                        />
                        {/* --- Email --- */}
                        <View style={styles.subDivider} />
                        <EditField
                            title="Đổi email"
                            value={localEmail}
                            onChangeText={setLocalEmail}
                            onSave={handleSaveEmail}
                            onCancel={handleCancelEmail}
                            saving={savingEmail || uploadingAvatar}
                            extraField={canPasswordReauth && (
                                <PasswordInput
                                    value={currentPwForEmail}
                                    onChangeText={setCurrentPwForEmail}
                                    placeholder="Mật khẩu hiện tại (để xác thực)"
                                    editable={!savingEmail && !uploadingAvatar}
                                />
                            )}
                        />
                        {!canPasswordReauth && (
                            <Text style={styles.helperNote}>
                                Tài khoản Google/Apple có thể cần đăng nhập lại để đổi email.
                            </Text>
                        )}
                        {/* --- Mật khẩu --- */}
                        <View style={styles.subDivider} />
                        <EditPassword
                            title="Đổi mật khẩu"
                            currentPw={currentPw}
                            newPw={newPw}
                            confirmPw={confirmPw}
                            setCurrentPw={setCurrentPw}
                            setNewPw={setNewPw}
                            setConfirmPw={setConfirmPw}
                            onSave={handleSavePassword}
                            onCancel={handleCancelPassword}
                            saving={savingPw || uploadingAvatar}
                        />
                    </View>
                )}
            </View>
            {!!onSignOut && (
                <TouchableOpacity
                    onPress={onSignOut}
                    disabled={signingOut || uploadingAvatar}
                    style={[
                        styles.signOutBtn,
                        { backgroundColor: (signingOut || uploadingAvatar) ? COLORS.primary + '88' : COLORS.primary }
                    ]}
                >
                    {(signingOut || uploadingAvatar) && <ActivityIndicator color="#fff" />}
                    <Text style={[styles.signOutText, { marginLeft: (signingOut || uploadingAvatar) ? 8 : 0 }]}>
                        {signingOut ? 'Đang đăng xuất…' : 'Đăng xuất'}
                    </Text>
                </TouchableOpacity>
            )}
        </View>
    );
};
// ===== Components phụ (typed) =====
type PasswordInputProps = {
    value: string;
    onChangeText: (v: string) => void;
    placeholder: string;
    editable?: boolean;
};
const PasswordInput: React.FC<PasswordInputProps> = ({ value, onChangeText, placeholder, editable = true }) => {
    const [visible, setVisible] = React.useState(false);
    return (
        <View style={styles.inputWrapper}>
            <TextInput
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor={COLORS.textSecondary}
                secureTextEntry={!visible}
                editable={editable}
                style={[styles.input, { paddingRight: 64 }]}
            />
            <TouchableOpacity
                onPress={() => setVisible(v => !v)}
                style={styles.eyeBtn}
                disabled={!editable}
            >
                <Text style={styles.eyeText}>{visible ? 'Ẩn' : 'Hiện'}</Text>
            </TouchableOpacity>
        </View>
    );
};
type EditFieldProps = {
    title: string;
    value: string;
    onChangeText: (v: string) => void;
    onSave: () => void;
    onCancel: () => void;
    saving: boolean;
    extraField?: React.ReactNode;
};
const EditField: React.FC<EditFieldProps> = ({ title, value, onChangeText, onSave, onCancel, saving, extraField }) => (
    <>
        <Text style={styles.sectionTitle}>{title}</Text>
        <TextInput
            value={value}
            onChangeText={onChangeText}
            placeholder={title}
            placeholderTextColor={COLORS.textSecondary}
            style={styles.input}
            editable={!saving}
        />
        {extraField}
        <FormAction onCancel={onCancel} onSave={onSave} saving={saving} label="Lưu" />
    </>
);
type EditPasswordProps = {
    title: string;
    currentPw: string;
    newPw: string;
    confirmPw: string;
    setCurrentPw: (v: string) => void;
    setNewPw: (v: string) => void;
    setConfirmPw: (v: string) => void;
    onSave: () => void;
    onCancel: () => void;
    saving: boolean;
};
const EditPassword: React.FC<EditPasswordProps> = ({title, currentPw, newPw, confirmPw, setCurrentPw, setNewPw, setConfirmPw, onSave, onCancel, saving,}) => (
    <>
        <Text style={styles.sectionTitle}>{title}</Text>
        <PasswordInput value={currentPw} onChangeText={setCurrentPw} placeholder="Mật khẩu hiện tại" editable={!saving} />
        <PasswordInput value={newPw} onChangeText={setNewPw} placeholder="Mật khẩu mới (≥ 6 ký tự)" editable={!saving} />
        <PasswordInput value={confirmPw} onChangeText={setConfirmPw} placeholder="Xác nhận mật khẩu mới" editable={!saving} />
        <FormAction onCancel={onCancel} onSave={onSave} saving={saving} label="Lưu mật khẩu" />
    </>
);
type FormActionProps = {
    onCancel: () => void;
    onSave: () => void;
    saving: boolean;
    label: string;
};
const FormAction: React.FC<FormActionProps> = ({ onCancel, onSave, saving, label }) => (
    <View style={styles.formActions}>
        <TouchableOpacity style={[styles.smallBtn, styles.outlinedBtn]} onPress={onCancel} disabled={saving}>
            <Text style={[styles.smallBtnText, { color: COLORS.text }]}>Hủy</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.smallBtn, styles.primaryBtn]} onPress={onSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={[styles.smallBtnText, { color: '#fff' }]}>{label}</Text>}
        </TouchableOpacity>
    </View>
);
const CARD_RADIUS = 18;
const styles = StyleSheet.create({
    screen: { flex: 1, padding: 16, backgroundColor: COLORS.screenBg },
    header: { color: COLORS.text, fontSize: 24, fontWeight: '800', marginBottom: 8 },
    card: {
        backgroundColor: COLORS.cardBg, borderRadius: CARD_RADIUS, padding: 16,
        borderWidth: 1, borderColor: COLORS.border,
        shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 2,
    },
    row: { flexDirection: 'row', alignItems: 'center' },
    avatarWrap: { width: 64, height: 64, marginRight: 12, position: 'relative' },
    avatar: { width: 64, height: 64, borderRadius: 32 },
    avatarPlaceholder: { backgroundColor: '#EFF3F7', borderRadius: 32 },
    avatarOverlay: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.25)',
        borderRadius: 32,
    },
    userName: { color: COLORS.text, fontSize: 18, fontWeight: '700', marginBottom: 4 },
    inlineInfo: { color: COLORS.text, marginTop: 2, fontSize: 14, lineHeight: 18 },
    inlineLabel: { color: COLORS.textSecondary },
    inlineValue: { color: COLORS.text, fontWeight: '600' },
    actionsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
    actionBtn: { flex: 1, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
    actionOutlined: { borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#FFFFFF' },
    actionFilled: { backgroundColor: COLORS.primary },
    actionText: { textAlign: 'center', fontWeight: '800', fontSize: 16, lineHeight: 20 },
    actionDark: { color: COLORS.text }, actionLight: { color: '#FFFFFF' },
    editLink: { marginTop: 10, color: COLORS.primary, fontWeight: '600', textDecorationLine: 'underline' },
    divider: { height: 1, backgroundColor: COLORS.border, marginTop: 12 },
    subDivider: { height: 1, backgroundColor: COLORS.border, marginTop: 16, marginBottom: 12 },
    input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, color: COLORS.text, marginBottom: 8 },
    inputWrapper: { position: 'relative' },
    eyeBtn: { position: 'absolute', right: 12, top: 10, height: 36, paddingHorizontal: 8, justifyContent: 'center', alignItems: 'center' },
    eyeText: { color: COLORS.primary, fontWeight: '700' },
    sectionTitle: { color: COLORS.text, fontSize: 16, fontWeight: '700', marginBottom: 8 },
    helperNote: { marginTop: 8, color: COLORS.textSecondary, fontSize: 13 },
    formActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 },
    smallBtn: { height: 42, borderRadius: 12, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
    outlinedBtn: { borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#fff' },
    primaryBtn: { backgroundColor: COLORS.primary },
    smallBtnText: { fontWeight: '700' },
    signOutBtn: { marginTop: 16, paddingVertical: 14, borderRadius: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
    signOutText: { color: '#fff', fontWeight: '700' },
});
export default ProfileTab;
