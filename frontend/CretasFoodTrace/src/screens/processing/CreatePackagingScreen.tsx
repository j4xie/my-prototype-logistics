import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, TouchableOpacity, Image } from 'react-native';
import { Text, Appbar, TextInput, Button, IconButton, ActivityIndicator, Divider } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { ScreenWrapper, NeoCard, NeoButton } from '../../components/ui';
import { theme } from '../../theme';
import { useAuthStore } from '../../store/authStore';

export default function CreatePackagingScreen() {
    const { t } = useTranslation('processing');
    const navigation = useNavigation();
    const { user } = useAuthStore();
    const [currentStep, setCurrentStep] = useState(1);
    const [loading, setLoading] = useState(false);

    // Form Data
    const [selectedProduct, setSelectedProduct] = useState('');
    const [quantity, setQuantity] = useState('');
    const [boxCount, setBoxCount] = useState('1');

    // Mock Products
    const products = [
        { id: 'P001', name: t('packaging.products.frozenBass'), icon: 'fish' },
        { id: 'P002', name: t('packaging.products.shrimp'), icon: 'shrimp' }, // Note: 'shrimp' might not be a valid icon, using fallback
        { id: 'P003', name: t('packaging.products.ribbonFish'), icon: 'fish' },
        { id: 'P004', name: t('packaging.products.squidRings'), icon: 'circle-outline' },
    ];

    const handleNext = () => {
        if (currentStep === 1 && !selectedProduct) return Alert.alert(t('common.hint', { defaultValue: '提示' }), t('packaging.validation.selectProduct'));
        if (currentStep === 2 && !quantity) return Alert.alert(t('common.hint', { defaultValue: '提示' }), t('packaging.validation.enterWeight'));
        setCurrentStep(c => c + 1);
    };

    const handleSubmit = async () => {
        setLoading(true);
        try {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1500));
            Alert.alert(t('packaging.dialog.completeTitle'), t('packaging.dialog.completeMessage'), [
                { text: t('packaging.dialog.ok'), onPress: () => navigation.goBack() }
            ]);
        } catch (error) {
            Alert.alert(t('packaging.messages.failed'), t('packaging.messages.retry'));
        } finally {
            setLoading(false);
        }
    };

    const renderStep = () => {
        switch (currentStep) {
            case 1: // Select Product
                return (
                    <View style={styles.stepContainer}>
                        <Text variant="headlineSmall" style={styles.title}>{t('packaging.steps.selectProduct')}</Text>
                        <View style={styles.grid}>
                            {products.map((p) => (
                                <TouchableOpacity
                                    key={p.id}
                                    style={[
                                        styles.productCard,
                                        selectedProduct === p.id && styles.selectedCard
                                    ]}
                                    onPress={() => setSelectedProduct(p.id)}
                                >
                                    <IconButton
                                        icon={p.icon === 'shrimp' ? 'fish' : p.icon}
                                        size={48}
                                        iconColor={selectedProduct === p.id ? 'white' : theme.colors.primary}
                                    />
                                    <Text
                                        variant="titleMedium"
                                        style={[
                                            styles.productName,
                                            selectedProduct === p.id && styles.selectedText
                                        ]}
                                    >
                                        {p.name}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                );

            case 2: // Quantity & Boxes
                return (
                    <View style={styles.stepContainer}>
                        <Text variant="headlineSmall" style={styles.title}>{t('packaging.steps.specAndQuantity')}</Text>

                        <Text style={styles.label}>{t('packaging.fields.weightPerBox')}</Text>
                        <TextInput
                            style={styles.bigInput}
                            value={quantity}
                            onChangeText={setQuantity}
                            keyboardType="numeric"
                            mode="outlined"
                            right={<TextInput.Affix text="kg" />}
                        />

                        <Text style={styles.label}>{t('packaging.fields.boxCount')}</Text>
                        <View style={styles.counterContainer}>
                            <IconButton
                                icon="minus-circle-outline"
                                size={48}
                                onPress={() => setBoxCount(Math.max(1, parseInt(boxCount) - 1).toString())}
                            />
                            <Text variant="displayMedium" style={styles.counterText}>{boxCount}</Text>
                            <IconButton
                                icon="plus-circle-outline"
                                size={48}
                                onPress={() => setBoxCount((parseInt(boxCount) + 1).toString())}
                            />
                        </View>
                    </View>
                );

            case 3: // Confirm & Print
                const product = products.find(p => p.id === selectedProduct);
                return (
                    <View style={styles.stepContainer}>
                        <Text variant="headlineSmall" style={styles.title}>{t('packaging.steps.confirmAndPrint')}</Text>

                        <NeoCard style={styles.summaryCard} padding="l">
                            <View style={styles.row}>
                                <Text style={styles.label}>{t('packaging.fields.product')}:</Text>
                                <Text style={styles.value}>{product?.name}</Text>
                            </View>
                            <Divider style={styles.divider} />
                            <View style={styles.row}>
                                <Text style={styles.label}>{t('packaging.fields.specification')}:</Text>
                                <Text style={styles.value}>{quantity} kg/箱</Text>
                            </View>
                            <Divider style={styles.divider} />
                            <View style={styles.row}>
                                <Text style={styles.label}>{t('packaging.fields.quantity')}:</Text>
                                <Text style={styles.value}>{boxCount} 箱</Text>
                            </View>
                            <Divider style={styles.divider} />
                            <View style={styles.totalRow}>
                                <Text style={styles.totalLabel}>{t('packaging.fields.totalWeight')}:</Text>
                                <Text style={styles.totalValue}>
                                    {(parseFloat(quantity || '0') * parseInt(boxCount)).toFixed(1)} kg
                                </Text>
                            </View>
                        </NeoCard>

                        <View style={styles.printPreview}>
                            <IconButton icon="printer" size={32} />
                            <Text>{t('packaging.print.preview', { count: Number(boxCount) })}</Text>
                        </View>
                    </View>
                );
            default:
                return null;
        }
    };

    return (
        <ScreenWrapper edges={['top']} backgroundColor={theme.colors.background}>
            <Appbar.Header elevated>
                <Appbar.BackAction onPress={() => navigation.goBack()} />
                <Appbar.Content title={t('packaging.stepOf', { current: currentStep, total: 3 })} />
            </Appbar.Header>

            <ScrollView contentContainerStyle={styles.content}>
                {renderStep()}

                <View style={styles.actions}>
                    {currentStep > 1 && (
                        <Button mode="outlined" onPress={() => setCurrentStep(c => c - 1)} style={styles.btn}>
                            {t('packaging.actions.previous')}
                        </Button>
                    )}

                    {currentStep < 3 ? (
                        <Button mode="contained" onPress={handleNext} style={[styles.btn, { flex: 1 }]}>
                            {t('packaging.actions.next')}
                        </Button>
                    ) : (
                        <Button
                            mode="contained"
                            onPress={handleSubmit}
                            loading={loading}
                            style={[styles.btn, { flex: 1 }]}
                            icon="printer"
                        >
                            {t('packaging.actions.printAndComplete')}
                        </Button>
                    )}
                </View>
            </ScrollView>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    content: {
        padding: 20,
        flexGrow: 1,
        justifyContent: 'space-between',
    },
    stepContainer: {
        gap: 20,
    },
    title: {
        fontWeight: 'bold',
        color: '#1976D2',
        marginBottom: 10,
        textAlign: 'center',
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16,
    },
    productCard: {
        width: '47%',
        aspectRatio: 1,
        backgroundColor: 'white',
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 2,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    selectedCard: {
        backgroundColor: '#2196F3',
        borderColor: '#1976D2',
    },
    productName: {
        marginTop: 8,
        fontWeight: 'bold',
        color: '#333',
    },
    selectedText: {
        color: 'white',
    },
    label: {
        fontSize: 16,
        color: '#666',
        marginBottom: 8,
    },
    bigInput: {
        fontSize: 24,
        fontWeight: 'bold',
        textAlign: 'center',
        backgroundColor: 'white',
        marginBottom: 24,
    },
    counterContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 10,
    },
    counterText: {
        fontWeight: 'bold',
        minWidth: 60,
        textAlign: 'center',
    },
    summaryCard: {
        backgroundColor: 'white',
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 12,
    },
    value: {
        fontWeight: 'bold',
        fontSize: 18,
    },
    divider: {
        backgroundColor: '#E0E0E0',
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingTop: 16,
        marginTop: 8,
        borderTopWidth: 2,
        borderTopColor: '#E0E0E0',
    },
    totalLabel: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    totalValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#2196F3',
    },
    printPreview: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 20,
        backgroundColor: '#E3F2FD',
        padding: 10,
        borderRadius: 8,
    },
    actions: {
        flexDirection: 'row',
        gap: 16,
        marginTop: 40,
    },
    btn: {
        flex: 1,
        paddingVertical: 6,
    },
});
