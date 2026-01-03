/**
 * 修改密码页面
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Icon } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../../store/authStore';
import { userApiClient } from '../../../services/api/userApiClient';

export function ChangePasswordScreen() {
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const { t } = useTranslation('profile');
  const [loading, setLoading] = useState(false);
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [formData, setFormData] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [errors, setErrors] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const validateForm = (): boolean => {
    const newErrors = {
      oldPassword: '',
      newPassword: '',
      confirmPassword: '',
    };
    let isValid = true;

    if (!formData.oldPassword) {
      newErrors.oldPassword = t('changePassword.errors.oldPasswordRequired');
      isValid = false;
    }

    if (!formData.newPassword) {
      newErrors.newPassword = t('changePassword.errors.newPasswordRequired');
      isValid = false;
    } else if (formData.newPassword.length < 6) {
      newErrors.newPassword = t('changePassword.errors.passwordTooShort');
      isValid = false;
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = t('changePassword.errors.confirmPasswordRequired');
      isValid = false;
    } else if (formData.newPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = t('messages.passwordMismatch');
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);
      await userApiClient.changePassword(Number(user?.id), {
        oldPassword: formData.oldPassword,
        newPassword: formData.newPassword,
      });
      Alert.alert(t('messages.saveSuccess'), t('messages.passwordChanged'), [
        { text: t('changePassword.confirm'), onPress: () => navigation.goBack() }
      ]);
    } catch (error: any) {
      console.error('Change password failed:', error);
      const message = error?.response?.data?.message || t('changePassword.errors.changeFailed');
      Alert.alert(t('changePassword.errors.changeFailedTitle'), message);
    } finally {
      setLoading(false);
    }
  };

  const PasswordInput = ({
    label,
    value,
    onChange,
    show,
    toggleShow,
    error,
    placeholder,
  }: {
    label: string;
    value: string;
    onChange: (text: string) => void;
    show: boolean;
    toggleShow: () => void;
    error?: string;
    placeholder: string;
  }) => (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={[styles.inputWrapper, error ? styles.inputError : null]}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChange}
          secureTextEntry={!show}
          placeholder={placeholder}
          placeholderTextColor="#999"
        />
        <TouchableOpacity onPress={toggleShow} style={styles.eyeButton}>
          <Icon source={show ? 'eye-off' : 'eye'} size={22} color="#999" />
        </TouchableOpacity>
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon source="arrow-left" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>{t('changePassword.title')}</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.form}>
          <View style={styles.tipCard}>
            <Icon source="information" size={20} color="#667eea" />
            <Text style={styles.tipText}>
              {t('changePassword.passwordHint')}
            </Text>
          </View>

          <PasswordInput
            label={t('changePassword.currentPassword')}
            value={formData.oldPassword}
            onChange={(text) => setFormData({ ...formData, oldPassword: text })}
            show={showOldPassword}
            toggleShow={() => setShowOldPassword(!showOldPassword)}
            error={errors.oldPassword}
            placeholder={t('changePassword.currentPasswordPlaceholder')}
          />

          <PasswordInput
            label={t('changePassword.newPassword')}
            value={formData.newPassword}
            onChange={(text) => setFormData({ ...formData, newPassword: text })}
            show={showNewPassword}
            toggleShow={() => setShowNewPassword(!showNewPassword)}
            error={errors.newPassword}
            placeholder={t('changePassword.newPasswordPlaceholder')}
          />

          <PasswordInput
            label={t('changePassword.confirmPassword')}
            value={formData.confirmPassword}
            onChange={(text) => setFormData({ ...formData, confirmPassword: text })}
            show={showConfirmPassword}
            toggleShow={() => setShowConfirmPassword(!showConfirmPassword)}
            error={errors.confirmPassword}
            placeholder={t('changePassword.confirmPasswordPlaceholder')}
          />

          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            <Text style={styles.submitButtonText}>
              {loading ? t('changePassword.submitting') : t('changePassword.submit')}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  content: {
    flex: 1,
  },
  form: {
    padding: 16,
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f4ff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 24,
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    color: '#667eea',
    marginLeft: 8,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 15,
    color: '#333',
    marginBottom: 8,
    fontWeight: '500',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  inputError: {
    borderColor: '#ff4d4f',
  },
  input: {
    flex: 1,
    padding: 14,
    fontSize: 16,
    color: '#333',
  },
  eyeButton: {
    padding: 12,
  },
  errorText: {
    fontSize: 13,
    color: '#ff4d4f',
    marginTop: 4,
  },
  submitButton: {
    backgroundColor: '#667eea',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24,
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default ChangePasswordScreen;
