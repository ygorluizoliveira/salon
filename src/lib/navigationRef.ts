import { createNavigationContainerRef } from '@react-navigation/native';

/**
 * Global navigation ref.
 *
 * Atribuído ao <NavigationContainer ref={navigationRef}> em App.tsx.
 * Permite navegar de fora da árvore React (ex.: SideDrawer renderizado
 * fora do NavigationContainer).
 *
 * Uso:
 *   if (navigationRef.isReady()) navigationRef.navigate('Main', { screen: 'Agenda' });
 */
export const navigationRef = createNavigationContainerRef<Record<string, object | undefined>>();
