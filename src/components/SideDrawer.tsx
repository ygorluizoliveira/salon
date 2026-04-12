import React from 'react';
import {
  LayoutDashboard, Calendar, Users, Wallet,
  Truck, Bell, Tag, Megaphone, Settings, Clock,
} from 'lucide-react-native';
import { navigationRef } from '../lib/navigationRef';
import { useDrawer } from '../lib/DrawerContext';
import { useAuth } from '../lib/AuthContext';
import { useSalonSettings } from '../lib/hooks/useSalonSettings';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface NavItem {
  label:   string;
  icon:    React.ElementType;
  /** Root stack screen name */
  screen:  string;
  /** Optional nested tab screen */
  tab?:    string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Navigation items — mirrors the bottom tab structure in App.tsx
// ─────────────────────────────────────────────────────────────────────────────

const NAV_ITEMS: NavItem[] = [
  { label: 'Início',     icon: LayoutDashboard, screen: 'Main',      tab: 'Início'     },
  { label: 'Agenda',     icon: Calendar,        screen: 'Main',      tab: 'Agenda'     },
  { label: 'Clientes',   icon: Users,           screen: 'Main',      tab: 'Clientes'   },
  { label: 'Financeiro', icon: Wallet,          screen: 'Main',      tab: 'Financeiro' },
  { label: 'Fornecedores', icon: Truck,      screen: 'Main',              tab: 'Mais'              },
  { label: 'Lembretes',    icon: Bell,       screen: 'Reminders'                                   },
  { label: 'Serviços',     icon: Tag,        screen: 'ServiceCategories'                           },
  { label: 'Promoções',    icon: Megaphone,  screen: 'Promotions'                                  },
  { label: 'Horários',      icon: Clock,      screen: 'WorkingHours'                                },
  { label: 'Configurações', icon: Settings,   screen: 'SalonSettings'                               },
];

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function SideDrawer() {
  const { isOpen, close } = useDrawer();
  const { signOut } = useAuth();
  const { salonName } = useSalonSettings();

  function handleNavigate(item: NavItem) {
    close();
    if (!navigationRef.isReady()) return;

    if (item.tab) {
      // @ts-ignore — typed loosely to avoid per-screen boilerplate
      navigationRef.navigate(item.screen as never, { screen: item.tab } as never);
    } else {
      navigationRef.navigate(item.screen as never);
    }
  }

  return (
    <>
      {/* ── Backdrop ─────────────────────────────────────────────────────── */}
      <div
        aria-hidden={!isOpen}
        onClick={close}
        style={{
          position:       'fixed',
          inset:          0,
          zIndex:         998,
          backgroundColor: 'rgba(0,0,0,0.4)',
          opacity:         isOpen ? 1 : 0,
          pointerEvents:   isOpen ? 'auto' : 'none',
          transition:      'opacity 300ms',
        }}
      />

      {/* ── Drawer panel ─────────────────────────────────────────────────── */}
      <div
        role="navigation"
        aria-label="Menu principal"
        aria-hidden={!isOpen}
        style={{
          position:   'fixed',
          top:        0,
          left:       0,
          bottom:     0,
          width:      288,
          zIndex:     999,
          display:    'flex',
          flexDirection: 'column',
          backgroundColor: '#fef7fe',
          boxShadow:  '4px 0 24px rgba(53,49,58,0.14)',
          transform:  isOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 300ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* Header */}
        <div style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'flex-start',
          padding:        '28px 20px 16px',
        }}>
          <span style={{
            fontSize:   22,
            fontWeight: 700,
            color:      '#68597a',
            fontStyle:  'italic',
            letterSpacing: '-0.5px',
          }}>
            {salonName}
          </span>
        </div>

        {/* Divider */}
        <div style={{ height: 1, backgroundColor: '#e8e0ec', margin: '0 20px 12px' }} />

        {/* Nav items */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '4px 12px' }}>
          {NAV_ITEMS.map((item) => (
            <button
              key={item.label}
              onClick={() => handleNavigate(item)}
              style={{
                display:         'flex',
                alignItems:      'center',
                gap:             14,
                width:           '100%',
                padding:         '14px 12px',
                borderRadius:    12,
                border:          'none',
                cursor:          'pointer',
                backgroundColor: 'transparent',
                color:           '#625d67',
                fontSize:        16,
                fontWeight:      500,
                marginBottom:    4,
                transition:      'background-color 150ms',
              }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f0e9f5')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <item.icon size={22} color="#68597a" />
              {item.label}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div style={{
          padding:    '16px 20px',
          borderTop:  '1px solid #e8e0ec',
          display:    'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 12, color: '#b7afbb' }}>
            © 2026 {salonName}
          </span>
          <button
            onClick={() => { close(); signOut(); }}
            style={{
              fontSize: 12, color: '#ba1a1a', background: 'none',
              border: 'none', cursor: 'pointer', fontWeight: 600,
            }}
          >
            Sair
          </button>
        </div>
      </div>
    </>
  );
}
