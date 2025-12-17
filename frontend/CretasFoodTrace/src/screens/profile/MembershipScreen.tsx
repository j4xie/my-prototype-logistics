import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, ImageBackground, Dimensions } from 'react-native';
import { Text, IconButton, ProgressBar } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { ScreenWrapper, NeoCard } from '../../components/ui';
import { theme } from '../../theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function MembershipScreen() {
    const navigation = useNavigation();

    // Mock data
    const memberLevel = 'BRONZE MEMBER';
    const points = 0;
    const nextTierProgress = 0.3; // 30%

    const benefits = [
        { id: 1, title: 'Merchant\nCoupons', icon: 'gift-outline', color: '#FF6B6B' },
        { id: 2, title: 'Platform\nCoupons', icon: 'ticket-percent-outline', color: '#FF8E53' },
        { id: 3, title: 'Points\nMall', icon: 'storefront-outline', color: '#FF9F43' },
        { id: 4, title: 'Group\nBuy', icon: 'account-group-outline', color: '#FECA57' },
    ];

    const services = [
        { id: 1, title: 'Points Mall', subtitle: 'Redeem', icon: 'store', color: '#FFB900', route: 'PointsMall' },
        { id: 2, title: 'Points Balance', subtitle: '0 Points', icon: 'wallet', color: '#00A8E8', route: 'PointsHistory' },
        { id: 3, title: 'My Coupons', subtitle: '2 Available', icon: 'ticket-account', color: '#FF5252', route: 'MyCoupons', badge: 2 },
        { id: 4, title: 'Refer Friends', subtitle: 'Earn', icon: 'share-variant', color: '#00C853', route: 'Referral' },
    ];

    return (
        <ScreenWrapper edges={['top']} backgroundColor="#F8F9FA">
            {/* Custom Header */}
            <View style={styles.header}>
                <IconButton icon="arrow-left" size={24} onPress={() => navigation.goBack()} />
                <Text style={styles.headerTitle}>Membership Center</Text>
                <IconButton icon="bell-outline" size={24} onPress={() => { }} />
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

                {/* Luxury Member Card */}
                <View style={styles.cardContainer}>
                    <LinearGradient
                        colors={['#C5A028', '#E5C558', '#B8860B']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.memberCard}
                    >
                        {/* Texture Overlay (simulated with semi-transparent circles) */}
                        <View style={styles.textureCircle1} />
                        <View style={styles.textureCircle2} />

                        <View style={styles.cardHeader}>
                            <View>
                                <Text style={styles.cardLabel}>POMELOX MEMBER</Text>
                                <Text style={styles.cardTitle}>{memberLevel}</Text>
                            </View>
                            <View style={styles.memberBadge}>
                                <Text style={styles.memberBadgeText}>P</Text>
                            </View>
                        </View>

                        <View style={styles.pointsContainer}>
                            <Text style={styles.pointsValue}>{points}</Text>
                            <Text style={styles.pointsLabel}>Points</Text>
                        </View>

                        <View style={styles.progressContainer}>
                            <View style={styles.progressHeader}>
                                <Text style={styles.progressText}>rewards.next_tier_progress</Text>
                                <Text style={styles.progressText}>{(nextTierProgress * 100).toFixed(0)}%</Text>
                            </View>
                            <ProgressBar progress={nextTierProgress} color="rgba(255,255,255,0.9)" style={styles.progressBar} />
                        </View>
                    </LinearGradient>
                </View>

                {/* Member Benefits */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Member Benefits</Text>
                    <NeoCard style={styles.benefitsCard} padding="m" variant="elevated">
                        <View style={styles.benefitsGrid}>
                            {benefits.map((item) => (
                                <TouchableOpacity key={item.id} style={styles.benefitItem} activeOpacity={0.7}>
                                    <View style={[styles.benefitIconContainer, { backgroundColor: `${item.color}15` }]}>
                                        <MaterialCommunityIcons name={item.icon as any} size={28} color={item.color} />
                                    </View>
                                    <Text style={styles.benefitTitle}>{item.title}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </NeoCard>
                </View>

                {/* Services */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Services</Text>
                    <View style={styles.servicesGrid}>
                        {services.map((item) => (
                            <TouchableOpacity key={item.id} style={styles.serviceCardWrapper} activeOpacity={0.8}>
                                <NeoCard style={styles.serviceCard} padding="m">
                                    <View style={[styles.serviceIconBox, { backgroundColor: `${item.color}20` }]}>
                                        <MaterialCommunityIcons name={item.icon as any} size={24} color={item.color} />
                                    </View>
                                    <View style={styles.serviceInfo}>
                                        <Text style={styles.serviceTitle}>{item.title}</Text>
                                        <Text style={styles.serviceSubtitle}>{item.subtitle}</Text>
                                    </View>
                                    {item.badge && (
                                        <View style={styles.badge}>
                                            <Text style={styles.badgeText}>{item.badge}</Text>
                                        </View>
                                    )}
                                </NeoCard>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

            </ScrollView>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 8,
        paddingVertical: 8,
        backgroundColor: '#F8F9FA',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1A1A1A',
    },
    content: {
        padding: 16,
        paddingBottom: 40,
    },
    cardContainer: {
        marginBottom: 24,
        borderRadius: 20,
        shadowColor: '#B8860B',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
    },
    memberCard: {
        padding: 24,
        borderRadius: 20,
        minHeight: 180,
        position: 'relative',
        overflow: 'hidden',
    },
    textureCircle1: {
        position: 'absolute',
        top: -50,
        right: -50,
        width: 200,
        height: 200,
        borderRadius: 100,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    textureCircle2: {
        position: 'absolute',
        bottom: -30,
        left: -30,
        width: 150,
        height: 150,
        borderRadius: 75,
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 20,
    },
    cardLabel: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.8)',
        letterSpacing: 1,
        marginBottom: 4,
        fontWeight: '600',
    },
    cardTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#FFFFFF',
        letterSpacing: 0.5,
    },
    memberBadge: {
        width: 32,
        height: 32,
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    memberBadgeText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontSize: 16,
    },
    pointsContainer: {
        flexDirection: 'row',
        alignItems: 'baseline',
        marginBottom: 24,
    },
    pointsValue: {
        fontSize: 40,
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginRight: 8,
    },
    pointsLabel: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.9)',
        fontWeight: '500',
    },
    progressContainer: {
        marginTop: 'auto',
    },
    progressHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    progressText: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.8)',
    },
    progressBar: {
        height: 6,
        borderRadius: 3,
        backgroundColor: 'rgba(0,0,0,0.1)',
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1A1A1A',
        marginBottom: 16,
        marginLeft: 4,
    },
    benefitsCard: {
        borderRadius: 16,
        backgroundColor: '#FFFFFF',
    },
    benefitsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    benefitItem: {
        alignItems: 'center',
        flex: 1,
    },
    benefitIconContainer: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    benefitTitle: {
        fontSize: 12,
        color: '#4A4A4A',
        textAlign: 'center',
        lineHeight: 16,
    },
    servicesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    serviceCardWrapper: {
        width: (width - 32 - 12) / 2, // 2 columns with gap
    },
    serviceCard: {
        padding: 16,
        height: 120,
        justifyContent: 'space-between',
        borderRadius: 16,
        backgroundColor: '#FFFFFF',
    },
    serviceIconBox: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    serviceInfo: {
        flex: 1,
    },
    serviceTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1A1A1A',
        marginBottom: 4,
    },
    serviceSubtitle: {
        fontSize: 12,
        color: '#888888',
    },
    badge: {
        position: 'absolute',
        top: 12,
        right: 12,
        backgroundColor: '#FF5252',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 10,
    },
    badgeText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: 'bold',
    },
});
