import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, TouchableOpacity, Image } from 'react-native';
import { Text, Appbar, TextInput, Button, IconButton, ActivityIndicator, Divider } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { ScreenWrapper, NeoCard, NeoButton } from '../../components/ui';
import { theme } from '../../theme';
import { useAuthStore } from '../../store/authStore';

export default function CreatePackagingScreen() {
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
        { id: 'P001', name: '冷冻鲈鱼片', icon: 'fish' },
        { id: 'P002', name: '鲜虾仁', icon: 'shrimp' }, // Note: 'shrimp' might not be a valid icon, using fallback
        { id: 'P003', name: '带鱼段', icon: 'fish' },
        { id: 'P004', name: '鱿鱼圈', icon: 'circle-outline' },
    ];

    const handleNext = () => {
        if (currentStep === 1 && !selectedProduct) return Alert.alert('提示', '请选择产品');
        if (currentStep === 2 && !quantity) return Alert.alert('提示', '请输入重量');
        setCurrentStep(c => c + 1);
    };

    const handleSubmit = async () => {
        setLoading(true);
        try {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1500));
            Alert.alert('打包完成', '标签已打印，请贴标', [
                { text: '确定', onPress: () => navigation.goBack() }
            ]);
        } catch (error) {
            Alert.alert('失败', '请重试');
        } finally {
            setLoading(false);
        }
    };

    const renderStep = () => {
        switch (currentStep) {
            case 1: // Select Product
                return (
                    <View style={styles.stepContainer}>
                        <Text variant="headlineSmall" style={styles.title}>第一步: 选择产品</Text>
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
                        <Text variant="headlineSmall" style={styles.title}>第二步: 规格与数量</Text>

                        <Text style={styles.label}>单箱重量 (kg)</Text>
                        <TextInput
                            style={styles.bigInput}
                            value={quantity}
                            onChangeText={setQuantity}
                            keyboardType="numeric"
                            mode="outlined"
                            right={<TextInput.Affix text="kg" />}
                        />

                        <Text style={styles.label}>箱数</Text>
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
                        <Text variant="headlineSmall" style={styles.title}>第三步: 确认并打印</Text>

                        <NeoCard style={styles.summaryCard} padding="l">
                            <View style={styles.row}>
                                <Text style={styles.label}>产品:</Text>
                                <Text style={styles.value}>{product?.name}</Text>
                            </View>
                            <Divider style={styles.divider} />
                            <View style={styles.row}>
                                <Text style={styles.label}>规格:</Text>
                                <Text style={styles.value}>{quantity} kg/箱</Text>
                            </View>
                            <Divider style={styles.divider} />
                            <View style={styles.row}>
                                <Text style={styles.label}>数量:</Text>
                                <Text style={styles.value}>{boxCount} 箱</Text>
                            </View>
                            <Divider style={styles.divider} />
                            <View style={styles.totalRow}>
                                <Text style={styles.totalLabel}>总重量:</Text>
                                <Text style={styles.totalValue}>
                                    {(parseFloat(quantity || '0') * parseInt(boxCount)).toFixed(1)} kg
                                </Text>
                            </View>
                        </NeoCard>

                        <View style={styles.printPreview}>
                            <IconButton icon="printer" size={32} />
                            <Text>将自动打印 {boxCount} 张标签</Text>
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
                <Appbar.Content title={`产品包装 (步骤 ${currentStep}/3)`} />
            </Appbar.Header>

            <ScrollView contentContainerStyle={styles.content}>
                {renderStep()}

                <View style={styles.actions}>
                    {currentStep > 1 && (
                        <Button mode="outlined" onPress={() => setCurrentStep(c => c - 1)} style={styles.btn}>
                            上一步
                        </Button>
                    )}

                    {currentStep < 3 ? (
                        <Button mode="contained" onPress={handleNext} style={[styles.btn, { flex: 1 }]}>
                            下一步
                        </Button>
                    ) : (
                        <Button
                            mode="contained"
                            onPress={handleSubmit}
                            loading={loading}
                            style={[styles.btn, { flex: 1 }]}
                            icon="printer"
                        >
                            打印标签并完成
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
