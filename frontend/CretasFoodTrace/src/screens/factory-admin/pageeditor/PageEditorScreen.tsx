/**
 * Wrapper screen that adapts the standalone `PageEditor` component to
 * React Navigation route params. Resolves factoryId from auth store and
 * defaults pageType to 'home' / pageId to a session-scoped draft id.
 *
 * Route entry: FAManagementStack/PageEditor (see types/navigation.ts).
 */
import React, { useCallback, useMemo } from 'react';
import { Alert } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { PageEditor } from '../../lowcode/PageEditor';
import { PageType } from '../../../store/pageConfigStore';
import { useAuthStore } from '../../../store/authStore';
import { FAManagementStackParamList } from '../../../types/navigation';

type ScreenRouteProp = RouteProp<FAManagementStackParamList, 'PageEditor'>;
type ScreenNavigationProp = NativeStackNavigationProp<FAManagementStackParamList, 'PageEditor'>;

const PAGE_TYPE_FROM_PARAM: Record<
  NonNullable<NonNullable<ScreenRouteProp['params']>['pageType']>,
  PageType
> = {
  home: PageType.HOME,
  dashboard: PageType.DASHBOARD,
  list: PageType.LIST,
  detail: PageType.DETAIL,
  form: PageType.FORM,
};

export function PageEditorScreen() {
  const route = useRoute<ScreenRouteProp>();
  const navigation = useNavigation<ScreenNavigationProp>();
  const params = route.params;

  const user = useAuthStore(state => state.user);
  const factoryId = user?.factoryId;

  const pageType = useMemo<PageType>(() => {
    const raw = params?.pageType;
    if (raw && raw in PAGE_TYPE_FROM_PARAM) {
      return PAGE_TYPE_FROM_PARAM[raw];
    }
    return PageType.HOME;
  }, [params?.pageType]);

  const pageId = useMemo(
    () => params?.pageId ?? `draft_${pageType}_${Date.now()}`,
    [params?.pageId, pageType],
  );

  const handleClose = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  if (!factoryId) {
    Alert.alert('未登录', '请先登录工厂管理员账号再使用页面编辑器。');
    return null;
  }

  return (
    <PageEditor
      pageId={pageId}
      factoryId={factoryId}
      pageType={pageType}
      onClose={handleClose}
    />
  );
}

export default PageEditorScreen;
