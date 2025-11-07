import { StyleSheet } from 'react-native';
import { COLORS } from '../../config/AppConfig';

const authBaseStyles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background, paddingHorizontal: 25, paddingTop: 50 },
    scrollContainer: { flexGrow: 1, paddingBottom: 40, alignItems: 'center' },
    title: { width: '100%', fontSize: 40, fontWeight: 'bold', color: COLORS.text, marginBottom: 30, textAlign: 'left' },
    input: {
        width: '100%', padding: 18, borderRadius: 12, marginBottom: 15,
        backgroundColor: COLORS.textInputBackground,
        color: COLORS.textInputColor, fontSize: 18,
    },
    button: {
        width: '100%', padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 20,
        backgroundColor: COLORS.primary,
        shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 6,
    },
    buttonText: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold' },
    switchContainer: { flexDirection: 'row', marginTop: 20, padding: 10 },
    switchBaseText: { color: COLORS.text, fontSize: 16 },
    switchLinkText: { color: COLORS.primary, fontSize: 16, fontWeight: 'bold' },
});
export default authBaseStyles;
