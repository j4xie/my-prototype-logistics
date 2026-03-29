/**
 * StatCardGrid - Statistics cards grid with edit-mode support
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Icon } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { ShakingCard } from './ShakingCard';
import type { HomeModule, StatCardConfig } from '../../../../types/decoration';
import type { StatCardData } from '../types';

interface StatCardGridProps {
  module: HomeModule;
  index: number;
  isEditMode: boolean;
  allStatCards: StatCardData[];
  onLongPress: () => void;
  onToggleModuleVisibility: (moduleId: string) => void;
  onToggleStatCardVisibility: (moduleId: string, cardId: string) => void;
  onAddStatCard: (moduleId: string) => void;
}

export function StatCardGrid({
  module,
  index,
  isEditMode,
  allStatCards,
  onLongPress,
  onToggleModuleVisibility,
  onToggleStatCardVisibility,
  onAddStatCard,
}: StatCardGridProps) {
  const { t } = useTranslation('home');

  const cardsConfig = module.config?.cards || [];
  const hiddenCardIds = cardsConfig
    .filter((c: StatCardConfig) => c.visible === false)
    .map((c: StatCardConfig) => c.id);
  const displayCards = allStatCards.filter(card => !hiddenCardIds.includes(card.id));
  const hiddenCards = allStatCards.filter(card => hiddenCardIds.includes(card.id));

  return (
    <ShakingCard isShaking={isEditMode} delay={index * 50} style={styles.statsSection}>
      {isEditMode && (
        <TouchableOpacity
          style={styles.sectionEditBadge}
          onPress={() => onToggleModuleVisibility(module.id)}
        >
          <Icon source="minus-circle" size={20} color="#e53e3e" />
        </TouchableOpacity>
      )}

      <View style={styles.sectionHeader}>
        <Text testID="fa-home-stats-title" style={styles.sectionTitle}>
          {t('sections.todayOverview', module.name)}
        </Text>
        {isEditMode && hiddenCards.length > 0 && (
          <TouchableOpacity style={styles.addItemBtn} onPress={() => onAddStatCard(module.id)}>
            <Icon source="plus" size={16} color="#667eea" />
            <Text style={styles.addItemBtnText}>{t('layout.add', 'Add')}</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.statsGrid}>
        {displayCards.map(card => (
          <TouchableOpacity
            testID={`fa-home-stat-${card.id}`}
            key={card.id}
            style={styles.statCard}
            onPress={isEditMode ? undefined : card.onPress}
            onLongPress={onLongPress}
            delayLongPress={500}
            activeOpacity={isEditMode ? 1 : 0.7}
          >
            {isEditMode && (
              <TouchableOpacity
                style={styles.cardDeleteBadge}
                onPress={() => onToggleStatCardVisibility(module.id, card.id)}
              >
                <Icon source="minus-circle" size={16} color="#e53e3e" />
              </TouchableOpacity>
            )}
            <View style={[styles.statIconWrapper, { backgroundColor: `${card.color}15` }]}>
              <Icon source={card.icon} size={24} color={card.color} />
            </View>
            <Text
              testID={`fa-home-stat-${card.id}-value`}
              style={[styles.statValue, { color: card.color }]}
            >
              {card.value}
            </Text>
            <Text style={styles.statLabel}>{card.label}</Text>
            {card.trend && !isEditMode && (
              <View style={styles.trendBadge}>
                <Icon source="trending-up" size={12} color="#48bb78" />
                <Text style={styles.trendText}>{card.trend}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </ShakingCard>
  );
}

const styles = StyleSheet.create({
  statsSection: {
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a202c',
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    alignItems: 'flex-start',
  },
  statIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 13,
    color: '#718096',
    marginTop: 4,
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#c6f6d5',
    borderRadius: 8,
  },
  trendText: {
    fontSize: 11,
    color: '#276749',
    marginLeft: 4,
    fontWeight: '500',
  },
  sectionEditBadge: {
    position: 'absolute',
    top: -8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  addItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#667eea15',
    borderRadius: 16,
    gap: 4,
  },
  addItemBtnText: {
    fontSize: 13,
    color: '#667eea',
    fontWeight: '500',
  },
  cardDeleteBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#fff',
    borderRadius: 10,
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
});
