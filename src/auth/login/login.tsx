import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, StatusBar, Alert, StyleSheet,
} from 'react-native';
import auth from '@react-native-firebase/auth';
import { COLORS } from '../../config/AppConfig';

type Props = { onSwitchAuth?: () => void };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const mapFirebaseError = (code?: string, message?: string) => {
    switch (code) {
        case 'auth/invalid-email': return 'Email không hợp lệ';
        case 'auth/user-disabled': return 'Tài khoản đã bị vô hiệu hóa';
        case 'auth/user-not-found':
        case 'auth/wrong-password': return 'Email hoặc mật khẩu sai';
        case 'auth/too-many-requests': return 'Thử quá nhiều lần, vui lòng thử lại sau';
        case 'auth/network-request-failed': return 'Lỗi mạng, vui lòng kiểm tra kết nối';
        default: return message ?? 'Đăng nhập thất bại';
    }
};

const Login: React.FC<Props> = ({ onSwitchAuth }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    // ✅ Nút bấm được khi có dữ liệu; validate kỹ lúc bấm
    const canTap = useMemo(() => {
        return email.trim().length > 0 && password.length > 0 && !loading;
    }, [email, password, loading]);

    const handleLogin = async () => {
        if (!canTap) return;
        const trimmedEmail = email.trim();
        if (!EMAIL_RE.test(trimmedEmail)) {
            setErr('Email không hợp lệ');
            return;
        }
        if (password.length < 6) {
            setErr('Mật khẩu tối thiểu 6 ký tự');
            return;
        }
        try {
            setLoading(true);
            setErr(null);
            await auth().signInWithEmailAndPassword(trimmedEmail, password);
        } catch (e: any) {
            const msg = mapFirebaseError(e?.code, e?.message);
            setErr(msg);
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
                <Text style={styles.title}>Đăng nhập</Text>

                <View style={styles.field}>
                    <Text style={styles.label}>Email</Text>
                    <TextInput
                        value={email}
                        onChangeText={(t) => { setEmail(t); if (err) setErr(null); }}
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
                            onChangeText={(t) => { setPassword(t); if (err) setErr(null); }}
                            secureTextEntry={!showPass}
                            placeholder="••••••••"
                            placeholderTextColor={COLORS.textSecondary ?? '#9aa0a6'}
                            style={styles.input}
                            returnKeyType="done"
                            onSubmitEditing={handleLogin}
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
                </View>

                {!!err && <Text style={styles.errText}>{err}</Text>}

                <TouchableOpacity
                    onPress={handleLogin}
                    disabled={!canTap}
                    style={[
                        styles.submitBtn,
                        { backgroundColor: canTap ? COLORS.primary : (COLORS.primary + '66') },
                    ]}
                    activeOpacity={0.85}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.submitText}>Đăng nhập</Text>
                    )}
                </TouchableOpacity>

                {!!onSwitchAuth && (
                    <TouchableOpacity
                        onPress={onSwitchAuth}
                        style={{ marginTop: 16, alignItems: 'center' }}
                    >
                        <Text style={{ color: COLORS.primary, fontWeight: '700' }}>
                            Chưa có tài khoản? Đăng ký
                        </Text>
                    </TouchableOpacity>
                )}

                <TouchableOpacity
                    onPress={() => Alert.alert('Quên mật khẩu', 'Hãy dùng chức năng “Quên mật khẩu” sau khi bạn triển khai.')}
                    style={{ marginTop: 12, alignItems: 'center' }}
                >
                    <Text style={{ color: COLORS.textSecondary ?? COLORS.text }}>
                        Quên mật khẩu?
                    </Text>
                </TouchableOpacity>
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
        borderColor: '#e5e7eb',
    },
    eyeBtn: {
        position: 'absolute',
        right: 12,
        top: 10,
        paddingHorizontal: 8,
        paddingVertical: 6,
    },
    submitBtn: {
        height: 48,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 8,
    },
    submitText: { color: '#fff', fontWeight: '800' },
    errText: {
        color: '#d00',
        marginVertical: 8,
        fontWeight: '600',
    },
});

export default Login;
