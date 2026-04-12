import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { Check, X, Store, Phone, Mail, MapPin, Instagram, MessageCircle } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useNavigation } from '@react-navigation/native';
import { TopBar } from '../components/TopBar';
import { useSalonSettings } from '../lib/hooks/useSalonSettings';

export const SalonSettings: React.FC = () => {
  const navigation = useNavigation();
  const { settings, loading, updateSettings } = useSalonSettings();

  const [form, setForm] = useState({
    salon_name: '',
    tagline: '',
    phone: '',
    email: '',
    address: '',
    instagram: '',
    whatsapp: '',
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (settings) {
      setForm({
        salon_name: settings.salon_name ?? '',
        tagline:    settings.tagline    ?? '',
        phone:      settings.phone      ?? '',
        email:      settings.email      ?? '',
        address:    settings.address    ?? '',
        instagram:  settings.instagram  ?? '',
        whatsapp:   settings.whatsapp   ?? '',
      });
    }
  }, [settings]);

  async function handleSave() {
    if (!form.salon_name.trim()) { setSaveError('Nome do salão é obrigatório.'); return; }
    setSaving(true);
    setSaveError(null);
    try {
      await updateSettings({
        salon_name: form.salon_name.trim(),
        tagline:    form.tagline.trim()   || null,
        phone:      form.phone.trim()     || null,
        email:      form.email.trim()     || null,
        address:    form.address.trim()   || null,
        instagram:  form.instagram.trim() || null,
        whatsapp:   form.whatsapp.trim()  || null,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err: any) {
      setSaveError(err.message ?? 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  }

  const fields: { key: keyof typeof form; label: string; placeholder: string; icon: React.ElementType; keyboard?: any }[] = [
    { key: 'salon_name', label: 'Nome do Salão *',     placeholder: 'Ex: Rose Coiffeur',         icon: Store },
    { key: 'tagline',    label: 'Slogan',               placeholder: 'Ex: Beleza que transforma', icon: Store },
    { key: 'phone',      label: 'Telefone',             placeholder: '(11) 99999-9999',           icon: Phone, keyboard: 'phone-pad' },
    { key: 'email',      label: 'E-mail',               placeholder: 'contato@salaobonito.com',   icon: Mail,  keyboard: 'email-address' },
    { key: 'address',    label: 'Endereço',             placeholder: 'Rua, número, bairro',       icon: MapPin },
    { key: 'instagram',  label: 'Instagram',            placeholder: '@salaobonito',              icon: Instagram },
    { key: 'whatsapp',   label: 'WhatsApp (com DDD)',   placeholder: '(11) 99999-9999',           icon: MessageCircle, keyboard: 'phone-pad' },
  ];

  return (
    <View className="flex-1 bg-[#fef7fe]">
      <TopBar onBack={() => navigation.goBack()} title="Configurações do Salão" />

      <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 96, paddingBottom: 60 }}>
        <MotiView from={{ opacity: 0, translateY: 16 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 500 }}>

          <View className="mb-8">
            <Text className="text-3xl font-serif text-[#68597a] italic mb-1">Seu Salão</Text>
            <Text className="text-[#625d67] text-sm">Informações exibidas no app e para seus clientes.</Text>
          </View>

          {loading ? (
            <Text className="text-[#625d67] text-center py-10">Carregando…</Text>
          ) : (
            <View className="bg-[#f0e9f8] rounded-[32px] p-6">
              {fields.map(f => (
                <View key={f.key} className="mb-4">
                  <Text className="text-[10px] font-bold text-[#625d67] mb-2 ml-1 uppercase tracking-wider">{f.label}</Text>
                  <View className="flex-row items-center bg-white rounded-2xl px-4">
                    <f.icon size={16} color="#68597a99" />
                    <TextInput
                      value={form[f.key]}
                      onChangeText={v => setForm(prev => ({ ...prev, [f.key]: v }))}
                      placeholder={f.placeholder}
                      placeholderTextColor="#625d6766"
                      keyboardType={f.keyboard ?? 'default'}
                      autoCapitalize={f.keyboard === 'email-address' ? 'none' : 'sentences'}
                      style={{ flex: 1, paddingVertical: 14, paddingHorizontal: 10, fontSize: 15, color: '#35313a' }}
                    />
                  </View>
                </View>
              ))}

              {saveError && (
                <Text className="text-[#ba1a1a] bg-[#ffedec] rounded-xl px-4 py-3 text-sm text-center mb-3">{saveError}</Text>
              )}

              {saved && (
                <Text className="text-[#3a6264] bg-[#d0fcfe] rounded-xl px-4 py-3 text-sm text-center font-bold mb-3">✓ Configurações salvas!</Text>
              )}

              <TouchableOpacity
                onPress={handleSave}
                disabled={saving}
                className={`flex-row items-center justify-center py-4 rounded-full mt-2 ${saving ? 'bg-[#68597a60]' : 'bg-[#68597a]'}`}
                style={{ gap: 8 }}
              >
                <Check size={18} color="#fff" />
                <Text className="text-white font-bold text-base">{saving ? 'Salvando…' : 'Salvar configurações'}</Text>
              </TouchableOpacity>
            </View>
          )}
        </MotiView>
      </ScrollView>
    </View>
  );
};
