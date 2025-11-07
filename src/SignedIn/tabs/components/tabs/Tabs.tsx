// src/SignedIn/tabs/components/navigation/Tabs.tsx

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import auth from '@react-native-firebase/auth';

// ⚠️ Adjust these paths if your folder layout differs.
// Avoid adding .tsx in import specifiers.
import MyJobsTab from '../MyJobsTab.tsx';
import ChatTab from '../../../tabs/components/ChatTab';
export type Freelancer = {
    id: string;
    name: string;
    category: string;
    rating: number;
    avatar?: string;
};
export type RootTabParamList = {
    MyJobs: undefined;
    Jobs: undefined;
    Chat: { peer?: Freelancer } | undefined;
    Profile: undefined;
};
declare global {
    namespace ReactNavigation {
        interface RootParamList extends RootTabParamList {}
    }
}
const Tab = createBottomTabNavigator<RootTabParamList>();

const Tabs: React.FC = () => {
    // In a "SignedIn" subtree this non-null assertion is fine.
    const user = auth().currentUser!;
    return (
        <NavigationContainer>
            <Tab.Navigator
                initialRouteName="MyJobs"
                screenOptions={{ headerShown: false }}
            >
                <Tab.Screen name="MyJobs" options={{ title: 'My Jobs' }}>
                    {({ navigation }) => (
                        <MyJobsTab
                            onChat={(f: Freelancer) => navigation.navigate('Chat', { peer: f })}
                            onPostJob={() => {}}
                            onWallet={() => {}}
                            onSeeAll={() => {}}
                        />
                    )}
                </Tab.Screen>
                <Tab.Screen name="Chat" options={{ title: 'Chat' }}>
                    {() => <ChatTab user={user} />}
                </Tab.Screen>
            </Tab.Navigator>
        </NavigationContainer>
    );
};
export default Tabs;
