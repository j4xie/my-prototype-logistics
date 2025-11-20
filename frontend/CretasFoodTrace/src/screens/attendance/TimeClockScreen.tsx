import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import {
  Text,
  Appbar,
  Card,
  Button,
  ActivityIndicator,
  List,
  Chip,
  Divider,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import { timeclockApiClient } from '../../services/api/timeclockApiClient';
import { useAuthStore } from '../../store/authStore';
import { getFactoryId } from '../../types/auth';
import { handleError } from '../../utils/errorHandler';

/**
 * 考勤打卡页面
 * 权限：所有登录用户
 * 功能：上班打卡、下班打卡、查看今日打卡记录、GPS定位
 */
export default function TimeClockScreen() {
  const navigation = useNavigation();
  const { user } = useAuthStore();

  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [todayRecords, setTodayRecords] = useState<any[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(true);
  const [lastClockIn, setLastClockIn] = useState<any>(null);
  const [gpsLocation, setGpsLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    // 更新当前时间
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    loadTodayRecords();
    loadGpsLocation();

    return () => clearInterval(timer);
  }, []);

  // 获取用户ID（转换为number）
  const getUserId = (): number | null => {
    if (!user?.id) return null;
    // user.id 可能是 string 或 number，需要转换
    const userId = typeof user.id === 'string' ? parseInt(user.id, 10) : user.id;
    return isNaN(userId) ? null : userId;
  };

  const loadTodayRecords = async () => {
    try {
      setLoadingRecords(true);

      const userId = getUserId();
      const factoryId = getFactoryId(user);
      
      if (!userId) {
        console.warn('用户ID不存在，无法加载打卡记录');
        return;
      }

      // 使用 /timeclock/today 端点获取今日打卡记录
      try {
        const todayResponse = await timeclockApiClient.getTodayRecord(userId, factoryId);

        if (todayResponse.data) {
          // 后端返回今日打卡记录
          setTodayRecords([todayResponse.data]);
          setLastClockIn(todayResponse.data);
        } else {
          // 今日未打卡
          setTodayRecords([]);
          setLastClockIn(null);
        }
      } catch (error) {
        // 如果获取失败，设置空数据
        console.error('❌ 获取今日打卡记录失败:', error);
        setTodayRecords([]);
        setLastClockIn(null);
      }
    } catch (error) {
      console.error('加载打卡记录失败:', error);
      setTodayRecords([]);
      setLastClockIn(null);
    } finally {
      setLoadingRecords(false);
    }
  };

  const loadGpsLocation = async () => {
    try {
      console.log('📍 Requesting location permissions...');

      // 1. 请求前台位置权限
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        console.warn('❌ Location permission denied');
        Alert.alert(
          '位置权限被拒绝',
          '打卡需要获取您的位置信息，请在设置中允许位置权限。',
          [{ text: '确定' }]
        );
        // 权限被拒绝时设置为null，禁用打卡按钮
        setGpsLocation(null);
        return;
      }

      console.log('✅ Location permission granted, getting current location...');

      // 2. 获取当前位置
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High, // 高精度定位
      });

      const { latitude, longitude } = location.coords;
      console.log('✅ GPS location obtained:', { latitude, longitude });

      setGpsLocation({ latitude, longitude });
    } catch (error) {
      console.error('❌ Failed to get GPS location:', error);
      Alert.alert(
        'GPS定位失败',
        '无法获取您的位置信息，请检查GPS是否开启。',
        [{ text: '确定' }]
      );
      // 定位失败时设置为null，禁用打卡按钮
      setGpsLocation(null);
    }
  };

  const handleClockIn = async () => {
    // 检查是否已经打过上班卡但未打下班卡（必须先下班打卡才能再次上班打卡）
    if (lastClockIn && lastClockIn.clockInTime && !lastClockIn.clockOutTime) {
      Alert.alert('提示', '您已经打过上班卡了，请先进行下班打卡');
      return;
    }
    
    // 如果已打过下班卡，可以再次打上班卡（开始新一轮工作）
    // 不做限制，允许继续打卡
    
    if (!gpsLocation) {
      Alert.alert('提示', '正在获取GPS位置，请稍候...');
      return;
    }

    Alert.alert(
      '确认上班打卡',
      `当前时间：${formatTime(currentTime)}\nGPS位置：已获取`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确认打卡',
          onPress: async () => {
            try {
              setLoading(true);

              // 使用新的 timeclock API 客户端
              const userId = getUserId();
              const factoryId = getFactoryId(user);
              
              if (!userId) {
                Alert.alert('错误', '用户ID无效');
                return;
              }
              
              const location = `纬度: ${gpsLocation.latitude.toFixed(6)}, 经度: ${gpsLocation.longitude.toFixed(6)}`;
              
              await timeclockApiClient.clockIn(
                {
                  userId,
                  location,
                  device: 'Mobile App', // 可以后续从设备信息获取
                  latitude: gpsLocation.latitude,
                  longitude: gpsLocation.longitude,
                },
                factoryId
              );

              Alert.alert('成功', '上班打卡成功！');
              loadTodayRecords();
            } catch (error) {
              console.error('打卡失败:', error);
              Alert.alert('错误', error.response?.data?.message || '打卡失败');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleClockOut = async () => {
    // 检查是否已上班打卡（根据后端返回的数据结构）
    // 后端返回的是TimeClockRecord，包含clockInTime和clockOutTime字段
    const hasClockIn = lastClockIn && lastClockIn.clockInTime && !lastClockIn.clockOutTime;
    
    if (!hasClockIn) {
      Alert.alert('提示', '您今天还未上班打卡，请先进行上班打卡');
      return;
    }

    if (!gpsLocation) {
      Alert.alert('提示', '正在获取GPS位置，请稍候...');
      return;
    }

    Alert.alert(
      '确认下班打卡',
      `当前时间：${formatTime(currentTime)}\nGPS位置：已获取`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确认打卡',
          onPress: async () => {
            try {
              setLoading(true);

              // 使用新的 timeclock API 客户端
              const userId = getUserId();
              const factoryId = getFactoryId(user);
              
              if (!userId) {
                Alert.alert('错误', '用户ID无效');
                return;
              }
              
              await timeclockApiClient.clockOut(
                {
                  userId,
                },
                factoryId
              );

              Alert.alert('成功', '下班打卡成功！');
              loadTodayRecords();
            } catch (error) {
              console.error('打卡失败:', error);
              Alert.alert('错误', error.response?.data?.message || '打卡失败');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const formatTime = (date: Date) => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}年${month}月${day}日`;
  };

  const getClockTypeName = (type: string) => {
    switch (type) {
      case 'clock_in': return '上班打卡';
      case 'clock_out': return '下班打卡';
      case 'break_start': return '开始休息';
      case 'break_end': return '结束休息';
      default: return type || '未知';
    }
  };

  const getClockTypeColor = (type: string) => {
    switch (type) {
      case 'clock_in': return '#4CAF50'; // 绿色
      case 'clock_out': return '#2196F3'; // 蓝色
      case 'break_start': return '#FF9800'; // 橙色
      case 'break_end': return '#9C27B0'; // 紫色
      default: return '#999';
    }
  };

  const getCurrentStatus = () => {
    if (!lastClockIn || todayRecords.length === 0) {
      return { text: '未打卡', color: '#999', description: '您今天还未打卡' };
    }

    // 根据后端返回的TimeClockRecord结构判断状态
    // status字段: WORKING, ON_BREAK, OFF_WORK
    // 或者根据clockInTime和clockOutTime判断
    const record = lastClockIn;
    
    if (record.status) {
      // 使用status字段
      switch (record.status) {
        case 'WORKING':
          return { text: '工作中', color: '#4CAF50', description: '已上班，记得下班打卡' };
        case 'ON_BREAK':
          return { text: '休息中', color: '#FF9800', description: '正在休息，记得结束休息' };
        case 'OFF_WORK':
          return { text: '已下班', color: '#2196F3', description: '今日打卡已完成' };
        default:
          // 降级到根据时间字段判断
          break;
      }
    }
    
    // 降级判断：根据clockInTime和clockOutTime
    if (record.clockInTime && !record.clockOutTime) {
      // 已上班但未下班
      if (record.breakStartTime && !record.breakEndTime) {
        return { text: '休息中', color: '#FF9800', description: '正在休息，记得结束休息' };
      }
      return { text: '工作中', color: '#4CAF50', description: '已上班，记得下班打卡' };
    } else if (record.clockInTime && record.clockOutTime) {
      return { text: '已下班', color: '#2196F3', description: '今日打卡已完成' };
    }
    
    return { text: '未知状态', color: '#999', description: '无法确定当前状态' };
  };

  const getStatusBadgeColor = (color: string) => {
    // 将颜色转换为带透明度的 rgba 格式
    // 支持3位和6位十六进制颜色格式
    // #999 -> rgba(153, 153, 153, 0.12)
    // #4CAF50 -> rgba(76, 175, 80, 0.12)
    // #2196F3 -> rgba(33, 150, 243, 0.12)
    
    // 如果颜色不是字符串或为空，返回默认颜色
    if (!color || typeof color !== 'string') {
      return 'rgba(153, 153, 153, 0.12)';
    }
    
    const hex = color.replace('#', '').trim();
    
    // 如果hex为空或长度不对，返回默认颜色
    if (!hex || (hex.length !== 3 && hex.length !== 6)) {
      return 'rgba(153, 153, 153, 0.12)';
    }
    
    let r: number, g: number, b: number;
    
    if (hex.length === 3) {
      // 3位格式：#RGB -> #RRGGBB
      // 确保每个字符都存在
      const rHex = hex.charAt(0) + hex.charAt(0);
      const gHex = hex.charAt(1) + hex.charAt(1);
      const bHex = hex.charAt(2) + hex.charAt(2);
      
      r = parseInt(rHex, 16);
      g = parseInt(gHex, 16);
      b = parseInt(bHex, 16);
    } else {
      // 6位格式：#RRGGBB
      r = parseInt(hex.substring(0, 2), 16);
      g = parseInt(hex.substring(2, 4), 16);
      b = parseInt(hex.substring(4, 6), 16);
    }
    
    // 验证解析结果
    if (isNaN(r) || isNaN(g) || isNaN(b)) {
      // 如果解析失败，返回默认颜色
      console.warn(`颜色解析失败: ${color}, 使用默认颜色`);
      return 'rgba(153, 153, 153, 0.12)';
    }
    
    return `rgba(${r}, ${g}, ${b}, 0.12)`;
  };

  const status = getCurrentStatus();

  return (
    <View style={styles.container}>
      {/* Header */}
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="考勤打卡" />
        <Appbar.Action
          icon="history"
          onPress={() => navigation.navigate('AttendanceHistory')}
        />
        <Appbar.Action icon="refresh" onPress={loadTodayRecords} />
      </Appbar.Header>

      <ScrollView style={styles.content}>
        {/* Current Time Card */}
        <Card style={styles.timeCard}>
          <Card.Content style={styles.timeCardContent}>
            <Text style={styles.dateText}>{formatDate(currentTime)}</Text>
            <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
            <View style={styles.statusBadge}>
              <Chip
                mode="flat"
                style={[
                  styles.statusChip,
                  { backgroundColor: getStatusBadgeColor(status.color) }
                ]}
                textStyle={{ color: status.color, fontWeight: 'bold' }}
              >
                {status.text}
              </Chip>
            </View>
            <Text style={styles.statusDescription}>{status.description}</Text>
          </Card.Content>
        </Card>

        {/* GPS Location */}
        <Card style={styles.locationCard}>
          <Card.Content>
            <View style={styles.locationHeader}>
              <List.Icon icon="map-marker" color="#2196F3" />
              <Text style={styles.locationTitle}>GPS定位</Text>
            </View>
            {gpsLocation ? (
              <View style={styles.locationInfo}>
                <Text style={styles.locationText}>
                  纬度: {gpsLocation.latitude.toFixed(6)}
                </Text>
                <Text style={styles.locationText}>
                  经度: {gpsLocation.longitude.toFixed(6)}
                </Text>
                <Chip
                  mode="flat"
                  compact
                  icon="check-circle"
                  style={styles.gpsChip}
                  textStyle={{ color: '#4CAF50', fontSize: 11 }}
                >
                  定位成功
                </Chip>
              </View>
            ) : (
              <View style={styles.locationInfo}>
                <ActivityIndicator size="small" />
                <Text style={styles.locationText}>正在获取位置...</Text>
              </View>
            )}
          </Card.Content>
        </Card>

        {/* Clock Buttons */}
        <View style={styles.buttonContainer}>
          {(() => {
            // 计算按钮禁用状态
            const clockInDisabled = loading || 
              !gpsLocation || 
              // 如果已打过上班卡但未打下班卡，不能再次打上班卡（必须先下班打卡）
              (lastClockIn && lastClockIn.clockInTime && !lastClockIn.clockOutTime);
            
            const clockOutDisabled = loading || 
              !gpsLocation || 
              // 必须已上班打卡才能下班打卡
              !lastClockIn || 
              !lastClockIn.clockInTime || 
              // 如果已打过下班卡，不能再打（但可以再次打上班卡开始新一轮）
              !!lastClockIn.clockOutTime;
            
            return (
              <>
                <Button
                  mode="contained"
                  onPress={handleClockIn}
                  style={[styles.clockButton, styles.clockInButton]}
                  contentStyle={styles.clockButtonContent}
                  labelStyle={styles.clockButtonLabel}
                  icon="login"
                  loading={loading}
                  disabled={clockInDisabled}
                >
                  上班打卡
                </Button>

                <Button
                  mode="contained"
                  onPress={handleClockOut}
                  style={[styles.clockButton, styles.clockOutButton]}
                  contentStyle={styles.clockButtonContent}
                  labelStyle={styles.clockButtonLabel}
                  icon="logout"
                  loading={loading}
                  disabled={clockOutDisabled}
                >
                  下班打卡
                </Button>
              </>
            );
          })()}
        </View>

        {/* Today's Records */}
        <Card style={styles.recordsCard}>
          <Card.Content>
            <Text style={styles.recordsTitle}>今日打卡记录</Text>
            <Divider style={styles.divider} />

            {loadingRecords ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" />
                <Text style={styles.loadingText}>加载中...</Text>
              </View>
            ) : todayRecords.length === 0 ? (
              <View style={styles.emptyRecords}>
                <List.Icon icon="clock-outline" color="#999" />
                <Text style={styles.emptyText}>今日暂无打卡记录</Text>
              </View>
            ) : (
              // 将单条TimeClockRecord转换为多条显示记录
              (() => {
                const displayRecords: any[] = [];
                
                todayRecords.forEach((record: any) => {
                  // 上班打卡记录
                  if (record.clockInTime) {
                    displayRecords.push({
                      id: `${record.id}_clock_in`,
                      type: 'clock_in',
                      clockTime: record.clockInTime,
                      location: record.clockLocation,
                      device: record.clockDevice,
                      notes: record.notes,
                    });
                  }
                  
                  // 休息开始记录
                  if (record.breakStartTime) {
                    displayRecords.push({
                      id: `${record.id}_break_start`,
                      type: 'break_start',
                      clockTime: record.breakStartTime,
                      location: record.clockLocation,
                      notes: record.notes,
                    });
                  }
                  
                  // 休息结束记录
                  if (record.breakEndTime) {
                    displayRecords.push({
                      id: `${record.id}_break_end`,
                      type: 'break_end',
                      clockTime: record.breakEndTime,
                      location: record.clockLocation,
                      notes: record.notes,
                    });
                  }
                  
                  // 下班打卡记录
                  if (record.clockOutTime) {
                    displayRecords.push({
                      id: `${record.id}_clock_out`,
                      type: 'clock_out',
                      clockTime: record.clockOutTime,
                      location: record.clockLocation,
                      device: record.clockDevice,
                      notes: record.notes,
                    });
                  }
                });
                
                // 按时间倒序排列
                displayRecords.sort((a, b) => {
                  const timeA = new Date(a.clockTime).getTime();
                  const timeB = new Date(b.clockTime).getTime();
                  return timeB - timeA;
                });
                
                return displayRecords.length === 0 ? (
                  <View style={styles.emptyRecords}>
                    <List.Icon icon="clock-outline" color="#999" />
                    <Text style={styles.emptyText}>今日暂无打卡记录</Text>
                  </View>
                ) : (
                  displayRecords.map((record, index) => (
                    <View key={record.id || index} style={styles.recordItem}>
                      <View style={styles.recordHeader}>
                        <Chip
                          mode="flat"
                          compact
                          style={[
                            styles.recordTypeChip,
                            { backgroundColor: getStatusBadgeColor(getClockTypeColor(record.type)) }
                          ]}
                          textStyle={{ color: getClockTypeColor(record.type), fontSize: 11 }}
                        >
                          {getClockTypeName(record.type)}
                        </Chip>
                        <Text style={styles.recordTime}>
                          {record.clockTime 
                            ? new Date(record.clockTime).toLocaleTimeString('zh-CN', { 
                                hour: '2-digit', 
                                minute: '2-digit', 
                                second: '2-digit' 
                              })
                            : '--:--:--'}
                        </Text>
                      </View>
                      {(record.location || record.clockLocation) && (
                        <View style={styles.recordLocation}>
                          <List.Icon icon="map-marker" style={styles.recordIcon} />
                          <Text style={styles.recordLocationText}>{record.location || record.clockLocation}</Text>
                        </View>
                      )}
                      {record.notes && (
                        <Text style={styles.recordNotes}>{record.notes}</Text>
                      )}
                    </View>
                  ))
                );
              })()
            )}
          </Card.Content>
        </Card>

        {/* Quick Access to Statistics */}
        <Card style={styles.recordsCard}>
          <Card.Content>
            <Text style={styles.recordsTitle}>统计与查询</Text>
            <Divider style={styles.divider} />

            <Button
              mode="outlined"
              icon="history"
              onPress={() => navigation.navigate('ClockHistory')}
              style={styles.quickActionButton}
            >
              打卡历史
            </Button>

            <Button
              mode="outlined"
              icon="chart-bar"
              onPress={() => navigation.navigate('TimeStatistics')}
              style={styles.quickActionButton}
            >
              工时统计
            </Button>

            <Button
              mode="outlined"
              icon="notebook"
              onPress={() => navigation.navigate('WorkRecords')}
              style={styles.quickActionButton}
            >
              工作记录
            </Button>

            <Button
              mode="outlined"
              icon="account-group"
              onPress={() => navigation.navigate('DepartmentAttendance')}
              style={styles.quickActionButton}
            >
              部门考勤
            </Button>
          </Card.Content>
        </Card>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
  },
  timeCard: {
    margin: 16,
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
    elevation: 4,
  },
  timeCardContent: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  dateText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  timeText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#333',
    fontVariant: ['tabular-nums'],
  },
  statusBadge: {
    marginTop: 16,
    marginBottom: 8,
  },
  statusChip: {
    paddingHorizontal: 12,
  },
  statusDescription: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  locationCard: {
    margin: 16,
    marginBottom: 8,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  locationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: -8,
  },
  locationInfo: {
    paddingLeft: 8,
  },
  locationText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  gpsChip: {
    alignSelf: 'flex-start',
    marginTop: 8,
    backgroundColor: '#E8F5E9',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    margin: 16,
  },
  clockButton: {
    flex: 1,
    borderRadius: 12,
    elevation: 2,
  },
  clockButtonContent: {
    paddingVertical: 16,
  },
  clockButtonLabel: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  clockInButton: {
    backgroundColor: '#4CAF50',
  },
  clockOutButton: {
    backgroundColor: '#2196F3',
  },
  recordsCard: {
    margin: 16,
    marginBottom: 8,
  },
  recordsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  divider: {
    marginBottom: 12,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
    color: '#666',
    fontSize: 13,
  },
  emptyRecords: {
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
  recordItem: {
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    marginBottom: 8,
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  recordTypeChip: {
    height: 24,
  },
  recordTime: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  recordLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  recordIcon: {
    margin: 0,
    marginRight: 4,
    width: 24,
  },
  recordLocationText: {
    fontSize: 12,
    color: '#666',
    flex: 1,
  },
  recordNotes: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  quickActionButton: {
    marginBottom: 8,
  },
  bottomPadding: {
    height: 80,
  },
});
