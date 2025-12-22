// src/auth/Sign/Sign.tsx
import React, { useMemo, useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    StatusBar,
    Alert,            // ✅ giữ import Alert từ 'react-native'
    StyleSheet,
    Switch,
} from 'react-native';
import auth from '@react-native-firebase/auth';
import { COLORS } from '../../config/AppConfig';

type Props = { onSwitchAuth?: () => void };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const mapFirebaseError = (code?: string, message?: string) => {
    switch (code) {
        case 'auth/email-already-in-use':
            return 'Email đã được sử dụng';
        case 'auth/invalid-email':
            return 'Email không hợp lệ';
        case 'auth/weak-password':
            return 'Mật khẩu quá yếu (tối thiểu 6 ký tự)';
        case 'auth/network-request-failed':
            return 'Lỗi mạng, vui lòng kiểm tra kết nối';
        default:
            return message ?? 'Đăng ký thất bại';
    }
};

// ✅ Alert an toàn, tránh bật liên tục khi state rerender/catch lặp
let lastAlertAt = 0;
const safeAlert = (title: string, message?: string) => {
    const now = Date.now();
    if (now - lastAlertAt < 1500) return; // debounce 1.5s
    lastAlertAt = now;
    // Alert cần string thuần; đảm bảo không undefined/null
    Alert.alert(String(title || 'Thông báo'), String(message || ''));
};

// Đánh giá đơn giản độ mạnh mật khẩu (tuỳ chọn)
const getPasswordHint = (pw: string) => {
    const len = pw.length >= 8;
    const number = /\d/.test(pw);
    const upper = /[A-Z]/.test(pw);
    const lower = /[a-z]/.test(pw);
    const special = /[^A-Za-z0-9]/.test(pw);
    const ok = len && number && upper && lower;
    const level = [len, number, upper, lower, special].filter(Boolean).length;

    return {
        ok,
        level, // 0–5
        text: level >= 4 ? 'Mạnh' : level >= 3 ? 'Trung bình' : 'Yếu',
    };
};

const Sign: React.FC<Props> = ({ onSwitchAuth }) => {
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [agree, setAgree] = useState(false);

    const [showPass, setShowPass] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const passHint = useMemo(() => getPasswordHint(password), [password]);

    const canSubmit = useMemo(() => {
        return (
            EMAIL_RE.test(email.trim()) &&
            password.length >= 6 &&
            confirm === password &&
            agree &&
            !loading
        );
    }, [email, password, confirm, agree, loading]);

    const handleSignUp = async () => {
        if (!canSubmit) {
            // ✅ thông báo nhanh nếu người dùng bấm khi form chưa hợp lệ
            safeAlert('Chưa đủ điều kiện', 'Vui lòng điền đúng thông tin trước khi đăng ký.');
            return;
        }
        try {
            setLoading(true);
            setErr(null);

            const { user } = await auth().createUserWithEmailAndPassword(
                email.trim(),
                password
            );

            if (fullName.trim()) {
                try {
                    await user.updateProfile({ displayName: fullName.trim() });
                } catch {
                    // không chặn luồng nếu lỗi updateProfile
                }
            }

            try {
                await user.sendEmailVerification();
                safeAlert('Đã gửi email xác minh', 'Vui lòng kiểm tra hộp thư của bạn.');
            } catch {
                // không chặn luồng nếu lỗi gửi email
            }

            // onAuthStateChanged sẽ điều hướng sang Home
        } catch (e: any) {
            const msg = mapFirebaseError(e?.code, e?.message);
            setErr(msg);
            safeAlert('Đăng ký thất bại', msg); // ✅ dùng Alert.alert có title + message là string
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={{ flex: 1, backgroundColor: COLORS.background }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <StatusBar barStyle="dark-content" />
            <View style={styles.container}>
                <Text style={styles.title}>Tạo tài khoản</Text>

                <View style={styles.field}>
                    <Text style={styles.label}>Họ và tên</Text>
                    <TextInput
                        value={fullName}
                        onChangeText={setFullName}
                        placeholder="Nguyễn Văn A"
                        placeholderTextColor={COLORS.textSecondary ?? '#9aa0a6'}
                        style={styles.input}
                        returnKeyType="next"
                    />
                </View>

                <View style={styles.field}>
                    <Text style={styles.label}>Email</Text>
                    <TextInput
                        value={email}
                        onChangeText={setEmail}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="email-address"
                        placeholder="you@example.com"
                        placeholderTextColor={COLORS.textSecondary ?? '#9aa0a6'}
                        style={styles.input}
                        returnKeyType="next"
                    />
                </View>
                <View style={styles.field}>
                    <Text style={styles.label}>Mật khẩu</Text>
                    <View style={{ position: 'relative' }}>
                        <TextInput
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry={!showPass}
                            placeholder="Ít nhất 6 ký tự"
                            placeholderTextColor={COLORS.textSecondary ?? '#9aa0a6'}
                            style={styles.input}
                            returnKeyType="next"
                        />
                        <TouchableOpacity
                            onPress={() => setShowPass((s) => !s)}
                            style={styles.eyeBtn}
                            activeOpacity={0.7}
                        >
                            <Text style={{ color: COLORS.primary, fontWeight: '700' }}>
                                {showPass ? 'Ẩn' : 'Hiện'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                    {!!password && (
                        <Text
                            style={[
                                styles.hint,
                                { color: passHint.ok ? '#059669' : (COLORS.textSecondary ?? COLORS.text) },
                            ]}
                        >
                            Độ mạnh: {passHint.text}
                        </Text>
                    )}
                </View>

                <View style={styles.field}>
                    <Text style={styles.label}>Xác nhận mật khẩu</Text>
                    <View style={{ position: 'relative' }}>
                        <TextInput
                            value={confirm}
                            onChangeText={setConfirm}
                            secureTextEntry={!showConfirm}
                            placeholder="Nhập lại mật khẩu"
                            placeholderTextColor={COLORS.textSecondary ?? '#9aa0a6'}
                            style={styles.input}
                            returnKeyType="done"
                            onSubmitEditing={handleSignUp}
                        />
                        <TouchableOpacity
                            onPress={() => setShowConfirm((s) => !s)}
                            style={styles.eyeBtn}
                            activeOpacity={0.7}
                        >
                            <Text style={{ color: COLORS.primary, fontWeight: '700' }}>
                                {showConfirm ? 'Ẩn' : 'Hiện'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                    {!!confirm && confirm !== password && (
                        <Text style={[styles.hint, { color: '#DC2626' }]}>
                            Mật khẩu xác nhận không khớp
                        </Text>
                    )}
                </View>

                <View style={styles.row}>
                    <Switch value={agree} onValueChange={setAgree} />
                    <Text style={{ marginLeft: 8, color: COLORS.textSecondary ?? COLORS.text }}>
                        Tôi đồng ý với Điều khoản & Chính sách
                    </Text>
                </View>

                {!!err && <Text style={styles.errText}>{err}</Text>}

                <TouchableOpacity
                    onPress={handleSignUp}
                    disabled={!canSubmit}
                    style={[
                        styles.submitBtn,
                        { backgroundColor: canSubmit ? COLORS.primary : (COLORS.primary + '66') },
                    ]}
                    activeOpacity={0.85}
                >
                    {loading ? <ActivityIndicator color="#fff" /> : (
                        <Text style={styles.submitText}>Đăng ký</Text>
                    )}
                </TouchableOpacity>

                {!!onSwitchAuth && (
                    <TouchableOpacity
                        onPress={onSwitchAuth}
                        style={{ marginTop: 16, alignItems: 'center' }}
                    >
                        <Text style={{ color: COLORS.primary, fontWeight: '700' }}>
                            Đã có tài khoản? Đăng nhập
                        </Text>
                    </TouchableOpacity>
                )}
            </View>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, padding: 24, justifyContent: 'center' },
    title: {
        fontSize: 26,
        fontWeight: '800',
        color: COLORS.text,
        marginBottom: 24,
        textAlign: 'center',
    },
    field: { marginBottom: 14 },
    label: {
        color: COLORS.textSecondary ?? COLORS.text,
        marginBottom: 6,
        fontWeight: '600',
    },
    input: {
        height: 48,
        backgroundColor: '#fff',
        borderRadius: 12,
        paddingHorizontal: 14,
        color: COLORS.text,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    eyeBtn: { position: 'absolute', right: 12, top: 10, paddingHorizontal: 8, paddingVertical: 6 },
    hint: { marginTop: 6 },
    row: { marginTop: 6, flexDirection: 'row', alignItems: 'center' },
    submitBtn: { height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
    submitText: { color: '#fff', fontWeight: '800' },
    errText: { color: '#DC2626', marginTop: 6, fontWeight: '600' },
});
export default Sign;
