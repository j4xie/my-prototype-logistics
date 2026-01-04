import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import {
  Text,
  Card,
  IconButton,
  Button,
  TextInput,
  ProgressBar,
  Avatar,
  Chip,
  Portal,
  Modal,
  RadioButton,
  ActivityIndicator,
  Divider,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { PlatformStackParamList } from '../../../navigation/PlatformStackNavigator';

const { width } = Dimensions.get('window');

type Props = NativeStackScreenProps<PlatformStackParamList, 'AIBusinessInit'>;

interface Factory {
  id: string;
  name: string;
  industry: string;
  status: 'active' | 'inactive' | 'pending';
  hasAIConfig: boolean;
}

interface IndustryTemplate {
  id: string;
  name: string;
  industry: string;
  description: string;
  icon: string;
  features: string[];
  popularity: number;
}

interface InitStep {
  id: number;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  progress: number;
}

/**
 * AIBusinessInitScreen - AI Business Initialization Page
 * Provides factory selection, AI quick configuration wizard, and industry templates
 */
export default function AIBusinessInitScreen() {
  const { t } = useTranslation('platform');
  const navigation = useNavigation();
  const [refreshing, setRefreshing] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedFactory, setSelectedFactory] = useState<Factory | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<IndustryTemplate | null>(null);
  const [factoryDescription, setFactoryDescription] = useState('');
  const [factoryModalVisible, setFactoryModalVisible] = useState(false);
  const [templateModalVisible, setTemplateModalVisible] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [initComplete, setInitComplete] = useState(false);

  // Mock factories
  const [factories] = useState<Factory[]>([
    { id: 'F001', name: 'Seafood Processing #1', industry: 'seafood', status: 'active', hasAIConfig: true },
    { id: 'F002', name: 'Frozen Food Factory', industry: 'frozen', status: 'active', hasAIConfig: true },
    { id: 'F003', name: 'Meat Processing Center', industry: 'meat', status: 'active', hasAIConfig: false },
    { id: 'F004', name: 'Dairy Products Plant', industry: 'dairy', status: 'pending', hasAIConfig: false },
    { id: 'F005', name: 'Vegetable Processing', industry: 'vegetable', status: 'inactive', hasAIConfig: false },
  ]);

  // Industry templates
  const [templates] = useState<IndustryTemplate[]>([
    {
      id: 'TPL001',
      name: 'Seafood Processing Standard',
      industry: 'seafood',
      description: 'Complete template for seafood processing including cold chain tracking, freshness monitoring, and batch tracing.',
      icon: 'fish',
      features: ['Cold Chain Tracking', 'Freshness Monitoring', 'Origin Tracing', 'Quality Grading'],
      popularity: 95,
    },
    {
      id: 'TPL002',
      name: 'Frozen Food Production',
      industry: 'frozen',
      description: 'Template optimized for frozen food production with temperature control and shelf life management.',
      icon: 'snowflake',
      features: ['Temperature Control', 'Shelf Life Management', 'Batch Tracking', 'Packaging Records'],
      popularity: 88,
    },
    {
      id: 'TPL003',
      name: 'Meat Processing Complete',
      industry: 'meat',
      description: 'Full-featured template for meat processing covering slaughter, cutting, packaging and distribution.',
      icon: 'cow',
      features: ['Slaughter Records', 'Cut Tracking', 'Inspection Records', 'Distribution Chain'],
      popularity: 82,
    },
    {
      id: 'TPL004',
      name: 'Dairy Production Line',
      industry: 'dairy',
      description: 'Dairy industry template with pasteurization tracking, quality testing, and expiration management.',
      icon: 'bottle-soda',
      features: ['Pasteurization Records', 'Quality Testing', 'Expiration Tracking', 'Storage Conditions'],
      popularity: 76,
    },
  ]);

  // Initialization steps
  const [initSteps, setInitSteps] = useState<InitStep[]>([
    { id: 1, title: 'Analyzing Factory Description', description: 'AI is analyzing your input...', status: 'pending', progress: 0 },
    { id: 2, title: 'Identifying Industry Type', description: 'Matching industry templates...', status: 'pending', progress: 0 },
    { id: 3, title: 'Generating Form Schemas', description: 'Creating custom form fields...', status: 'pending', progress: 0 },
    { id: 4, title: 'Configuring Business Data', description: 'Setting up product types, materials...', status: 'pending', progress: 0 },
    { id: 5, title: 'Finalizing Configuration', description: 'Applying settings to factory...', status: 'pending', progress: 0 },
  ]);

  // Generated preview data
  const [previewData, setPreviewData] = useState<{
    industry: string;
    productTypes: string[];
    materialTypes: string[];
    formFields: string[];
  } | null>(null);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setRefreshing(false);
  }, []);

  const handleFactorySelect = (factory: Factory) => {
    setSelectedFactory(factory);
    setFactoryModalVisible(false);
  };

  const handleTemplateSelect = (template: IndustryTemplate) => {
    setSelectedTemplate(template);
    setTemplateModalVisible(false);
    setFactoryDescription(template.description);
  };

  const simulateInitialization = async () => {
    setIsInitializing(true);
    const steps = [...initSteps];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      if (!step) continue;

      step.status = 'in_progress';
      setInitSteps([...steps]);

      // Simulate progress
      for (let p = 0; p <= 100; p += 20) {
        step.progress = p;
        setInitSteps([...steps]);
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      step.status = 'completed';
      step.progress = 100;
      setInitSteps([...steps]);
    }

    // Set preview data
    setPreviewData({
      industry: selectedTemplate?.industry || 'general',
      productTypes: ['Frozen Shrimp', 'Fish Fillet', 'Seafood Mix'],
      materialTypes: ['Fresh Shrimp', 'Fresh Fish', 'Spices', 'Packaging'],
      formFields: ['Batch Number', 'Production Date', 'Temperature', 'Weight', 'Quality Grade'],
    });

    setIsInitializing(false);
    setInitComplete(true);
  };

  const handleStartInit = () => {
    if (!selectedFactory || !factoryDescription.trim()) {
      return;
    }
    setCurrentStep(3);
    simulateInitialization();
  };

  const handleApplyConfig = () => {
    // In production, this would call the API to apply the configuration
    console.log('Applying configuration to factory:', selectedFactory?.id);
    navigation.goBack();
  };

  const getStepStatus = (step: number) => {
    if (currentStep > step) return 'completed';
    if (currentStep === step) return 'current';
    return 'pending';
  };

  const getStatusColor = (status: 'active' | 'inactive' | 'pending') => {
    switch (status) {
      case 'active':
        return '#52c41a';
      case 'inactive':
        return '#8c8c8c';
      case 'pending':
        return '#fa8c16';
    }
  };

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {[1, 2, 3].map((step) => (
        <React.Fragment key={step}>
          <View
            style={[
              styles.stepCircle,
              getStepStatus(step) === 'completed' && styles.stepCircleCompleted,
              getStepStatus(step) === 'current' && styles.stepCircleCurrent,
            ]}
          >
            {getStepStatus(step) === 'completed' ? (
              <Avatar.Icon icon="check" size={24} color="#fff" style={{ backgroundColor: 'transparent' }} />
            ) : (
              <Text
                style={[
                  styles.stepNumber,
                  getStepStatus(step) === 'current' && styles.stepNumberCurrent,
                ]}
              >
                {step}
              </Text>
            )}
          </View>
          {step < 3 && (
            <View
              style={[
                styles.stepLine,
                getStepStatus(step) === 'completed' && styles.stepLineCompleted,
              ]}
            />
          )}
        </React.Fragment>
      ))}
    </View>
  );

  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Select Factory</Text>
      <Text style={styles.stepDescription}>
        Choose a factory to initialize AI business configuration
      </Text>

      <TouchableOpacity
        style={styles.selectorButton}
        onPress={() => setFactoryModalVisible(true)}
      >
        {selectedFactory ? (
          <View style={styles.selectedItem}>
            <Avatar.Icon icon="factory" size={40} color="#667eea" style={styles.selectedIcon} />
            <View style={styles.selectedInfo}>
              <Text style={styles.selectedName}>{selectedFactory.name}</Text>
              <Text style={styles.selectedMeta}>
                {selectedFactory.industry} | {selectedFactory.hasAIConfig ? 'AI Configured' : 'Not Configured'}
              </Text>
            </View>
            <Avatar.Icon icon="chevron-right" size={24} color="#8c8c8c" style={{ backgroundColor: 'transparent' }} />
          </View>
        ) : (
          <View style={styles.placeholderItem}>
            <Avatar.Icon icon="plus" size={32} color="#8c8c8c" style={{ backgroundColor: '#f5f5f5' }} />
            <Text style={styles.placeholderText}>Tap to select a factory</Text>
          </View>
        )}
      </TouchableOpacity>

      <Button
        mode="contained"
        onPress={() => setCurrentStep(2)}
        disabled={!selectedFactory}
        style={styles.nextButton}
        contentStyle={styles.nextButtonContent}
      >
        Next Step
      </Button>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>AI Quick Configuration</Text>
      <Text style={styles.stepDescription}>
        Describe your factory or select an industry template
      </Text>

      {/* Industry Template Selection */}
      <TouchableOpacity
        style={styles.selectorButton}
        onPress={() => setTemplateModalVisible(true)}
      >
        {selectedTemplate ? (
          <View style={styles.selectedItem}>
            <Avatar.Icon icon={selectedTemplate.icon} size={40} color="#667eea" style={styles.selectedIcon} />
            <View style={styles.selectedInfo}>
              <Text style={styles.selectedName}>{selectedTemplate.name}</Text>
              <Text style={styles.selectedMeta}>{selectedTemplate.industry} industry</Text>
            </View>
            <Avatar.Icon icon="chevron-right" size={24} color="#8c8c8c" style={{ backgroundColor: 'transparent' }} />
          </View>
        ) : (
          <View style={styles.placeholderItem}>
            <Avatar.Icon icon="file-document" size={32} color="#8c8c8c" style={{ backgroundColor: '#f5f5f5' }} />
            <Text style={styles.placeholderText}>Select industry template (optional)</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Factory Description Input */}
      <Text style={styles.inputLabel}>Factory Description</Text>
      <TextInput
        mode="outlined"
        placeholder="Describe your factory's main business, products, and processes..."
        value={factoryDescription}
        onChangeText={setFactoryDescription}
        multiline
        numberOfLines={4}
        style={styles.descriptionInput}
        outlineColor="#d9d9d9"
        activeOutlineColor="#667eea"
      />

      <View style={styles.buttonRow}>
        <Button
          mode="outlined"
          onPress={() => setCurrentStep(1)}
          style={styles.backButton}
        >
          Back
        </Button>
        <Button
          mode="contained"
          onPress={handleStartInit}
          disabled={!factoryDescription.trim()}
          style={styles.startButton}
          contentStyle={styles.nextButtonContent}
        >
          Start Initialization
        </Button>
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>
        {initComplete ? 'Configuration Preview' : 'Initializing...'}
      </Text>
      <Text style={styles.stepDescription}>
        {initComplete
          ? 'Review the generated configuration before applying'
          : 'AI is generating configuration based on your input'}
      </Text>

      {/* Progress Steps */}
      <Card style={styles.progressCard}>
        <Card.Content>
          {initSteps.map((step) => (
            <View key={step.id} style={styles.initStep}>
              <View style={styles.initStepHeader}>
                {step.status === 'completed' ? (
                  <Avatar.Icon icon="check-circle" size={24} color="#52c41a" style={{ backgroundColor: 'transparent' }} />
                ) : step.status === 'in_progress' ? (
                  <ActivityIndicator size={20} color="#667eea" />
                ) : (
                  <Avatar.Icon icon="circle-outline" size={24} color="#d9d9d9" style={{ backgroundColor: 'transparent' }} />
                )}
                <View style={styles.initStepInfo}>
                  <Text style={[
                    styles.initStepTitle,
                    step.status === 'completed' && styles.initStepTitleCompleted,
                  ]}>
                    {step.title}
                  </Text>
                  <Text style={styles.initStepDesc}>{step.description}</Text>
                </View>
              </View>
              {step.status === 'in_progress' && (
                <ProgressBar
                  progress={step.progress / 100}
                  color="#667eea"
                  style={styles.initStepProgress}
                />
              )}
            </View>
          ))}
        </Card.Content>
      </Card>

      {/* Preview Data */}
      {initComplete && previewData && (
        <Card style={styles.previewCard}>
          <Card.Content>
            <Text style={styles.previewTitle}>Generated Configuration</Text>

            <View style={styles.previewSection}>
              <Text style={styles.previewLabel}>Industry:</Text>
              <Chip mode="flat" style={styles.industryChip}>
                {previewData.industry}
              </Chip>
            </View>

            <Divider style={styles.previewDivider} />

            <View style={styles.previewSection}>
              <Text style={styles.previewLabel}>Product Types:</Text>
              <View style={styles.previewChips}>
                {previewData.productTypes.map((type, index) => (
                  <Chip key={index} mode="outlined" compact style={styles.previewChip}>
                    {type}
                  </Chip>
                ))}
              </View>
            </View>

            <Divider style={styles.previewDivider} />

            <View style={styles.previewSection}>
              <Text style={styles.previewLabel}>Material Types:</Text>
              <View style={styles.previewChips}>
                {previewData.materialTypes.map((type, index) => (
                  <Chip key={index} mode="outlined" compact style={styles.previewChip}>
                    {type}
                  </Chip>
                ))}
              </View>
            </View>

            <Divider style={styles.previewDivider} />

            <View style={styles.previewSection}>
              <Text style={styles.previewLabel}>Form Fields:</Text>
              <View style={styles.previewChips}>
                {previewData.formFields.map((field, index) => (
                  <Chip key={index} mode="outlined" compact style={styles.previewChip}>
                    {field}
                  </Chip>
                ))}
              </View>
            </View>
          </Card.Content>
        </Card>
      )}

      {initComplete && (
        <View style={styles.buttonRow}>
          <Button
            mode="outlined"
            onPress={() => {
              setCurrentStep(2);
              setInitComplete(false);
              setInitSteps(initSteps.map(s => ({ ...s, status: 'pending', progress: 0 })));
            }}
            style={styles.backButton}
          >
            Re-configure
          </Button>
          <Button
            mode="contained"
            onPress={handleApplyConfig}
            style={styles.applyButton}
            contentStyle={styles.nextButtonContent}
          >
            Apply Configuration
          </Button>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <LinearGradient colors={['#667eea', '#764ba2']} style={styles.header}>
        <View style={styles.headerContent}>
          <IconButton
            icon="arrow-left"
            iconColor="#fff"
            size={24}
            onPress={() => navigation.goBack()}
          />
          <Text style={styles.headerTitle}>AI Business Init</Text>
          <View style={{ width: 48 }} />
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Step Indicator */}
        {renderStepIndicator()}

        {/* Step Content */}
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
      </ScrollView>

      {/* Factory Selection Modal */}
      <Portal>
        <Modal
          visible={factoryModalVisible}
          onDismiss={() => setFactoryModalVisible(false)}
          contentContainerStyle={styles.modalContainer}
        >
          <Text style={styles.modalTitle}>Select Factory</Text>
          <ScrollView style={styles.modalList}>
            {factories.map((factory) => (
              <TouchableOpacity
                key={factory.id}
                style={styles.modalItem}
                onPress={() => handleFactorySelect(factory)}
              >
                <RadioButton
                  value={factory.id}
                  status={selectedFactory?.id === factory.id ? 'checked' : 'unchecked'}
                  onPress={() => handleFactorySelect(factory)}
                  color="#667eea"
                />
                <View style={styles.modalItemInfo}>
                  <Text style={styles.modalItemName}>{factory.name}</Text>
                  <View style={styles.modalItemMeta}>
                    <Text style={styles.modalItemIndustry}>{factory.industry}</Text>
                    <Chip
                      mode="flat"
                      compact
                      style={[styles.statusChip, { backgroundColor: `${getStatusColor(factory.status)}20` }]}
                      textStyle={[styles.statusChipText, { color: getStatusColor(factory.status) }]}
                    >
                      {factory.status}
                    </Chip>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Button mode="contained" onPress={() => setFactoryModalVisible(false)} style={styles.modalButton}>
            Confirm
          </Button>
        </Modal>
      </Portal>

      {/* Template Selection Modal */}
      <Portal>
        <Modal
          visible={templateModalVisible}
          onDismiss={() => setTemplateModalVisible(false)}
          contentContainerStyle={styles.modalContainer}
        >
          <Text style={styles.modalTitle}>Select Industry Template</Text>
          <ScrollView style={styles.modalList}>
            {templates.map((template) => (
              <TouchableOpacity
                key={template.id}
                style={[
                  styles.templateItem,
                  selectedTemplate?.id === template.id && styles.templateItemSelected,
                ]}
                onPress={() => handleTemplateSelect(template)}
              >
                <View style={styles.templateHeader}>
                  <Avatar.Icon
                    icon={template.icon}
                    size={40}
                    color="#667eea"
                    style={styles.templateIcon}
                  />
                  <View style={styles.templateInfo}>
                    <Text style={styles.templateName}>{template.name}</Text>
                    <View style={styles.templateMeta}>
                      <Chip mode="flat" compact style={styles.templateIndustryChip}>
                        {template.industry}
                      </Chip>
                      <Text style={styles.templatePopularity}>{template.popularity}% popular</Text>
                    </View>
                  </View>
                </View>
                <Text style={styles.templateDesc} numberOfLines={2}>
                  {template.description}
                </Text>
                <View style={styles.templateFeatures}>
                  {template.features.slice(0, 3).map((feature, index) => (
                    <Chip key={index} mode="outlined" compact style={styles.featureChip}>
                      {feature}
                    </Chip>
                  ))}
                  {template.features.length > 3 && (
                    <Chip mode="outlined" compact style={styles.featureChip}>
                      +{template.features.length - 3} more
                    </Chip>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Button mode="contained" onPress={() => setTemplateModalVisible(false)} style={styles.modalButton}>
            Confirm
          </Button>
        </Modal>
      </Portal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingBottom: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
    borderWidth: 2,
    borderColor: '#d9d9d9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleCompleted: {
    backgroundColor: '#52c41a',
    borderColor: '#52c41a',
  },
  stepCircleCurrent: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8c8c8c',
  },
  stepNumberCurrent: {
    color: '#fff',
  },
  stepLine: {
    width: 60,
    height: 2,
    backgroundColor: '#d9d9d9',
    marginHorizontal: 8,
  },
  stepLineCompleted: {
    backgroundColor: '#52c41a',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#262626',
    marginBottom: 8,
  },
  stepDescription: {
    fontSize: 14,
    color: '#8c8c8c',
    marginBottom: 24,
  },
  selectorButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  selectedItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedIcon: {
    backgroundColor: '#e6f7ff',
    marginRight: 12,
  },
  selectedInfo: {
    flex: 1,
  },
  selectedName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#262626',
  },
  selectedMeta: {
    fontSize: 12,
    color: '#8c8c8c',
    marginTop: 2,
  },
  placeholderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  placeholderText: {
    fontSize: 14,
    color: '#8c8c8c',
  },
  nextButton: {
    marginTop: 16,
    backgroundColor: '#667eea',
  },
  nextButtonContent: {
    height: 48,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#262626',
    marginBottom: 8,
  },
  descriptionInput: {
    backgroundColor: '#fff',
    marginBottom: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  backButton: {
    flex: 1,
    borderColor: '#667eea',
  },
  startButton: {
    flex: 2,
    backgroundColor: '#667eea',
  },
  applyButton: {
    flex: 2,
    backgroundColor: '#52c41a',
  },
  progressCard: {
    borderRadius: 12,
    marginBottom: 16,
  },
  initStep: {
    marginBottom: 16,
  },
  initStepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  initStepInfo: {
    flex: 1,
  },
  initStepTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#262626',
  },
  initStepTitleCompleted: {
    color: '#52c41a',
  },
  initStepDesc: {
    fontSize: 12,
    color: '#8c8c8c',
    marginTop: 2,
  },
  initStepProgress: {
    marginTop: 8,
    marginLeft: 36,
    height: 4,
    borderRadius: 2,
  },
  previewCard: {
    borderRadius: 12,
    marginBottom: 16,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#262626',
    marginBottom: 16,
  },
  previewSection: {
    marginBottom: 8,
  },
  previewLabel: {
    fontSize: 13,
    color: '#8c8c8c',
    marginBottom: 8,
  },
  previewDivider: {
    marginVertical: 12,
  },
  industryChip: {
    backgroundColor: '#667eea',
    alignSelf: 'flex-start',
  },
  previewChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  previewChip: {
    backgroundColor: '#f5f5f5',
  },
  modalContainer: {
    backgroundColor: '#fff',
    margin: 20,
    borderRadius: 12,
    padding: 20,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#262626',
    marginBottom: 16,
  },
  modalList: {
    maxHeight: 400,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalItemInfo: {
    flex: 1,
    marginLeft: 8,
  },
  modalItemName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#262626',
  },
  modalItemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  modalItemIndustry: {
    fontSize: 12,
    color: '#8c8c8c',
  },
  statusChip: {
    height: 22,
  },
  statusChipText: {
    fontSize: 10,
    fontWeight: '500',
  },
  modalButton: {
    marginTop: 16,
    backgroundColor: '#667eea',
  },
  templateItem: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#fafafa',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  templateItemSelected: {
    borderColor: '#667eea',
    backgroundColor: '#f0f5ff',
  },
  templateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  templateIcon: {
    backgroundColor: '#e6f7ff',
    marginRight: 12,
  },
  templateInfo: {
    flex: 1,
  },
  templateName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#262626',
  },
  templateMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  templateIndustryChip: {
    backgroundColor: '#e6f7ff',
    height: 22,
  },
  templatePopularity: {
    fontSize: 11,
    color: '#8c8c8c',
  },
  templateDesc: {
    fontSize: 13,
    color: '#595959',
    lineHeight: 18,
    marginBottom: 8,
  },
  templateFeatures: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  featureChip: {
    height: 24,
    backgroundColor: '#fff',
  },
});
