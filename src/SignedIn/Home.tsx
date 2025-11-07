// src/SignedIn/Home.tsx
import React, { useCallback, useEffect, useState } from 'react';
import {
    View,
    StatusBar,
    SafeAreaView,
    Alert,
    Platform,
    ActivityIndicator,
    Pressable,
    Text,
} from 'react-native';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { COLORS } from '../config/AppConfig';
import MyJobsTab, { Freelancer } from './tabs/components/MyJobsTab';
import JobsTab from './tabs/JobsTab';
import ChatTab from './tabs/components/ChatTab';
import ProfileTab from './tabs/ProfileTab';

export type TabKey = 'home' | 'jobs' | 'chat' | 'profile';
export type TabDef = { key: TabKey; label: string; icon: string };
export const INACTIVE = '#6E7A83';

export const TAB_DEFS: TabDef[] = [
    { key: 'home', label: 'My Jobs', icon: '🏠' },
    { key: 'jobs', label: 'Jobs', icon: '💼' },
    { key: 'chat', label: 'Chat', icon: '💬' },
    { key: 'profile', label: 'Profile', icon: '👤' },
];

const BottomTabBar: React.FC<{
    active: TabKey;
    onChange: (k: TabKey) => void;
}> = ({ active, onChange }) => (
    <View
        style={{
            flexDirection: 'row',
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderTopWidth: 1,
            borderTopColor: 'rgba(0,0,0,0.06)',
            backgroundColor: '#FFFFFF',
        }}
    >
        {TAB_DEFS.map((t) => {
            const isActive = active === t.key;
            return (
                <Pressable
                    key={t.key}
                    onPress={() => onChange(t.key)}
                    style={({ pressed }) => ({
                        flex: 1,
                        alignItems: 'center',
                        paddingVertical: 6,
                        opacity: pressed ? 0.85 : 1,
                    })}
                    accessibilityRole="button"
                    accessibilityLabel={t.label}
                >
                    <Text style={{ fontSize: 18 }}>{t.icon}</Text>
                    <Text
                        style={{
                            marginTop: 4,
                            fontSize: 12,
                            fontWeight: isActive ? '700' : '500',
                            color: isActive ? COLORS.primary : INACTIVE,
                        }}
                    >
                        {t.label}
                    </Text>
                </Pressable>
            );
        })}
    </View>
);

type Props = { user: FirebaseAuthTypes.User };
const Home: React.FC<Props> = ({ user }) => {
    const [active, setActive] = useState<TabKey>('home');
    const [signingOut, setSigningOut] = useState(false);
    const [displayName, setDisplayName] = useState<string>('Đang tải...');
    const [loadingName, setLoadingName] = useState<boolean>(true);
    const [chatPeer, setChatPeer] = useState<Freelancer | null>(null);

    useEffect(() => {
        const uid = user.uid;
        const fallbackName = user.displayName || user.email || 'Người dùng';
        const unsub = firestore()
            .collection('users')
            .doc(uid)
            .onSnapshot(
                (docSnap) => {
                    const data = docSnap.data() as
                        | { name?: string; displayName?: string; fullName?: string }
                        | undefined;
                    const nameFromDb = data?.name || data?.displayName || data?.fullName;
                    setDisplayName(nameFromDb || fallbackName);
                    setLoadingName(false);
                },
                () => {
                    setDisplayName(fallbackName);
                    setLoadingName(false);
                }
            );
        return () => unsub();
    }, [user.uid, user.displayName, user.email]);

    const onSignOut = useCallback(async () => {
        if (signingOut) return;
        try {
            setSigningOut(true);
            await auth().signOut();
        } catch (e: any) {
            Alert.alert('Đăng xuất thất bại', e?.message ?? 'Vui lòng thử lại');
            setSigningOut(false);
        }
    }, [signingOut]);

    const handleChat = useCallback((f: Freelancer) => {
        setChatPeer(f);
        setActive('chat');
    }, []);

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
            <StatusBar
                barStyle="dark-content"
                backgroundColor={Platform.OS === 'android' ? COLORS.background : undefined}
            />

            {loadingName ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
            ) : (
                <>
                    <View style={{ flex: 1, padding: 24 }}>
                        {active === 'home' && <MyJobsTab user={user} onChat={handleChat} />}
                        {active === 'jobs' && <JobsTab user={user} displayName={displayName} />}
                        {active === 'chat' && (
                            <ChatTab user={user} displayName={displayName} peer={chatPeer} />
                        )}
                        {active === 'profile' && (
                            <ProfileTab
                                user={user}
                                displayName={displayName}
                                signingOut={signingOut}
                                onSignOut={onSignOut}
                            />
                        )}
                    </View>

                    <BottomTabBar active={active} onChange={setActive} />
                </>
            )}
        </SafeAreaView>
    );
};
export default Home;
