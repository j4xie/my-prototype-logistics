/**
 * WelcomeHeader - Greeting, date, edit/notification buttons
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Icon } from 'react-native-paper';
import { useTranslation } from 'react-i18next';

interface WelcomeHeaderProps {
  username: string | undefined;
  activeAlerts: number;
  onEditLayout: () => void;
}

export function WelcomeHeader({ username, activeAlerts, onEditLayout }: WelcomeHeaderProps) {
  const { t } = useTranslation('home');

  const getFormattedDate = () => {
    const now = new Date();
    const weekDays = [
      t('date.weekdays.sun'), t('date.weekdays.mon'), t('date.weekdays.tue'),
      t('date.weekdays.wed'), t('date.weekdays.thu'), t('date.weekdays.fri'),
      t('date.weekdays.sat'),
    ];
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const weekDay = weekDays[now.getDay()];
    return `${month}${t('date.month')}${day}${t('date.day')} ${weekDay}`;
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 6) return t('greetings.earlyMorning');
    if (hour < 9) return t('greetings.morning');
    if (hour < 12) return t('greetings.lateMorning');
    if (hour < 14) return t('greetings.noon');
    if (hour < 18) return t('greetings.afternoon');
    if (hour < 22) return t('greetings.evening');
    return t('greetings.lateNight');
  };

  return (
    <View style={styles.welcomeSection}>
      <View style={styles.welcomeLeft}>
        <Text style={styles.greeting}>
          {getGreeting()}{username ?? t('greetings.defaultUser')}
        </Text>
        <Text style={styles.dateText}>{getFormattedDate()}</Text>
      </View>
      <View style={styles.welcomeRight}>
        <TouchableOpacity style={styles.editLayoutBtn} onPress={onEditLayout}>
          <Icon source="view-dashboard-edit-outline" size={22} color="#667eea" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.notificationBtn}>
          <Icon source="bell-outline" size={24} color="#666" />
          {activeAlerts > 0 && (
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationBadgeText}>{activeAlerts}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  welcomeSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
  },
  welcomeLeft: {
    flex: 1,
  },
  welcomeRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editLayoutBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f0f4ff',
  },
  greeting: {
    fontSize: 22,
    fontWeight: '600',
    color: '#1a202c',
  },
  dateText: {
    fontSize: 14,
    color: '#718096',
    marginTop: 4,
  },
  notificationBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f7fafc',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#e53e3e',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  notificationBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
  },
});
