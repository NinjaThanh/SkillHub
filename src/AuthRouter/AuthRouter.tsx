import React, { useState, useCallback } from 'react';
import { View, StatusBar } from 'react-native';
import Login from "../auth/login/login.tsx";
import Sign from '../auth/Sign/Sign.tsx';

import { COLORS } from '../config/AppConfig';
const AuthRouter: React.FC = () => {
    const [mode, setMode] = useState<'login' | 'sign'>('login');
    const toggle = useCallback(() => setMode(m => (m === 'login' ? 'sign' : 'login')), []);
    return (
        <View style={{ flex: 1, backgroundColor: COLORS.background }}>
            <StatusBar barStyle="dark-content" />
            {mode === 'login' ? (
                <Login onSwitchAuth={toggle} />
            ) : (
                <Sign onSwitchAuth={toggle} />
            )}
        </View>
    );
};

export default AuthRouter;
