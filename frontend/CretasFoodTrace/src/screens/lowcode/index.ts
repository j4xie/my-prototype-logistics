/**
 * Low-code Page Configuration System
 * Phase 3 - General Purpose Page Editor Components
 */

export { PageEditor } from './PageEditor';
export type { PageEditorProps } from './PageEditor';

// Re-export from ComponentPalette
export { ComponentPalette, AVAILABLE_COMPONENTS } from './components/ComponentPalette';
export type {
  ComponentPaletteProps,
  AvailableComponent,
  ComponentCategory,
  PageType as ComponentPageType,
} from './components/ComponentPalette';

// Re-export PageType from store for convenience
export { PageType } from '../../store/pageConfigStore';
