import React from 'react';
import { usePromotions } from '../lib/hooks/usePromotions';
import { useSalonSettings } from '../lib/hooks/useSalonSettings';

export function ClientPromotions() {
  const { promotions, loading } = usePromotions();
  const { settings } = useSalonSettings();

  const active = promotions.filter(p => {
    if (!p.active) return false;
    if (p.valid_until && new Date(p.valid_until) < new Date()) return false;
    return true;
  });

  return (
    <div style={{ padding: '24px 20px' }}>
      <h2 style={{ color: '#68597a', fontStyle: 'italic', marginBottom: 4 }}>Promoções</h2>
      <p style={{ color: '#625d67', fontSize: 13, marginBottom: 24 }}>Ofertas exclusivas para você.</p>

      {loading ? (
        <p style={{ color: '#625d67', textAlign: 'center', padding: 40 }}>Carregando…</p>
      ) : active.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎀</div>
          <p style={{ color: '#625d67', fontSize: 14 }}>Nenhuma promoção ativa no momento.</p>
          <p style={{ color: '#b7afbb', fontSize: 12, marginTop: 4 }}>Volte em breve!</p>
        </div>
      ) : (
        active.map(promo => (
          <div key={promo.id} style={{
            backgroundColor: '#fff', borderRadius: 24, padding: 20, marginBottom: 16,
            boxShadow: '0 2px 16px rgba(104,89,122,0.08)',
          }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              {promo.discount_pct && (
                <span style={{
                  backgroundColor: '#e1cdf4', color: '#524362',
                  padding: '4px 12px', borderRadius: 50, fontSize: 12, fontWeight: 700,
                }}>
                  {promo.discount_pct}% OFF
                </span>
              )}
              <span style={{
                backgroundColor: '#d0fcfe', color: '#3a6264',
                padding: '4px 12px', borderRadius: 50, fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
              }}>
                Ativa
              </span>
            </div>
            <h3 style={{ color: '#35313a', fontSize: 17, fontWeight: 700, margin: '0 0 6px' }}>{promo.title}</h3>
            {promo.description && (
              <p style={{ color: '#625d67', fontSize: 13, margin: '0 0 8px', lineHeight: 1.5 }}>{promo.description}</p>
            )}
            {promo.valid_until && (
              <p style={{ color: '#b7afbb', fontSize: 11, margin: 0 }}>
                📅 Válida até {new Date(promo.valid_until).toLocaleDateString('pt-BR')}
              </p>
            )}
          </div>
        ))
      )}

      {settings?.whatsapp && (
        <a
          href={`https://wa.me/55${settings.whatsapp.replace(/\D/g, '')}?text=Oi! Vi as promoções e quero agendar!`}
          target="_blank" rel="noreferrer"
          style={{
            display: 'block', textAlign: 'center', padding: '16px',
            backgroundColor: '#25d366', color: '#fff', borderRadius: 50,
            fontWeight: 700, fontSize: 15, textDecoration: 'none', marginTop: 24,
          }}>
          💬 Falar no WhatsApp
        </a>
      )}
    </div>
  );
}
