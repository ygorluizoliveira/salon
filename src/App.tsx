import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { LayoutDashboard, Calendar, Users, Wallet, MoreHorizontal, Truck, Tag, Bell, Settings, Megaphone } from 'lucide-react-native';
import { navigationRef } from './lib/navigationRef';
import { DrawerProvider } from './lib/DrawerContext';
import { SideDrawer } from './components/SideDrawer';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { SalonSettingsProvider } from './lib/hooks/useSalonSettings';
import { LoginScreen } from './pages/LoginScreen';

import { Dashboard } from './pages/Dashboard';
import { ClientList } from './pages/ClientList';
import { ClientProfile } from './pages/ClientProfile';
import { Agenda } from './pages/Agenda';
import { Finance } from './pages/Finance';
import { NewSupplier } from './pages/NewSupplier';
import { SendReminder } from './pages/SendReminder';
import { ServiceCategories } from './pages/ServiceCategories';
import { SalonSettings } from './pages/SalonSettings';
import { Promotions } from './pages/Promotions';
import WorkingHours from './pages/WorkingHours';
import { UserProfile } from './pages/UserProfile';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const MORE_OPTIONS = [
  { label: 'Fornecedores', icon: Truck,      screen: 'Main',              tab: 'Mais'       },
  { label: 'Serviços',     icon: Tag,        screen: 'ServiceCategories', tab: undefined    },
  { label: 'Lembretes',    icon: Bell,       screen: 'Reminders',         tab: undefined    },
  { label: 'Promoções',    icon: Megaphone,  screen: 'Promotions',        tab: undefined    },
  { label: 'Configurações', icon: Settings,   screen: 'SalonSettings',     tab: undefined    },
];

const TABS = [
  { name: 'Início',     icon: LayoutDashboard },
  { name: 'Agenda',     icon: Calendar        },
  { name: 'Clientes',   icon: Users           },
  { name: 'Financeiro', icon: Wallet          },
  { name: 'Mais',       icon: MoreHorizontal  },
] as const;

function CustomTabBar({ state, navigation }: any) {
  return null;
}

function ClientStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ClientList" component={ClientList} />
      <Stack.Screen name="ClientProfile" component={ClientProfile} />
    </Stack.Navigator>
  );
}

const TAB_BAR_STYLE = {
  backgroundColor: '#fef7fe',
  borderTopLeftRadius: 32,
  borderTopRightRadius: 32,
  height: 90,
  paddingBottom: 30,
  paddingTop: 10,
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  elevation: 10,
  boxShadow: '0 -8px 32px rgba(53, 49, 58, 0.04)',
} as const;

function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false, tabBarStyle: { display: 'none' } }}
    >
      <Tab.Screen name="Início"     component={Dashboard}   />
      <Tab.Screen name="Agenda"     component={Agenda}      />
      <Tab.Screen name="Clientes"   component={ClientStack} />
      <Tab.Screen name="Financeiro" component={Finance}     />
      <Tab.Screen name="Mais"       component={NewSupplier} />
    </Tab.Navigator>
  );
}

function NotAdminScreen() {
  const { signOut } = useAuth();
  useEffect(() => {
    const t = setTimeout(() => window.location.replace('/cliente'), 4000);
    return () => clearTimeout(t);
  }, []);
  return (
    <View style={{ flex: 1, backgroundColor: '#fef7fe', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <Text style={{ fontSize: 22, fontWeight: '700', color: '#68597a', textAlign: 'center', marginBottom: 12 }}>
        Acesso restrito
      </Text>
      <Text style={{ color: '#625d67', fontSize: 14, textAlign: 'center', maxWidth: 360, marginBottom: 24 }}>
        Esta área é exclusiva para a gestão do salão. Você será redirecionado para a Área do Cliente.
      </Text>
      <TouchableOpacity
        onPress={() => window.location.replace('/cliente')}
        style={{ backgroundColor: '#68597a', borderRadius: 50, paddingVertical: 14, paddingHorizontal: 28, marginBottom: 12 }}
      >
        <Text style={{ color: '#fff', fontWeight: '700' }}>Ir para a Área do Cliente</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => { signOut(); }}>
        <Text style={{ color: '#68597a', fontWeight: '600' }}>Sair</Text>
      </TouchableOpacity>
    </View>
  );
}

function AuthGate() {
  const { session, loading } = useAuth();
  if (loading) return null;
  if (!session) return <LoginScreen />;
  if (session.user.app_metadata?.role !== 'admin') return <NotAdminScreen />;

  const linking = {
    prefixes: [],
    config: {
      screens: {
        Main: {
          path: '',
          screens: {
            'Início':     '',
            Agenda:       'agenda',
            Clientes: {
              path: 'clientes',
              screens: {
                ClientList:    '',
                ClientProfile: ':id',
              },
            },
            Financeiro:   'financeiro',
            Mais:         'mais',
          },
        },
        Reminders:          'lembretes',
        ServiceCategories:  'categorias',
      },
    },
  };

  return (
    <DrawerProvider>
      <NavigationContainer ref={navigationRef} linking={linking}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen name="Reminders" component={SendReminder} />
          <Stack.Screen name="ServiceCategories" component={ServiceCategories} />
          <Stack.Screen name="SalonSettings" component={SalonSettings} />
          <Stack.Screen name="Promotions" component={Promotions} />
          <Stack.Screen name="WorkingHours" component={WorkingHours} />
          <Stack.Screen name="UserProfile" component={UserProfile} />
        </Stack.Navigator>
      </NavigationContainer>
      <SideDrawer />
    </DrawerProvider>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <SalonSettingsProvider>
            <AuthGate />
          </SalonSettingsProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
