/**
 * DynamicThemeProvider - Dynamic Theme Context Provider
 *
 * Provides dynamic theme colors based on user role and factory configuration.
 * Theme priority: Factory Custom > Role Default > Global Default
 *
 * Phase 3.5: Multi-role Theme System
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  PropsWithChildren,
} from 'react';
import { useAuthStore } from '../store/authStore';
import {
  useRoleThemeStore,
  ThemeColors,
  RoleCode,
  DEFAULT_THEME,
} from '../store/roleThemeStore';
import { theme as baseTheme } from '../theme/index';

// ============================================
// Types
// ============================================

/**
 * Extended theme colors including base theme colors
 */
export interface ExtendedThemeColors extends ThemeColors {
  // Additional colors from base theme
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  border: string;
  divider: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  info: string;
}

/**
 * Context value provided by DynamicThemeProvider
 */
export interface DynamicThemeContextValue {
  /** Current theme colors (merged from all sources) */
  colors: ExtendedThemeColors;
  /** Current role code */
  roleCode: RoleCode | null;
  /** Whether theme is loading */
  isLoading: boolean;
  /** Theme loading error (if any) */
  error: string | null;
  /** Custom logo URL for current role/factory */
  logoUrl: string | undefined;
  /** Welcome text for current role/factory */
  welcomeText: string;
  /** Whether a custom theme is active (not default) */
  hasCustomTheme: boolean;
}

// ============================================
// Default Values
// ============================================

/**
 * Default extended colors derived from base theme
 */
const defaultExtendedColors: ExtendedThemeColors = {
  // From roleThemeStore defaults
  primaryColor: DEFAULT_THEME.primaryColor,
  secondaryColor: DEFAULT_THEME.secondaryColor,
  accentColor: DEFAULT_THEME.accentColor,
  backgroundColor: DEFAULT_THEME.backgroundColor,
  surfaceColor: DEFAULT_THEME.surfaceColor,
  textColor: DEFAULT_THEME.textColor,
  successColor: DEFAULT_THEME.successColor,
  warningColor: DEFAULT_THEME.warningColor,
  errorColor: DEFAULT_THEME.errorColor,
  // From base theme
  onPrimary: baseTheme.colors.onPrimary,
  primaryContainer: baseTheme.colors.primaryContainer,
  onPrimaryContainer: baseTheme.colors.onPrimaryContainer,
  border: baseTheme.colors.border,
  divider: baseTheme.colors.divider,
  text: baseTheme.colors.text,
  textSecondary: baseTheme.colors.textSecondary,
  textTertiary: baseTheme.colors.textTertiary,
  info: baseTheme.colors.info,
};

/**
 * Default context value
 */
const defaultContextValue: DynamicThemeContextValue = {
  colors: defaultExtendedColors,
  roleCode: null,
  isLoading: false,
  error: null,
  logoUrl: undefined,
  welcomeText: DEFAULT_THEME.welcomeText || '',
  hasCustomTheme: false,
};

// ============================================
// Context
// ============================================

export const DynamicThemeContext =
  createContext<DynamicThemeContextValue>(defaultContextValue);

// ============================================
// Provider Component
// ============================================

/**
 * DynamicThemeProvider
 *
 * Wraps children with a theme context that dynamically changes based on user role.
 * Automatically loads theme when user role or factoryId changes.
 *
 * @example
 * ```tsx
 * <DynamicThemeProvider>
 *   <App />
 * </DynamicThemeProvider>
 * ```
 */
export const DynamicThemeProvider: React.FC<PropsWithChildren> = ({
  children,
}) => {
  // Auth store - user info
  const user = useAuthStore((state) => state.user);
  const getUserRole = useAuthStore((state) => state.getUserRole);
  const getFactoryId = useAuthStore((state) => state.getFactoryId);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  // Role theme store
  const loadTheme = useRoleThemeStore((state) => state.loadTheme);
  const currentTheme = useRoleThemeStore((state) => state.currentTheme);
  const getThemedColors = useRoleThemeStore((state) => state.getThemedColors);
  const isLoading = useRoleThemeStore((state) => state.isLoading);
  const error = useRoleThemeStore((state) => state.error);
  const getWelcomeText = useRoleThemeStore((state) => state.getWelcomeText);
  const getLogoUrl = useRoleThemeStore((state) => state.getLogoUrl);
  const resetTheme = useRoleThemeStore((state) => state.resetTheme);

  // Get current role and factory
  const roleCode = getUserRole() as RoleCode | null;
  const factoryId = getFactoryId();

  // Load theme when role or factory changes
  useEffect(() => {
    const loadThemeForUser = async () => {
      if (!isAuthenticated || !roleCode) {
        // User not authenticated, reset to default theme
        resetTheme();
        return;
      }

      // Factory users have a factoryId, platform users don't
      const effectiveFactoryId = factoryId || 'platform';

      try {
        await loadTheme(roleCode, effectiveFactoryId);
      } catch (err) {
        // Error is handled within loadTheme, just log here
        console.warn('[DynamicThemeProvider] Theme load error:', err);
      }
    };

    loadThemeForUser();
  }, [isAuthenticated, roleCode, factoryId, loadTheme, resetTheme]);

  // Merge colors: Factory Custom > Role Default > Global Default
  const mergedColors = useMemo<ExtendedThemeColors>(() => {
    const roleColors = getThemedColors();

    return {
      // Role theme colors (highest priority)
      primaryColor: roleColors.primaryColor,
      secondaryColor: roleColors.secondaryColor,
      accentColor: roleColors.accentColor,
      backgroundColor: roleColors.backgroundColor,
      surfaceColor: roleColors.surfaceColor,
      textColor: roleColors.textColor,
      successColor: roleColors.successColor,
      warningColor: roleColors.warningColor,
      errorColor: roleColors.errorColor,

      // Base theme colors (fallback for additional properties)
      onPrimary: baseTheme.colors.onPrimary,
      primaryContainer: generateLightVariant(roleColors.primaryColor),
      onPrimaryContainer: generateDarkVariant(roleColors.primaryColor),
      border: baseTheme.colors.border,
      divider: baseTheme.colors.divider,
      text: roleColors.textColor,
      textSecondary: baseTheme.colors.textSecondary,
      textTertiary: baseTheme.colors.textTertiary,
      info: baseTheme.colors.info,
    };
  }, [getThemedColors, currentTheme]);

  // Build context value
  const contextValue = useMemo<DynamicThemeContextValue>(
    () => ({
      colors: mergedColors,
      roleCode,
      isLoading,
      error,
      logoUrl: getLogoUrl(),
      welcomeText: getWelcomeText(),
      hasCustomTheme: currentTheme !== null,
    }),
    [
      mergedColors,
      roleCode,
      isLoading,
      error,
      getLogoUrl,
      getWelcomeText,
      currentTheme,
    ]
  );

  return (
    <DynamicThemeContext.Provider value={contextValue}>
      {children}
    </DynamicThemeContext.Provider>
  );
};

// ============================================
// Hooks
// ============================================

/**
 * Hook to access the dynamic theme context
 *
 * @returns DynamicThemeContextValue
 * @throws Error if used outside of DynamicThemeProvider
 *
 * @example
 * ```tsx
 * const { colors, roleCode, isLoading } = useDynamicTheme();
 * ```
 */
export const useDynamicTheme = (): DynamicThemeContextValue => {
  const context = useContext(DynamicThemeContext);

  if (context === undefined) {
    throw new Error(
      'useDynamicTheme must be used within a DynamicThemeProvider'
    );
  }

  return context;
};

/**
 * Hook to get a specific color from the theme
 *
 * @param key - The color key to retrieve
 * @returns The color value
 *
 * @example
 * ```tsx
 * const primaryColor = useThemeColor('primaryColor');
 * const backgroundColor = useThemeColor('backgroundColor');
 * ```
 */
export const useThemeColor = (key: keyof ExtendedThemeColors): string => {
  const { colors } = useDynamicTheme();
  return colors[key];
};

/**
 * Hook to get all theme colors
 *
 * @returns All theme colors
 *
 * @example
 * ```tsx
 * const colors = useThemeColors();
 * <View style={{ backgroundColor: colors.backgroundColor }} />
 * ```
 */
export const useThemeColors = (): ExtendedThemeColors => {
  const { colors } = useDynamicTheme();
  return colors;
};

/**
 * Hook to check if theme is loading
 *
 * @returns Loading state and error
 *
 * @example
 * ```tsx
 * const { isLoading, error } = useThemeLoading();
 * if (isLoading) return <LoadingSpinner />;
 * ```
 */
export const useThemeLoading = (): { isLoading: boolean; error: string | null } => {
  const { isLoading, error } = useDynamicTheme();
  return { isLoading, error };
};

/**
 * Hook to get branding info (logo, welcome text)
 *
 * @returns Branding information
 *
 * @example
 * ```tsx
 * const { logoUrl, welcomeText } = useThemeBranding();
 * ```
 */
export const useThemeBranding = (): {
  logoUrl: string | undefined;
  welcomeText: string;
  roleCode: RoleCode | null;
} => {
  const { logoUrl, welcomeText, roleCode } = useDynamicTheme();
  return { logoUrl, welcomeText, roleCode };
};

// ============================================
// Utility Functions
// ============================================

/**
 * Generate a lighter variant of a color (for containers/backgrounds)
 */
function generateLightVariant(hex: string): string {
  const color = hex.replace('#', '');
  const r = parseInt(color.substring(0, 2), 16);
  const g = parseInt(color.substring(2, 4), 16);
  const b = parseInt(color.substring(4, 6), 16);

  // Lighten by 85%
  const newR = Math.round(r + (255 - r) * 0.85);
  const newG = Math.round(g + (255 - g) * 0.85);
  const newB = Math.round(b + (255 - b) * 0.85);

  return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`.toUpperCase();
}

/**
 * Generate a darker variant of a color (for text on light backgrounds)
 */
function generateDarkVariant(hex: string): string {
  const color = hex.replace('#', '');
  const r = parseInt(color.substring(0, 2), 16);
  const g = parseInt(color.substring(2, 4), 16);
  const b = parseInt(color.substring(4, 6), 16);

  // Darken by 40%
  const newR = Math.round(r * 0.6);
  const newG = Math.round(g * 0.6);
  const newB = Math.round(b * 0.6);

  return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`.toUpperCase();
}

export default DynamicThemeProvider;
