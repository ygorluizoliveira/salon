import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Modal } from 'react-native';
import { Plus, X, Check, Tag, Percent, Calendar } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useNavigation } from '@react-navigation/native';
import { TopBar } from '../components/TopBar';
import { parseLocalDate } from '../lib/utils';
import { usePromotions, addPromotion, deletePromotion } from '../lib/hooks/usePromotions';

export const Promotions: React.FC = () => {
  const navigation = useNavigation();
  const { promotions, loading, refetch } = usePromotions();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', discount_pct: '', valid_until: '' });
  const [addError, setAddError] = useState<string | null>(null);
  const [addLoading, setAddLoading] = useState(false);

  function openAdd() {
    setForm({ title: '', description: '', discount_pct: '', valid_until: '' });
    setAddError(null);
    setShowAdd(true);
  }

  async function handleAdd() {
    if (!form.title.trim()) { setAddError('Informe o título da promoção.'); return; }
    let validUntil: string | null = null;
    if (form.valid_until) {
      const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(form.valid_until);
      const probe = m ? new Date(+m[3], +m[2] - 1, +m[1]) : null;
      if (!m || !probe || probe.getDate() !== +m[1] || probe.getMonth() !== +m[2] - 1) {
        setAddError('Data inválida. Use DD/MM/AAAA.'); return;
      }
      validUntil = `${m[3]}-${m[2]}-${m[1]}`;
    }
    setAddLoading(true);
    setAddError(null);
    try {
      await addPromotion({
        title:       form.title.trim(),
        description: form.description.trim() || null,
        discount_pct: form.discount_pct ? Number(form.discount_pct) : null,
        valid_until:  validUntil,
        active:       true,
      });
      setShowAdd(false);
      refetch();
    } catch (e: any) {
      setAddError(e.message ?? 'Erro ao salvar.');
    } finally {
      setAddLoading(false);
    }
  }

  async function handleDelete(id: string) {
    await deletePromotion(id);
    refetch();
  }

  async function handleToggle(id: string, active: boolean) {
    const { supabase } = await import('../lib/supabase');
    await supabase.from('promotions').update({ active: !active }).eq('id', id);
    refetch();
  }

  return (
    <View className="flex-1 bg-[#fef7fe]">
      <TopBar onBack={() => navigation.goBack()} title="Promoções" />

      <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 96, paddingBottom: 140 }}>
        <MotiView from={{ opacity: 0, translateY: 16 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 500 }}>

          <View className="mb-8">
            <Text className="text-3xl font-serif text-[#68597a] italic mb-1">Promoções</Text>
            <Text className="text-[#625d67] text-sm">Visíveis para seus clientes no app deles.</Text>
          </View>

          {loading ? (
            <Text className="text-[#625d67] text-center py-10">Carregando…</Text>
          ) : promotions.length === 0 ? (
            <View className="items-center py-16">
              <Tag size={48} color="#e8e0ec" />
              <Text className="text-[#625d67] mt-4 text-sm text-center">Nenhuma promoção cadastrada.</Text>
              <Text className="text-[#625d67] text-xs text-center mt-1">Crie uma promoção para aparecer no app dos clientes.</Text>
            </View>
          ) : (
            promotions.map((promo, i) => (
              <MotiView
                key={promo.id}
                from={{ opacity: 0, translateX: -12 }}
                animate={{ opacity: 1, translateX: 0 }}
                transition={{ type: 'timing', duration: 300, delay: i * 50 }}
                className="bg-white rounded-3xl p-5 mb-4"
                style={{ shadowColor: '#68597a', shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 2 } }}
              >
                <View className="flex-row items-start justify-between mb-2">
                  <View className="flex-1">
                    <View className="flex-row items-center mb-1" style={{ gap: 8 }}>
                      {promo.discount_pct && (
                        <View className="bg-[#e1cdf4] px-3 py-1 rounded-full">
                          <Text className="text-xs font-bold text-[#524362]">{promo.discount_pct}% OFF</Text>
                        </View>
                      )}
                      <View className={`px-3 py-1 rounded-full ${promo.active ? 'bg-[#d0fcfe]' : 'bg-[#f0e4f8]'}`}>
                        <Text className={`text-[11px] font-bold uppercase ${promo.active ? 'text-[#3a6264]' : 'text-[#625d67]'}`}>
                          {promo.active ? 'Ativa' : 'Inativa'}
                        </Text>
                      </View>
                    </View>
                    <Text className="text-base font-bold text-[#35313a]">{promo.title}</Text>
                    {promo.description && <Text className="text-xs text-[#625d67] mt-1">{promo.description}</Text>}
                    {promo.valid_until && (
                      <View className="flex-row items-center mt-2" style={{ gap: 4 }}>
                        <Calendar size={12} color="#625d67" />
                        <Text className="text-[11px] text-[#625d67]">
                          Válida até {parseLocalDate(promo.valid_until).toLocaleDateString('pt-BR')}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View className="flex-row" style={{ gap: 8 }}>
                    <TouchableOpacity
                      onPress={() => handleToggle(promo.id, promo.active)}
                      className={`w-9 h-9 rounded-full items-center justify-center ${promo.active ? 'bg-[#f0e4f8]' : 'bg-[#d0fcfe]'}`}>
                      <Check size={16} color={promo.active ? '#625d67' : '#3a6264'} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDelete(promo.id)}
                      className="w-9 h-9 rounded-full bg-[#ffedec] items-center justify-center">
                      <X size={16} color="#ba1a1a" />
                    </TouchableOpacity>
                  </View>
                </View>
              </MotiView>
            ))
          )}
        </MotiView>
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        onPress={openAdd}
        className="absolute bottom-8 right-6 bg-[#68597a] rounded-full flex-row items-center"
        style={{ paddingHorizontal: 24, paddingVertical: 16, gap: 8, shadowColor: '#68597a', shadowOpacity: 0.3, shadowRadius: 12 }}
      >
        <Plus size={20} color="#fff" />
        <Text className="text-white font-bold text-sm">Nova Promoção</Text>
      </TouchableOpacity>

      {/* Modal */}
      <Modal visible={showAdd} transparent animationType="slide" onRequestClose={() => setShowAdd(false)}>
        <View className="flex-1 justify-end" style={{ backgroundColor: '#00000050' }}>
          <View className="bg-[#fef7fe] rounded-t-[32px] p-7" style={{ paddingBottom: 48 }}>
            <View className="items-center mb-5">
              <View className="w-10 h-1 rounded-full bg-[#e8e0ec] mb-5" />
              <View className="flex-row justify-between items-center w-full">
                <Text className="text-xl font-bold text-[#35313a] italic font-serif">Nova Promoção</Text>
                <TouchableOpacity onPress={() => setShowAdd(false)}>
                  <X size={22} color="#625d67" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={{ gap: 12 }}>
              <View>
                <Text className="text-[11px] font-bold text-[#625d67] uppercase tracking-wider mb-2 ml-1">Título *</Text>
                <TextInput value={form.title} onChangeText={v => setForm(f => ({ ...f, title: v }))}
                  placeholder="Ex: 20% off em coloração" placeholderTextColor="#625d6766"
                  style={{ backgroundColor: '#f0e9f8', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#35313a' }} />
              </View>

              <View>
                <Text className="text-[11px] font-bold text-[#625d67] uppercase tracking-wider mb-2 ml-1">Descrição</Text>
                <TextInput value={form.description} onChangeText={v => setForm(f => ({ ...f, description: v }))}
                  placeholder="Detalhes da promoção…" placeholderTextColor="#625d6766" multiline
                  style={{ backgroundColor: '#f0e9f8', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#35313a', minHeight: 80 }} />
              </View>

              <View className="flex-row" style={{ gap: 10 }}>
                <View className="flex-1">
                  <Text className="text-[11px] font-bold text-[#625d67] uppercase tracking-wider mb-2 ml-1">Desconto (%)</Text>
                  <TextInput value={form.discount_pct} onChangeText={v => setForm(f => ({ ...f, discount_pct: v.replace(/\D/g, '') }))}
                    placeholder="20" placeholderTextColor="#625d6766" keyboardType="numeric"
                    style={{ backgroundColor: '#f0e9f8', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#35313a' }} />
                </View>
                <View className="flex-1">
                  <Text className="text-[11px] font-bold text-[#625d67] uppercase tracking-wider mb-2 ml-1">Válida até</Text>
                  <TextInput value={form.valid_until} onChangeText={v => {
                    const d = v.replace(/\D/g, '').slice(0, 8);
                    let m = d;
                    if (d.length > 2) m = `${d.slice(0,2)}/${d.slice(2)}`;
                    if (d.length > 4) m = `${d.slice(0,2)}/${d.slice(2,4)}/${d.slice(4)}`;
                    setForm(f => ({ ...f, valid_until: m }));
                  }}
                    placeholder="DD/MM/AAAA" placeholderTextColor="#625d6766" inputMode="numeric" maxLength={10}
                    style={{ backgroundColor: '#f0e9f8', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#35313a' }} />
                </View>
              </View>

              {addError && (
                <Text style={{ color: '#ba1a1a', backgroundColor: '#ffedec', borderRadius: 12, padding: 10, fontSize: 13, textAlign: 'center' }}>{addError}</Text>
              )}

              <TouchableOpacity onPress={handleAdd} disabled={addLoading}
                style={{ backgroundColor: addLoading ? '#68597a80' : '#68597a', borderRadius: 50, paddingVertical: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4 }}>
                <Check size={18} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>{addLoading ? 'Salvando…' : 'Criar Promoção'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};
