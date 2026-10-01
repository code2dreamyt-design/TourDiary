import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import TDHomeScreen from '../screens/td/TDHomeScreen';
import TDFormScreen from '../screens/td/TDFormScreen';
import TDSizesScreen from '../screens/td/TDSizesScreen';
import TDResultScreen from '../screens/td/TDResultScreen';
import TDExportScreen from '../screens/td/TDExportScreen';
import HeaderAvatar from '../components/HeaderAvatar';
import { TDDraftProvider } from '../context/TDDraftContext';
import { COLORS } from '../constants/colors';

const Stack = createNativeStackNavigator();

// The TD tab. The draft provider wraps the whole stack so the form -> sizes
// -> result screens share one in-progress TD.
export default function TDStackNavigator() {
  return (
    <TDDraftProvider>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: COLORS.header },
          headerTintColor: COLORS.white,
          headerTitleStyle: { fontWeight: '700' },
          headerRight: () => <HeaderAvatar />,
        }}
      >
        <Stack.Screen name="TDHome" component={TDHomeScreen} options={{ title: 'TD Calculator' }} />
        <Stack.Screen name="TDForm" component={TDFormScreen} options={{ title: 'TD Details' }} />
        <Stack.Screen name="TDSizes" component={TDSizesScreen} options={{ title: 'Sizes' }} />
        <Stack.Screen name="TDResult" component={TDResultScreen} options={{ title: 'Result' }} />
        <Stack.Screen name="TDExport" component={TDExportScreen} options={{ title: 'Export TDs' }} />
      </Stack.Navigator>
    </TDDraftProvider>
  );
}
