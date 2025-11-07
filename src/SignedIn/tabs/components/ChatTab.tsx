import React from 'react';
import { View, Text } from 'react-native';
import type { FirebaseAuthTypes } from '@react-native-firebase/auth';
import type { Freelancer } from '../components/MyJobsTab.tsx';

type Props = { user: FirebaseAuthTypes.User; displayName?: string; peer?: Freelancer | null; };
const ChatTab: React.FC<Props> = ({ user, displayName, peer }) => {
    return (
        <View style={{ flex: 1, padding: 16 }}>
            <Text style={{ fontSize: 18, fontWeight: '700' }}>
                {peer ? `Chat với ${peer.name}` : 'Danh sách Chat'}
            </Text>
            <Text style={{ marginTop: 8 }}>Xin chào {displayName ?? 'bạn'} • UID: {user.uid}</Text>
            {peer && (
                <Text style={{ marginTop: 8 }}>
                    Chuyên mục: {peer.category} • Rating: {peer.rating}
                </Text>
            )}
        </View>
    );
};
export default ChatTab;
