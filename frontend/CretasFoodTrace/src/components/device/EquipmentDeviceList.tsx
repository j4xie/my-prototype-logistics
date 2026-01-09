import React, { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  Text,
  ActivityIndicator,
  Searchbar,
  FAB,
  Portal,
  Dialog,
  TextInput,
  IconButton,
  Menu,
  Chip,
} from 'react-native-paper';
import {
  equipmentApiClient,
  type Equipment,
  type EquipmentStatus,
  type EquipmentType,
  type CreateEquipmentRequest,
} from '../../services/api/equipmentApiClient';
import { userApiClient, type UserDTO } from '../../services/api/userApiClient';
import { useAuthStore } from '../../store/authStore';
import { getFactoryId } from '../../types/auth';
import { NeoCard, NeoButton, StatusBadge } from '../../components/ui';
import { theme } from '../../theme';
import { logger } from '../../utils/logger';

// Create EquipmentDeviceList context logger
const equipmentListLogger = logger.createContextLogger('EquipmentDeviceList');

export interface EquipmentDeviceListProps {
  onDevicePress?: (equipmentId: number) => void;
}

export function EquipmentDeviceList({ onDevicePress }: EquipmentDeviceListProps) {
  const { t } = useTranslation('processing');
  const { user } = useAuthStore();

  // State
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<EquipmentStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<EquipmentType | 'all'>('all');

  // CRUD State
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);

  // Operator selection State
  const [operatorUsers, setOperatorUsers] = useState<UserDTO[]>([]);
  const [showOperatorMenu, setShowOperatorMenu] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Form State
  const [formData, setFormData] = useState<CreateEquipmentRequest>({
    name: '',
    code: '',
    type: 'processing',
    model: '',
    manufacturer: '',
    purchaseDate: '',
    location: '',
    specifications: '',
    purchasePrice: undefined,
    depreciationYears: undefined,
    maintenanceInterval: undefined,
    operatorId: undefined,
    notes: '',
  });

  const getCurrentFactoryId = (): string => getFactoryId(user) || '';

  // Load selectable operator users list
  const loadOperatorUsers = async () => {
    setLoadingUsers(true);
    try {
      const factoryId = getCurrentFactoryId();
      // Load all users, can be filtered by role later
      const response = await userApiClient.getUsers({ factoryId, size: 100 });
      // Handle paginated response
      const users = Array.isArray(response) ? response : ((response as { content?: UserDTO[] })?.content || []);
      setOperatorUsers(users);
    } catch (error) {
      equipmentListLogger.error('Failed to load operator users list', error as Error);
      setOperatorUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadEquipments = useCallback(async () => {
    setLoading(true);
    try {
      const factoryId = getCurrentFactoryId();
      if (!factoryId) {
        Alert.alert(t('equipmentManagement.messages.loadFailed'), t('equipmentManagement.messages.factoryIdError'));
        return;
      }

      const params: {
        factoryId: string;
        page: number;
        size: number;
        sortBy: string;
        sortDirection: 'ASC' | 'DESC';
        status?: EquipmentStatus;
        type?: EquipmentType;
        keyword?: string;
      } = {
        factoryId,
        page: 1,
        size: 50,
        sortBy: 'createdAt',
        sortDirection: 'DESC',
      };

      if (statusFilter !== 'all') params.status = statusFilter;
      if (typeFilter !== 'all') params.type = typeFilter;
      if (searchQuery.trim()) params.keyword = searchQuery.trim();

      const response = await equipmentApiClient.getEquipments(params);
      const data = (response as { data?: Equipment[] | { content?: Equipment[]; items?: Equipment[] } }).data;
      let equipmentList: Equipment[] = [];

      if (Array.isArray(data)) {
        equipmentList = data;
      } else if (data && typeof data === 'object') {
        equipmentList = (data as { content?: Equipment[]; items?: Equipment[] }).content || (data as { content?: Equipment[]; items?: Equipment[] }).items || [];
      }

      setEquipments(equipmentList);
    } catch (error) {
      equipmentListLogger.error('Failed to load equipments', error as Error);
      setEquipments([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter, searchQuery, user]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadEquipments();
    setRefreshing(false);
  };

  // Load equipments on mount and when filters change
  useEffect(() => {
    loadEquipments();
  }, [loadEquipments]);

  // CRUD Handlers
  const handleCreateEquipment = async () => {
    try {
      setLoading(true);
      await equipmentApiClient.createEquipment(formData, getCurrentFactoryId());
      equipmentListLogger.info('Equipment created successfully', {
        equipmentName: formData.name,
        equipmentCode: formData.code,
        factoryId: getCurrentFactoryId(),
      });
      setShowCreateDialog(false);
      loadEquipments();
    } catch (e) {
      equipmentListLogger.error('Failed to create equipment', e as Error, {
        equipmentName: formData.name,
        factoryId: getCurrentFactoryId(),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateEquipment = async () => {
    if (!selectedEquipment) return;
    try {
      setLoading(true);
      await equipmentApiClient.updateEquipment(selectedEquipment.id, formData, getCurrentFactoryId());
      equipmentListLogger.info('Equipment updated successfully', {
        equipmentId: selectedEquipment.id,
        equipmentName: formData.name,
        factoryId: getCurrentFactoryId(),
      });
      setShowEditDialog(false);
      loadEquipments();
    } catch (e) {
      equipmentListLogger.error('Failed to update equipment', e as Error, {
        equipmentId: selectedEquipment.id,
        factoryId: getCurrentFactoryId(),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEquipment = async () => {
    if (!selectedEquipment) return;
    try {
      setLoading(true);
      await equipmentApiClient.deleteEquipment(selectedEquipment.id, getCurrentFactoryId());
      equipmentListLogger.info('Equipment deleted successfully', {
        equipmentId: selectedEquipment.id,
        equipmentName: selectedEquipment.name,
        factoryId: getCurrentFactoryId(),
      });
      setShowDeleteDialog(false);
      loadEquipments();
    } catch (e) {
      equipmentListLogger.error('Failed to delete equipment', e as Error, {
        equipmentId: selectedEquipment.id,
        factoryId: getCurrentFactoryId(),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (newStatus: EquipmentStatus) => {
    if (!selectedEquipment) return;
    try {
      setLoading(true);
      await equipmentApiClient.updateEquipmentStatus(selectedEquipment.id, newStatus, getCurrentFactoryId());
      equipmentListLogger.info('Equipment status updated successfully', {
        equipmentId: selectedEquipment.id,
        newStatus,
        factoryId: getCurrentFactoryId(),
      });
      setShowStatusMenu(false);
      loadEquipments();
    } catch (e) {
      equipmentListLogger.error('Failed to update equipment status', e as Error, {
        equipmentId: selectedEquipment.id,
        newStatus,
        factoryId: getCurrentFactoryId(),
      });
    } finally {
      setLoading(false);
    }
  };

  // Dialog Openers
  const openCreateDialog = () => {
    setFormData({
      name: '',
      code: '',
      type: 'processing',
      model: '',
      manufacturer: '',
      purchaseDate: '',
      location: '',
      specifications: '',
      operatorId: undefined,
      notes: '',
    });
    loadOperatorUsers();
    setShowCreateDialog(true);
  };

  const openEditDialog = (equipment: Equipment) => {
    setSelectedEquipment(equipment);
    setFormData({
      ...equipment,
      purchasePrice: equipment.purchasePrice,
      depreciationYears: equipment.depreciationYears,
      maintenanceInterval: equipment.maintenanceInterval,
      operatorId: equipment.operatorId,
    });
    loadOperatorUsers();
    setShowEditDialog(true);
  };

  // Get selected operator name
  const getSelectedOperatorName = (): string => {
    if (!formData.operatorId) return t('equipmentManagement.dialogs.fields.selectOperator');
    const operator = operatorUsers.find(u => u.id === formData.operatorId);
    return operator ? operator.realName : t('equipmentManagement.dialogs.fields.selectOperator');
  };

  const openDeleteDialog = (equipment: Equipment) => {
    setSelectedEquipment(equipment);
    setShowDeleteDialog(true);
  };

  const openStatusMenu = (equipment: Equipment) => {
    setSelectedEquipment(equipment);
    setShowStatusMenu(true);
  };

  const getStatusVariant = (status: EquipmentStatus) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'maintenance':
        return 'warning';
      case 'inactive':
        return 'default';
      case 'scrapped':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status: EquipmentStatus) => {
    return t(`equipmentManagement.status.${status}`);
  };

  const getTypeLabel = (type: EquipmentType) => {
    return t(`equipmentManagement.type.${type}`);
  };

  const handleDevicePress = (equipment: Equipment) => {
    if (onDevicePress) {
      onDevicePress(equipment.id);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <Searchbar
          placeholder={t('equipmentManagement.searchPlaceholder')}
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchbar}
          inputStyle={{ minHeight: 0 }}
          elevation={0}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterContainer}>
        {(['all', 'active', 'maintenance', 'inactive'] as const).map((status) => (
          <Chip
            key={status}
            mode={statusFilter === status ? 'flat' : 'outlined'}
            selected={statusFilter === status}
            onPress={() => setStatusFilter(status as EquipmentStatus | 'all')}
            style={styles.filterChip}
            textStyle={{ fontSize: 12 }}
            showSelectedOverlay
          >
            {status === 'all' ? t('equipmentManagement.filters.all') : getStatusLabel(status as EquipmentStatus)}
          </Chip>
        ))}
      </ScrollView>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {loading && equipments.length === 0 ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : equipments.length === 0 ? (
          <View style={styles.centerContainer}>
            <Text style={styles.emptyText}>{t('equipmentManagement.empty.title')}</Text>
            <NeoButton variant="primary" onPress={openCreateDialog} style={{ marginTop: 16 }}>
              {t('equipmentManagement.actions.create')}
            </NeoButton>
          </View>
        ) : (
          equipments.map((equipment) => (
            <NeoCard key={equipment.id} style={styles.card} padding="m">
              <View style={styles.cardHeader}>
                <View>
                  <Text variant="titleMedium" style={styles.cardTitle}>
                    {equipment.name}
                  </Text>
                  <Text variant="bodySmall" style={styles.cardSubtitle}>
                    {equipment.code}
                  </Text>
                </View>
                <StatusBadge status={getStatusLabel(equipment.status)} variant={getStatusVariant(equipment.status)} />
              </View>

              <View style={styles.cardBody}>
                <View style={styles.infoGrid}>
                  <View style={styles.infoItem}>
                    <Text style={styles.label}>{t('equipmentManagement.info.type')}</Text>
                    <Text style={styles.value}>{getTypeLabel(equipment.type)}</Text>
                  </View>
                  <View style={styles.infoItem}>
                    <Text style={styles.label}>{t('equipmentManagement.info.location')}</Text>
                    <Text style={styles.value}>{equipment.location || '-'}</Text>
                  </View>
                  <View style={styles.infoItem}>
                    <Text style={styles.label}>{t('equipmentManagement.info.model')}</Text>
                    <Text style={styles.value}>{equipment.model || '-'}</Text>
                  </View>
                  <View style={styles.infoItem}>
                    <Text style={styles.label}>{t('equipmentManagement.info.operator')}</Text>
                    <Text style={styles.value}>{equipment.operatorName || '-'}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.cardActions}>
                <View style={styles.leftActions}>
                  <IconButton icon="pencil-outline" size={20} onPress={() => openEditDialog(equipment)} />
                  <IconButton
                    icon="trash-can-outline"
                    size={20}
                    iconColor={theme.colors.error}
                    onPress={() => openDeleteDialog(equipment)}
                  />
                </View>
                <View style={styles.rightActions}>
                  <Menu
                    visible={showStatusMenu && selectedEquipment?.id === equipment.id}
                    onDismiss={() => {
                      setShowStatusMenu(false);
                      setSelectedEquipment(null);
                    }}
                    anchor={
                      <NeoButton variant="ghost" size="small" onPress={() => openStatusMenu(equipment)}>
                        {t('equipmentManagement.actions.status')}
                      </NeoButton>
                    }
                  >
                    <Menu.Item onPress={() => handleUpdateStatus('active')} title={t('equipmentManagement.statusMenu.running')} />
                    <Menu.Item onPress={() => handleUpdateStatus('maintenance')} title={t('equipmentManagement.statusMenu.maintenance')} />
                    <Menu.Item onPress={() => handleUpdateStatus('inactive')} title={t('equipmentManagement.statusMenu.inactive')} />
                  </Menu>
                  <NeoButton variant="outline" size="small" onPress={() => handleDevicePress(equipment)}>
                    {t('equipmentManagement.actions.detail')}
                  </NeoButton>
                </View>
              </View>
            </NeoCard>
          ))
        )}
      </ScrollView>

      <FAB icon="plus" style={styles.fab} onPress={openCreateDialog} color="white" />

      {/* Dialogs (Create/Edit/Delete) using Portal */}
      <Portal>
        {/* Create equipment dialog */}
        <Dialog visible={showCreateDialog} onDismiss={() => setShowCreateDialog(false)} style={{ backgroundColor: 'white' }}>
          <Dialog.Title>{t('equipmentManagement.dialogs.createTitle')}</Dialog.Title>
          <Dialog.ScrollArea style={{ maxHeight: 400, paddingHorizontal: 0 }}>
            <ScrollView>
              <View style={{ paddingHorizontal: 24 }}>
                <TextInput
                  label={t('equipmentManagement.dialogs.fields.name')}
                  value={formData.name}
                  onChangeText={text => setFormData({ ...formData, name: text })}
                  mode="outlined"
                  style={styles.input}
                />
                <TextInput
                  label={t('equipmentManagement.dialogs.fields.code')}
                  value={formData.code}
                  onChangeText={text => setFormData({ ...formData, code: text })}
                  mode="outlined"
                  style={styles.input}
                />
                <TextInput
                  label={t('equipmentManagement.dialogs.fields.model')}
                  value={formData.model || ''}
                  onChangeText={text => setFormData({ ...formData, model: text })}
                  mode="outlined"
                  style={styles.input}
                />
                <TextInput
                  label={t('equipmentManagement.dialogs.fields.location')}
                  value={formData.location || ''}
                  onChangeText={text => setFormData({ ...formData, location: text })}
                  mode="outlined"
                  style={styles.input}
                />

                {/* Operator selection */}
                <Text style={styles.fieldLabel}>{t('equipmentManagement.dialogs.fields.operator')}</Text>
                <Menu
                  visible={showOperatorMenu}
                  onDismiss={() => setShowOperatorMenu(false)}
                  anchor={
                    <NeoButton
                      variant="outline"
                      onPress={() => setShowOperatorMenu(true)}
                      style={styles.operatorButton}
                    >
                      {loadingUsers ? t('equipmentManagement.dialogs.fields.loadingOperators') : getSelectedOperatorName()}
                    </NeoButton>
                  }
                  contentStyle={{ backgroundColor: 'white', maxHeight: 300 }}
                >
                  <Menu.Item
                    onPress={() => {
                      setFormData({ ...formData, operatorId: undefined });
                      setShowOperatorMenu(false);
                    }}
                    title={t('equipmentManagement.dialogs.fields.noOperator')}
                  />
                  {operatorUsers.map(operatorUser => (
                    <Menu.Item
                      key={operatorUser.id}
                      onPress={() => {
                        setFormData({ ...formData, operatorId: operatorUser.id });
                        setShowOperatorMenu(false);
                      }}
                      title={`${operatorUser.realName} (${operatorUser.position || operatorUser.role})`}
                    />
                  ))}
                </Menu>

                <TextInput
                  label={t('equipmentManagement.dialogs.fields.notes')}
                  value={formData.notes || ''}
                  onChangeText={text => setFormData({ ...formData, notes: text })}
                  mode="outlined"
                  style={styles.input}
                  multiline
                  numberOfLines={2}
                />
              </View>
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <NeoButton variant="ghost" onPress={() => setShowCreateDialog(false)}>
              {t('equipmentManagement.dialogs.buttons.cancel')}
            </NeoButton>
            <NeoButton variant="primary" onPress={handleCreateEquipment}>
              {t('equipmentManagement.dialogs.buttons.create')}
            </NeoButton>
          </Dialog.Actions>
        </Dialog>

        {/* Edit equipment dialog */}
        <Dialog visible={showEditDialog} onDismiss={() => setShowEditDialog(false)} style={{ backgroundColor: 'white' }}>
          <Dialog.Title>{t('equipmentManagement.dialogs.editTitle')}</Dialog.Title>
          <Dialog.ScrollArea style={{ maxHeight: 400, paddingHorizontal: 0 }}>
            <ScrollView>
              <View style={{ paddingHorizontal: 24 }}>
                <TextInput
                  label={t('equipmentManagement.dialogs.fields.name')}
                  value={formData.name}
                  onChangeText={text => setFormData({ ...formData, name: text })}
                  mode="outlined"
                  style={styles.input}
                />
                <TextInput
                  label={t('equipmentManagement.dialogs.fields.code')}
                  value={formData.code}
                  onChangeText={text => setFormData({ ...formData, code: text })}
                  mode="outlined"
                  style={styles.input}
                />
                <TextInput
                  label={t('equipmentManagement.dialogs.fields.model')}
                  value={formData.model || ''}
                  onChangeText={text => setFormData({ ...formData, model: text })}
                  mode="outlined"
                  style={styles.input}
                />
                <TextInput
                  label={t('equipmentManagement.dialogs.fields.location')}
                  value={formData.location || ''}
                  onChangeText={text => setFormData({ ...formData, location: text })}
                  mode="outlined"
                  style={styles.input}
                />

                {/* Operator selection */}
                <Text style={styles.fieldLabel}>{t('equipmentManagement.dialogs.fields.operator')}</Text>
                <Menu
                  visible={showOperatorMenu}
                  onDismiss={() => setShowOperatorMenu(false)}
                  anchor={
                    <NeoButton
                      variant="outline"
                      onPress={() => setShowOperatorMenu(true)}
                      style={styles.operatorButton}
                    >
                      {loadingUsers ? t('equipmentManagement.dialogs.fields.loadingOperators') : getSelectedOperatorName()}
                    </NeoButton>
                  }
                  contentStyle={{ backgroundColor: 'white', maxHeight: 300 }}
                >
                  <Menu.Item
                    onPress={() => {
                      setFormData({ ...formData, operatorId: undefined });
                      setShowOperatorMenu(false);
                    }}
                    title={t('equipmentManagement.dialogs.fields.noOperator')}
                  />
                  {operatorUsers.map(operatorUser => (
                    <Menu.Item
                      key={operatorUser.id}
                      onPress={() => {
                        setFormData({ ...formData, operatorId: operatorUser.id });
                        setShowOperatorMenu(false);
                      }}
                      title={`${operatorUser.realName} (${operatorUser.position || operatorUser.role})`}
                    />
                  ))}
                </Menu>

                <TextInput
                  label={t('equipmentManagement.dialogs.fields.notes')}
                  value={formData.notes || ''}
                  onChangeText={text => setFormData({ ...formData, notes: text })}
                  mode="outlined"
                  style={styles.input}
                  multiline
                  numberOfLines={2}
                />
              </View>
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <NeoButton variant="ghost" onPress={() => setShowEditDialog(false)}>
              {t('equipmentManagement.dialogs.buttons.cancel')}
            </NeoButton>
            <NeoButton variant="primary" onPress={handleUpdateEquipment}>
              {t('equipmentManagement.dialogs.buttons.save')}
            </NeoButton>
          </Dialog.Actions>
        </Dialog>

        {/* Delete confirmation dialog */}
        <Dialog visible={showDeleteDialog} onDismiss={() => setShowDeleteDialog(false)} style={{ backgroundColor: 'white' }}>
          <Dialog.Title>{t('equipmentManagement.dialogs.deleteTitle')}</Dialog.Title>
          <Dialog.Content>
            <Text>{t('equipmentManagement.dialogs.deleteMessage')}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <NeoButton variant="ghost" onPress={() => setShowDeleteDialog(false)}>
              {t('equipmentManagement.dialogs.buttons.cancel')}
            </NeoButton>
            <NeoButton variant="danger" onPress={handleDeleteEquipment}>
              {t('equipmentManagement.dialogs.buttons.delete')}
            </NeoButton>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  searchContainer: {
    padding: 16,
    backgroundColor: theme.colors.surface,
    paddingBottom: 8,
  },
  searchbar: {
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: theme.custom.borderRadius.m,
    height: 44,
  },
  filterContainer: {
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 16,
    paddingBottom: 12,
    maxHeight: 50,
  },
  filterChip: {
    marginRight: 8,
    height: 32,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 80,
  },
  centerContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: theme.colors.textSecondary,
    marginBottom: 16,
  },
  card: {
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cardTitle: {
    fontWeight: '600',
    color: theme.colors.text,
  },
  cardSubtitle: {
    color: theme.colors.textTertiary,
  },
  cardBody: {
    marginBottom: 12,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  infoItem: {
    width: '33%',
    marginBottom: 8,
  },
  label: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  value: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.colors.text,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: theme.colors.outlineVariant,
    paddingTop: 8,
  },
  leftActions: {
    flexDirection: 'row',
  },
  rightActions: {
    flexDirection: 'row',
    gap: 8,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    backgroundColor: theme.colors.primary,
    borderRadius: 16,
  },
  input: {
    marginBottom: 12,
    backgroundColor: 'white',
  },
  fieldLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: 4,
    marginTop: 4,
  },
  operatorButton: {
    marginBottom: 12,
    width: '100%',
  },
});
