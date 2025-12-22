// src/SignedIn/tabs/components/ChatTab.tsx
import React, {
    useEffect,
    useState,
    useContext,
    useMemo,
    useRef,
    useCallback,
} from 'react';
import {
    View,
    Text,
    TextInput,
    FlatList,
    Pressable,
    Platform,
    StatusBar,
    KeyboardAvoidingView,
    Alert,
} from 'react-native';
import {
    SafeAreaInsetsContext,
    type EdgeInsets,
} from 'react-native-safe-area-context';
import type { FirebaseAuthTypes } from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import FeatherIcon from 'react-native-vector-icons/Feather';
import { COLORS as APP_COLORS } from '../../../config/AppConfig';
import type { Freelancer } from './MyJobsTab';

const COLORS = {
    text: APP_COLORS?.text ?? '#000E08',
    primary: APP_COLORS?.primary ?? '#24786D',
    background: '#FFFFFF',
    muted: '#6B7280',
    border: '#E5E7EB',
    surface: '#FFFFFF',
    myBubble: '#24786D',
    otherBubble: '#EFF6FF',
};

/* ================= TYPES ================= */

export type Conversation = {
    id: string;
    memberIds: string[];
    title?: string;
    lastMessageText?: string;
    lastSenderId?: string;
    lastSenderName?: string;
    updatedAt?: Date | null;

    // optional cached peer fields (not trusted)
    peerId?: string;
    peerName?: string;
    peerAvatar?: string;

    unreadCount?: number;
};

type Message = {
    id: string;
    text: string;
    senderId: string;
    senderName?: string;
    createdAt?: Date | null;
};

type Props = {
    user: FirebaseAuthTypes.User;
    displayName: string;

    /**
     * peer: freelancer you want to open chat with.
     * MUST have peerUid (firebase auth uid) in one of:
     * - peer.ownerUid  (recommended)
     * - peer.uid
     * - peer.userId
     */
    peer?: (Freelancer & { ownerUid?: string; uid?: string; userId?: string }) | null;
};

/* ================= HELPERS ================= */

const colConversations = () => firestore().collection('conversations');

const toDate = (v: any): Date | null => {
    if (!v) return null;
    if (v instanceof Date) return v;
    if (v?.toDate) return v.toDate();
    return null;
};

const formatTime = (d?: Date | null) => {
    if (!d) return '';
    const hh = d.getHours().toString().padStart(2, '0');
    const mm = d.getMinutes().toString().padStart(2, '0');
    return `${hh}:${mm}`;
};

const getInitials = (name?: string) => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return (parts[0][0] || '?').toUpperCase();
    return (((parts[0][0] || '') + (parts[parts.length - 1][0] || '')).toUpperCase());
};

function getPeerUid(peer?: Props['peer']): string | null {
    if (!peer) return null;
    const uid = (peer as any).ownerUid || (peer as any).uid || (peer as any).userId;
    return typeof uid === 'string' && uid.length > 0 ? uid : null;
}

function getPeerUidFromConv(conv: Conversation | null, myUid: string): string | null {
    if (!conv) return null;
    const ids = Array.isArray(conv.memberIds) ? conv.memberIds : [];
    const other = ids.find(id => id && id !== myUid);
    return other ?? null;
}

/* ================= HOOKS ================= */

function useConversations(userId: string | null) {
    const [items, setItems] = useState<Conversation[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userId) {
            setItems([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        const q = colConversations()
            .where('memberIds', 'array-contains', userId)
            .orderBy('updatedAt', 'desc');

        const unsub = q.onSnapshot(
            snap => {
                const rows: Conversation[] = snap.docs.map(d => {
                    const data = d.data() as any;
                    const unreadKey = `unread_${userId}`;
                    const unreadCount = typeof data[unreadKey] === 'number' ? data[unreadKey] : 0;

                    return {
                        id: d.id,
                        memberIds: Array.isArray(data.memberIds) ? data.memberIds : [],
                        title: data.title || data.peerName,
                        lastMessageText: data.lastMessageText,
                        lastSenderId: data.lastSenderId,
                        lastSenderName: data.lastSenderName,
                        updatedAt: toDate(data.updatedAt),

                        peerId: data.peerId,
                        peerName: data.peerName,
                        peerAvatar: data.peerAvatar,

                        unreadCount,
                    };
                });

                setItems(rows);
                setLoading(false);
            },
            err => {
                console.warn('Load conversations error', err);
                setLoading(false);
            },
        );

        return () => unsub();
    }, [userId]);

    return { items, loading };
}

function useMessages(conversationId: string | null) {
    const [items, setItems] = useState<Message[]>([]);

    useEffect(() => {
        if (!conversationId) {
            setItems([]);
            return;
        }

        const ref = firestore()
            .collection('conversations')
            .doc(conversationId)
            .collection('messages')
            .orderBy('createdAt', 'asc');

        const unsub = ref.onSnapshot(
            snap => {
                const rows: Message[] = snap.docs.map(d => {
                    const data = d.data() as any;
                    return {
                        id: d.id,
                        text: data.text ?? '',
                        senderId: data.senderId ?? '',
                        senderName: data.senderName,
                        createdAt: toDate(data.createdAt),
                    };
                });
                setItems(rows);
            },
            err => {
                console.warn('Load messages error', err);
            },
        );

        return () => unsub();
    }, [conversationId]);

    return { items };
}

/* ================= UI COMPONENTS ================= */

const ConversationItem: React.FC<{
    conv: Conversation;
    onPress?: () => void;
}> = ({ conv, onPress }) => {
    const name = conv.title || conv.peerName || 'Mọi người';
    const subtitle = conv.lastMessageText || '';
    const timeLabel = formatTime(conv.updatedAt);
    const unread = conv.unreadCount ?? 0;

    return (
        <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
            <View
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    backgroundColor: COLORS.surface,
                }}
            >
                <View
                    style={{
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        backgroundColor: '#F3F4F6',
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginRight: 12,
                    }}
                >
                    <Text style={{ fontWeight: '600', fontSize: 16, color: COLORS.text }}>
                        {getInitials(name)}
                    </Text>
                </View>

                <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: '600', color: COLORS.text }}>
                        {name}
                    </Text>
                    <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 14, color: COLORS.muted }}>
                        {subtitle}
                    </Text>
                </View>

                <View style={{ marginLeft: 8, alignItems: 'flex-end', justifyContent: 'center' }}>
                    {!!timeLabel && (
                        <Text style={{ fontSize: 12, color: COLORS.muted, marginBottom: unread > 0 ? 4 : 0 }}>
                            {timeLabel}
                        </Text>
                    )}
                    {unread > 0 && (
                        <View
                            style={{
                                minWidth: 22,
                                height: 22,
                                borderRadius: 11,
                                backgroundColor: '#22C55E',
                                justifyContent: 'center',
                                alignItems: 'center',
                                paddingHorizontal: 6,
                            }}
                        >
                            <Text style={{ fontSize: 12, fontWeight: '600', color: '#FFFFFF' }}>
                                {unread}
                            </Text>
                        </View>
                    )}
                </View>
            </View>
        </Pressable>
    );
};

const MessageBubble: React.FC<{
    msg: Message;
    isMine: boolean;
    onLongPress?: () => void;
}> = ({ msg, isMine, onLongPress }) => {
    return (
        <Pressable
            onLongPress={onLongPress}
            delayLongPress={400}
            style={{
                paddingHorizontal: 16,
                marginVertical: 4,
                flexDirection: 'row',
                justifyContent: isMine ? 'flex-end' : 'flex-start',
            }}
        >
            <View
                style={{
                    maxWidth: '80%',
                    borderRadius: 18,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    backgroundColor: isMine ? COLORS.myBubble : COLORS.otherBubble,
                }}
            >
                {!!msg.senderName && !isMine && (
                    <Text style={{ fontSize: 11, marginBottom: 2, color: COLORS.muted }}>
                        {msg.senderName}
                    </Text>
                )}
                <Text style={{ fontSize: 14, color: isMine ? '#FFFFFF' : COLORS.text }}>
                    {msg.text}
                </Text>
            </View>
        </Pressable>
    );
};

/* ================= MAIN ================= */

const ChatTab: React.FC<Props> = ({ user, displayName, peer }) => {
    const currentUid = user.uid;

    const insetsFromCtx = useContext(SafeAreaInsetsContext);
    const insets: EdgeInsets = insetsFromCtx || { top: 0, bottom: 0, left: 0, right: 0 };

    const [search, setSearch] = useState('');
    const [activeConv, setActiveConv] = useState<Conversation | null>(null);
    const [input, setInput] = useState('');

    const { items, loading } = useConversations(currentUid);
    const { items: messages } = useMessages(activeConv?.id ?? null);

    const flatListRef = useRef<FlatList<Message>>(null);

    // lock theo peerUid để tránh tạo trùng nhiều lần
    const openedPeerUidRef = useRef<string | null>(null);

    // uid của freelancer cần auto-open
    const peerUid = useMemo(() => getPeerUid(peer), [peer]);

    const markRead = useCallback(
        async (convId: string) => {
            try {
                const myUnreadKey = `unread_${currentUid}`;
                await firestore().collection('conversations').doc(convId).update({
                    [myUnreadKey]: 0,
                });
            } catch (e: any) {
                console.warn('markRead error', e?.code, e?.message, e);
            }
        },
        [currentUid],
    );

    useEffect(() => {
        StatusBar.setBarStyle('dark-content', true);
        if (Platform.OS === 'android') StatusBar.setBackgroundColor('#FFFFFF');
    }, []);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return items;
        return items.filter(c => {
            const name = c.title || c.peerName || 'Mọi người';
            const subtitle = c.lastMessageText || '';
            return name.toLowerCase().includes(q) || subtitle.toLowerCase().includes(q);
        });
    }, [items, search]);

    const handleOpenConversation = useCallback(
        (c: Conversation) => {
            const realPeerUid = getPeerUidFromConv(c, currentUid);

            // đảm bảo peerId luôn là uid đối phương (để handleSend increment đúng)
            const normalized: Conversation = {
                ...c,
                peerId: realPeerUid ?? c.peerId,
            };

            setActiveConv(normalized);
            markRead(c.id);

            setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: false });
            }, 200);
        },
        [currentUid, markRead],
    );

    const handleBackToList = useCallback(() => {
        setActiveConv(null);
        setInput('');
    }, []);

    /* ===== AUTO OPEN / CREATE 1–1 WITH FREELANCER ===== */
    useEffect(() => {
        if (!peerUid) return;
        if (!currentUid) return;
        if (loading) return;
        if (activeConv) return;

        if (openedPeerUidRef.current === peerUid) return;

        const existing = items.find(c => {
            const isByMembers =
                Array.isArray(c.memberIds) &&
                c.memberIds.includes(currentUid) &&
                c.memberIds.includes(peerUid);
            return isByMembers;
        });
        if (existing) {
            openedPeerUidRef.current = peerUid;
            handleOpenConversation(existing);
            return;
        }
        openedPeerUidRef.current = peerUid;
        let cancelled = false;
        (async () => {
            try {
                const convRef = colConversations().doc();
                const now = firestore.FieldValue.serverTimestamp();
                const data: any = {
                    memberIds: [currentUid, peerUid],
                    title: peer?.name ?? 'Chat',
                    // NOTE: peerId trong DB không đáng tin cho cả 2 phía, nhưng vẫn lưu để debug
                    peerId: peerUid,
                    peerName: peer?.name ?? '',
                    peerAvatar: (peer as any)?.avatar ?? null,

                    createdAt: now,
                    updatedAt: now,
                    lastMessageText: '',
                    lastSenderId: '',
                    lastSenderName: '',

                    [`unread_${currentUid}`]: 0,
                    [`unread_${peerUid}`]: 0,
                };
                await convRef.set(data);
                if (cancelled) return;
                const conv: Conversation = {
                    id: convRef.id,
                    memberIds: data.memberIds,
                    title: data.title,
                    lastMessageText: '',
                    lastSenderId: undefined,
                    lastSenderName: undefined,
                    updatedAt: null,
                    peerId: peerUid, // uid đối phương
                    peerName: data.peerName,
                    peerAvatar: data.peerAvatar ?? undefined,
                    unreadCount: 0,
                };

                setActiveConv(conv);
                markRead(convRef.id);
            } catch (e: any) {
                openedPeerUidRef.current = null;
                console.warn('Create conversation for peer error', e?.code, e?.message, e);
                Alert.alert('Lỗi', 'Không thể tạo cuộc trò chuyện. Kiểm tra Firestore Rules / peerUid.');
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [peerUid, peer, currentUid, items, activeConv, loading, markRead, handleOpenConversation]);
    const handleSend = useCallback(async () => {
        const text = input.trim();
        if (!text || !currentUid || !activeConv) return;
        // ✅ lấy uid đối phương từ memberIds là chuẩn nhất
        const peerUid2 =
            getPeerUidFromConv(activeConv, currentUid) ||
            activeConv.peerId ||
            '';
        const senderName = displayName || user.displayName || user.email || '';
        try {
            const convRef = firestore().collection('conversations').doc(activeConv.id);
            const msgRef = convRef.collection('messages').doc();
            const now = firestore.FieldValue.serverTimestamp();
            await firestore().runTransaction(async tx => {
                tx.set(msgRef, {
                    text,
                    senderId: currentUid,
                    senderName,
                    createdAt: now,
                });
                const updateData: any = {
                    lastMessageText: text,
                    lastSenderId: currentUid,
                    lastSenderName: senderName,
                    updatedAt: now,
                    [`unread_${currentUid}`]: 0,
                };
                // ✅ tăng unread cho đúng đối phương
                if (typeof peerUid2 === 'string' && peerUid2.length > 0 && peerUid2 !== currentUid) {
                    updateData[`unread_${peerUid2}`] = firestore.FieldValue.increment(1);
                }

                tx.update(convRef, updateData);
            });
            setInput('');
            setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);
        } catch (e: any) {
            console.warn('Send message error', e?.code, e?.message, e);
            Alert.alert('Lỗi', 'Không gửi được tin nhắn. Kiểm tra Firestore Rules.');
        }
    }, [input, currentUid, activeConv, displayName, user.displayName, user.email]);
    const handleDeleteMessage = useCallback(
        (msg: Message) => {
            if (!activeConv) return;
            Alert.alert(
                'Xóa tin nhắn',
                'Bạn có chắc muốn xóa tin nhắn này cho cả cuộc trò chuyện?',
                [
                    { text: 'Hủy', style: 'cancel' },
                    {
                        text: 'Xóa',
                        style: 'destructive',
                        onPress: async () => {
                            try {
                                const convRef = firestore().collection('conversations').doc(activeConv.id);
                                const msgRef = convRef.collection('messages').doc(msg.id);

                                const snap = await msgRef.get();
                                if (!snap.exists) return;

                                await msgRef.delete();

                                const lastSnap = await convRef
                                    .collection('messages')
                                    .orderBy('createdAt', 'desc')
                                    .limit(1)
                                    .get();

                                if (lastSnap.empty) {
                                    await convRef.update({
                                        lastMessageText: '',
                                        lastSenderId: '',
                                        lastSenderName: '',
                                        updatedAt: firestore.FieldValue.serverTimestamp(),
                                    });
                                } else {
                                    const last = lastSnap.docs[0].data() as any;
                                    await convRef.update({
                                        lastMessageText: last.text ?? '',
                                        lastSenderId: last.senderId ?? '',
                                        lastSenderName: last.senderName ?? '',
                                        updatedAt: last.createdAt ?? firestore.FieldValue.serverTimestamp(),
                                    });
                                }
                            } catch (e: any) {
                                console.warn('Delete message error', e?.code, e?.message, e);
                            }
                        },
                    },
                ],
                { cancelable: true },
            );
        },
        [activeConv],
    );
    const renderList = () => (
        <View
            style={{
                flex: 1,
                backgroundColor: COLORS.background,
                paddingTop: insets.top + 8,
            }}
        >
            <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
                <Text
                    style={{
                        fontSize: 22,
                        fontWeight: '700',
                        color: COLORS.text,
                        marginBottom: 12,
                    }}
                >
                    Tin nhắn
                </Text>
                <View
                    style={{
                        height: 40,
                        borderRadius: 999,
                        backgroundColor: '#F3F4F6',
                        justifyContent: 'center',
                        paddingHorizontal: 16,
                    }}
                >
                    <TextInput
                        value={search}
                        onChangeText={setSearch}
                        placeholder="Tìm kiếm tin nhắn..."
                        placeholderTextColor={COLORS.muted}
                        style={{ fontSize: 14, paddingVertical: 0, color: COLORS.text }}
                    />
                </View>
            </View>
            <FlatList
                data={filtered}
                keyExtractor={it => it.id}
                ItemSeparatorComponent={() => (
                    <View style={{ height: 1, backgroundColor: COLORS.border, marginLeft: 72 }} />
                )}
                renderItem={({ item }) => (
                    <ConversationItem conv={item} onPress={() => handleOpenConversation(item)} />
                )}
                contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
                ListEmptyComponent={
                    <View style={{ paddingTop: 40, alignItems: 'center' }}>
                        <Text style={{ fontSize: 14, color: COLORS.muted }}>
                            {loading ? 'Đang tải cuộc trò chuyện...' : 'Chưa có cuộc trò chuyện nào.'}
                        </Text>
                    </View>
                }
            />
        </View>
    );
    const renderDetail = () => {
        const title = activeConv?.title || activeConv?.peerName || 'Tin nhắn';
        return (
            <View style={{ flex: 1, backgroundColor: COLORS.background, paddingTop: insets.top }}>
                {/* HEADER */}
                <View
                    style={{
                        height: 64,
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: 16,
                        borderBottomWidth: 1,
                        borderColor: COLORS.border,
                        backgroundColor: COLORS.surface,
                    }}
                >
                    <Pressable
                        onPress={handleBackToList}
                        style={({ pressed }) => ({
                            padding: 8,
                            marginRight: 8,
                            borderRadius: 999,
                            opacity: pressed ? 0.6 : 1,
                        })}
                    >
                        <FeatherIcon name="arrow-left" size={22} color={COLORS.text} />
                    </Pressable>
                    <View
                        style={{
                            width: 44,
                            height: 44,
                            borderRadius: 22,
                            backgroundColor: '#F3F4F6',
                            justifyContent: 'center',
                            alignItems: 'center',
                            marginRight: 12,
                        }}
                    >
                        <Text style={{ fontWeight: '700', color: COLORS.text }}>
                            {getInitials(title)}
                        </Text>
                    </View>

                    <View style={{ flex: 1 }}>
                        <Text numberOfLines={1} style={{ fontSize: 18, fontWeight: '700', color: COLORS.text }}>
                            {title}
                        </Text>
                        <Text style={{ marginTop: 2, fontSize: 13, color: COLORS.muted }}>
                            Active now
                        </Text>
                    </View>
                </View>
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    keyExtractor={it => it.id}
                    renderItem={({ item }) => (
                        <MessageBubble
                            msg={item}
                            isMine={item.senderId === currentUid}
                            onLongPress={() => handleDeleteMessage(item)}
                        />
                    )}
                    contentContainerStyle={{ paddingTop: 8, paddingBottom: 8 }}
                    onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                />
                {/* INPUT */}
                <View
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderTopWidth: 1,
                        borderColor: COLORS.border,
                        backgroundColor: COLORS.surface,
                        paddingBottom: insets.bottom || 8,
                    }}
                >
                    <TextInput
                        value={input}
                        onChangeText={setInput}
                        placeholder="Nhập tin nhắn..."
                        placeholderTextColor={COLORS.muted}
                        style={{
                            flex: 1,
                            fontSize: 14,
                            paddingVertical: Platform.OS === 'ios' ? 8 : 4,
                            paddingHorizontal: 12,
                            borderRadius: 999,
                            borderWidth: 1,
                            borderColor: COLORS.border,
                            backgroundColor: '#F9FAFB',
                            color: COLORS.text,
                        }}
                        multiline
                    />
                    <Pressable
                        onPress={handleSend}
                        style={({ pressed }) => ({
                            marginLeft: 8,
                            paddingHorizontal: 16,
                            paddingVertical: 8,
                            borderRadius: 999,
                            backgroundColor: COLORS.primary,
                            opacity: pressed ? 0.8 : 1,
                        })}
                    >
                        <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>Gửi</Text>
                    </Pressable>
                </View>
            </View>
        );
    };
    return (
        <KeyboardAvoidingView
            style={{ flex: 1, backgroundColor: COLORS.background }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 60 : 0}
        >
            {activeConv ? renderDetail() : renderList()}
        </KeyboardAvoidingView>
    );
};

export default ChatTab;
