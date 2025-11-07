import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ActivityIndicator, StatusBar } from 'react-native';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import AuthRouter from '../SkillHub/src/AuthRouter/AuthRouter';
import Home from './src/SignedIn/Home';

const App: React.FC = () => {
    const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);
    const [init, setInit] = useState(true);
    const mountedRef = useRef(true);
    useEffect(() => {
        mountedRef.current = true;
        const unsubscribe = auth().onAuthStateChanged((u) => {
            if (!mountedRef.current) return;
            setUser(u);
            setInit(false);
        });return () => {
            mountedRef.current = false;
            unsubscribe();
        };
    }, []);
    if (init) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <StatusBar barStyle="dark-content" />
                <ActivityIndicator size="large" />
                <Text style={{ marginTop: 8 }}>Đang khởi tạo…</Text>
            </View>
        );
    }
    return user ? <Home user={user} /> : <AuthRouter />;
};
export default App;
