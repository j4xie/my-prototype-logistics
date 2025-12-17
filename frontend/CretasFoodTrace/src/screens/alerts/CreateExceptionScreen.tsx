import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, TouchableOpacity, Image } from 'react-native';
import { Text, Appbar, TextInput, Button, IconButton, ActivityIndicator } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { ScreenWrapper, NeoCard, NeoButton } from '../../components/ui';
import { theme } from '../../theme';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../../store/authStore';
import { alertApiClient } from '../../services/api/alertApiClient';

export default function CreateExceptionScreen() {
    const navigation = useNavigation();
    const { user } = useAuthStore();
    const [currentStep, setCurrentStep] = useState(1);
    const [loading, setLoading] = useState(false);

    // Form Data
    const [exceptionType, setExceptionType] = useState('');
    const [details, setDetails] = useState('');
    const [photo, setPhoto] = useState<string | null>(null);

    const exceptionTypes = [
        { id: 'equipment', label: '设备故障', icon: 'cog-off', color: '#F44336' },
        { id: 'material', label: '原料问题', icon: 'fish-off', color: '#FF9800' },
        { id: 'safety', label: '安全隐患', icon: 'alert', color: '#D32F2F' },
        { id: 'other', label: '其他问题', icon: 'help-circle', color: '#2196F3' },
    ];

    const takePhoto = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('权限不足', '需要相机权限');
            return;
        }
        const result = await ImagePicker.launchCameraAsync({
            quality: 0.5,
            allowsEditing: true,
        });
        if (!result.canceled && result.assets[0]) {
            setPhoto(result.assets[0].uri);
        }
    };

    const handleSubmit = async () => {
        if (!exceptionType) return Alert.alert('提示', '请选择异常类型');
        if (!details) return Alert.alert('提示', '请描述具体情况');

        setLoading(true);
        try {
            // Mock API call for now, replace with actual API
            // await alertApiClient.createAlert({...});

            // Simulate delay
            await new Promise(resolve => setTimeout(resolve, 1000));

            Alert.alert('提交成功', '异常情况已上报，请等待处理', [
                { text: '确定', onPress: () => navigation.goBack() }
            ]);
        } catch (error) {
            Alert.alert('提交失败', '请稍后重试');
        } finally {
            setLoading(false);
        }
    };

    const renderStep = () => {
        switch (currentStep) {
            case 1:
                return (
                    <View style={styles.stepContainer}>
                        <Text variant="headlineSmall" style={styles.title}>第一步: 发生了什么?</Text>
                        <View style={styles.grid}>
                            {exceptionTypes.map((type) => (
                                <TouchableOpacity
                                    key={type.id}
                                    style={[
                                        styles.typeCard,
                                        exceptionType === type.id && { borderColor: type.color, borderWidth: 3, backgroundColor: type.color + '10' }
                                    ]}
                                    onPress={() => setExceptionType(type.id)}
                                >
                                    <IconButton icon={type.icon} size={48} iconColor={type.color} />
                                    <Text variant="titleMedium" style={{ color: type.color, fontWeight: 'bold' }}>{type.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                );
            case 2:
                return (
                    <View style={styles.stepContainer}>
                        <Text variant="headlineSmall" style={styles.title}>第二步: 详细情况</Text>

                        <TextInput
                            label="请描述具体问题..."
                            value={details}
                            onChangeText={setDetails}
                            mode="outlined"
                            multiline
                            numberOfLines={6}
                            style={styles.input}
                        />

                        <TouchableOpacity style={styles.photoButton} onPress={takePhoto}>
                            {photo ? (
                                <Image source={{ uri: photo }} style={styles.photoPreview} />
                            ) : (
                                <>
                                    <IconButton icon="camera" size={40} iconColor="#666" />
                                    <Text>点击拍照 (选填)</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                );
            case 3:
                return (
                    <View style={styles.stepContainer}>
                        <Text variant="headlineSmall" style={styles.title}>第三步: 确认上报</Text>

                        <NeoCard style={styles.summaryCard} padding="l">
                            <View style={styles.row}>
                                <Text style={styles.label}>类型:</Text>
                                <Text style={styles.value}>
                                    {exceptionTypes.find(t => t.id === exceptionType)?.label}
                                </Text>
                            </View>
                            <View style={styles.row}>
                                <Text style={styles.label}>描述:</Text>
                                <Text style={styles.value}>{details}</Text>
                            </View>
                            {photo && (
                                <View style={styles.row}>
                                    <Text style={styles.label}>照片:</Text>
                                    <Text style={styles.value}>已添加 1 张</Text>
                                </View>
                            )}
                        </NeoCard>
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
                <Appbar.Content title={`异常上报 (步骤 ${currentStep}/3)`} />
            </Appbar.Header>

            <ScrollView contentContainerStyle={styles.content}>
                {renderStep()}

                <View style={styles.actions}>
                    {currentStep > 1 && (
                        <NeoButton variant="secondary" onPress={() => setCurrentStep(c => c - 1)} style={styles.btn}>
                            上一步
                        </NeoButton>
                    )}

                    {currentStep < 3 ? (
                        <NeoButton
                            variant="primary"
                            onPress={() => {
                                if (currentStep === 1 && !exceptionType) return Alert.alert('提示', '请选择类型');
                                if (currentStep === 2 && !details) return Alert.alert('提示', '请填写描述');
                                setCurrentStep(c => c + 1);
                            }}
                            style={[styles.btn, { flex: 1 }]}
                        >
                            下一步
                        </NeoButton>
                    ) : (
                        <NeoButton
                            variant="primary"
                            onPress={handleSubmit}
                            loading={loading}
                            style={[styles.btn, { flex: 1, backgroundColor: '#F44336' }]}
                        >
                            确认上报
                        </NeoButton>
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
        color: '#333',
        marginBottom: 10,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16,
    },
    typeCard: {
        width: '47%',
        aspectRatio: 1,
        backgroundColor: 'white',
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 2,
    },
    input: {
        backgroundColor: 'white',
        fontSize: 18,
    },
    photoButton: {
        height: 200,
        backgroundColor: '#F5F5F5',
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#CCC',
        borderStyle: 'dashed',
        marginTop: 20,
        overflow: 'hidden',
    },
    photoPreview: {
        width: '100%',
        height: '100%',
    },
    summaryCard: {
        backgroundColor: '#FFF3E0',
    },
    row: {
        flexDirection: 'row',
        marginBottom: 12,
    },
    label: {
        width: 60,
        color: '#666',
        fontWeight: 'bold',
    },
    value: {
        flex: 1,
        color: '#333',
    },
    actions: {
        flexDirection: 'row',
        gap: 16,
        marginTop: 40,
    },
    btn: {
        flex: 1,
    },
});
