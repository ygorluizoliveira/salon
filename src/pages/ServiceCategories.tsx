import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { Tag, Clock, DollarSign, Trash2, Pencil, Check, X, Flower2 } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useNavigation } from '@react-navigation/native';
import { TopBar } from '../components/TopBar';
import { useServiceCategories } from '../lib/hooks/useServiceCategories';
import type { ServiceCategory } from '../lib/types';

// ── helpers ──────────────────────────────────────────────────────────────────

function formatBRL(value: number) {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── sub-components ───────────────────────────────────────────────────────────

interface CategoryCardProps {
  item: ServiceCategory;
  onToggle: () => void;
  onDelete: () => void;
  onEdit: () => void;
}

function CategoryCard({ item, onToggle, onDelete, onEdit }: CategoryCardProps) {
  const isActive = item.status === 'active';
  return (
    <View className="bg-[#e8e0ec] rounded-3xl p-6 mb-4">
      <View className="flex-row items-start justify-between mb-2">
        <View className="flex-row items-center gap-2 flex-1">
          <View className="w-8 h-8 bg-[#f9f1fa] rounded-xl items-center justify-center">
            <Tag size={14} color="#68597a" />
          </View>
          <Text className="font-bold text-[#35313a] text-base flex-1">{item.name}</Text>
        </View>
        <View className="flex-row gap-2">
          <TouchableOpacity onPress={onEdit} className="p-2">
            <Pencil size={16} color="#68597a" />
          </TouchableOpacity>
          <TouchableOpacity onPress={onDelete} className="p-2">
            <Trash2 size={16} color="#ba1a1a66" />
          </TouchableOpacity>
        </View>
      </View>

      {item.description ? (
        <Text className="text-xs text-[#625d67] mb-3 ml-10">{item.description}</Text>
      ) : null}

      <View className="flex-row items-center gap-4 ml-10">
        {item.duration_min != null && (
          <View className="flex-row items-center gap-1">
            <Clock size={12} color="#625d67" />
            <Text className="text-[11px] text-[#625d67]">{item.duration_min} min</Text>
          </View>
        )}
        {item.price != null && (
          <View className="flex-row items-center gap-1">
            <DollarSign size={12} color="#625d67" />
            <Text className="text-[11px] text-[#625d67]">R$ {formatBRL(item.price)}</Text>
          </View>
        )}
        <TouchableOpacity
          onPress={onToggle}
          className={`flex-row items-center gap-1 px-3 py-1 rounded-full ml-auto ${isActive ? 'bg-[#d0fcfe]' : 'bg-[#ffdad6]'}`}
        >
          {isActive
            ? <Check size={10} color="#3a6264" />
            : <X size={10} color="#ba1a1a" />}
          <Text className={`text-[11px] font-bold uppercase ${isActive ? 'text-[#3a6264]' : 'text-[#ba1a1a]'}`}>
            {isActive ? 'Ativo' : 'Inativo'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── blank form state ──────────────────────────────────────────────────────────

const BLANK = {
  name: '',
  description: '',
  duration_min: '',
  price: '',
};

// ── main page ────────────────────────────────────────────────────────────────

export const ServiceCategories: React.FC = () => {
  const navigation = useNavigation();
  const { categories, loading, addCategory, updateCategory, removeCategory } = useServiceCategories();

  const [form, setForm]         = useState(BLANK);
  const [editId, setEditId]     = useState<string | null>(null);
  const [saving, setSaving]     = useState(false);
  const [showForm, setShowForm] = useState(false);

  function openNew() {
    setEditId(null);
    setForm(BLANK);
    setShowForm(true);
  }

  function openEdit(cat: ServiceCategory) {
    setEditId(cat.id);
    setForm({
      name:         cat.name,
      description:  cat.description ?? '',
      duration_min: cat.duration_min != null ? String(cat.duration_min) : '',
      price:        cat.price        != null ? String(cat.price)        : '',
    });
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditId(null);
    setForm(BLANK);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      Alert.alert('Campo obrigatório', 'O nome da categoria é obrigatório.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name:         form.name.trim(),
        description:  form.description.trim() || null,
        duration_min: form.duration_min ? Number(form.duration_min) : null,
        price:        form.price        ? Number(form.price.replace(',', '.')) : null,
        status:       'active' as const,
      };

      if (editId) {
        await updateCategory(editId, payload);
      } else {
        await addCategory(payload);
      }
      cancelForm();
    } catch (err: any) {
      Alert.alert('Erro', err.message ?? 'Erro ao salvar categoria.');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(cat: ServiceCategory) {
    try {
      await updateCategory(cat.id, { status: cat.status === 'active' ? 'inactive' : 'active' });
    } catch (err: any) {
      Alert.alert('Erro', err.message);
    }
  }

  async function handleDelete(cat: ServiceCategory) {
    Alert.alert(
      'Remover categoria',
      `Deseja remover "${cat.name}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover', style: 'destructive',
          onPress: async () => {
            try { await removeCategory(cat.id); }
            catch (err: any) { Alert.alert('Erro', err.message); }
          },
        },
      ]
    );
  }

  return (
    <View className="flex-1 bg-[#fef7fe]">
      <TopBar onBack={() => navigation.goBack()} title="Categorias de Serviço" />

      <ScrollView className="flex-1 px-6 pt-24 pb-32">
        <MotiView
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ type: 'timing', duration: 700 }}
        >
          {/* ── Header ──────────────────────────────────────────────────── */}
          <View className="mb-10">
            <Text className="text-[#68597a] font-bold tracking-[0.2em] uppercase text-[11px]">Configuração</Text>
            <Text className="text-4xl font-serif mt-2 mb-4 leading-tight text-[#68597a] italic">Categorias</Text>
            <Text className="text-[#625d67] text-sm">
              Defina os serviços que seu salão oferece — nome, duração e preço padrão.
            </Text>
          </View>

          {/* ── Add / Edit form ─────────────────────────────────────────── */}
          {!showForm ? (
            <TouchableOpacity
              onPress={openNew}
              className="flex-row items-center justify-center gap-2 bg-[#68597a] py-4 rounded-full mb-8 shadow-lg shadow-[#68597a4d]"
            >
              <Tag size={16} color="#fff" />
              <Text className="text-white font-bold">Nova Categoria</Text>
            </TouchableOpacity>
          ) : (
            <MotiView
              from={{ opacity: 0, translateY: -8 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 300 }}
              className="bg-[#e8e0ec] rounded-[32px] p-8 mb-8 shadow-sm"
            >
              <Text className="text-xl font-serif text-[#68597a] italic mb-6">
                {editId ? 'Editar Categoria' : 'Nova Categoria'}
              </Text>

              {/* Name */}
              <View className="mb-5">
                <Text className="text-[11px] font-bold text-[#625d67] mb-2 ml-1 uppercase tracking-wider">Nome *</Text>
                <TextInput
                  value={form.name}
                  onChangeText={v => setForm(f => ({ ...f, name: v }))}
                  placeholder="Ex: Coloração, Corte, Tratamento…"
                  placeholderTextColor="#625d6766"
                  className="bg-[#f9f1fa] rounded-2xl px-4 py-4 text-[#35313a]"
                />
              </View>

              {/* Description */}
              <View className="mb-5">
                <Text className="text-[11px] font-bold text-[#625d67] mb-2 ml-1 uppercase tracking-wider">Descrição</Text>
                <TextInput
                  value={form.description}
                  onChangeText={v => setForm(f => ({ ...f, description: v }))}
                  placeholder="Breve descrição do serviço (opcional)"
                  placeholderTextColor="#625d6766"
                  className="bg-[#f9f1fa] rounded-2xl px-4 py-4 text-[#35313a]"
                  multiline
                  numberOfLines={2}
                />
              </View>

              {/* Duration + Price */}
              <View className="flex-row gap-4 mb-6">
                <View className="flex-1">
                  <Text className="text-[11px] font-bold text-[#625d67] mb-2 ml-1 uppercase tracking-wider">Duração (min)</Text>
                  <TextInput
                    value={form.duration_min}
                    onChangeText={v => setForm(f => ({ ...f, duration_min: v.replace(/[^0-9]/g, '') }))}
                    placeholder="60"
                    placeholderTextColor="#625d6766"
                    keyboardType="numeric"
                    className="bg-[#f9f1fa] rounded-2xl px-4 py-4 text-[#35313a]"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-[11px] font-bold text-[#625d67] mb-2 ml-1 uppercase tracking-wider">Preço (R$)</Text>
                  <TextInput
                    value={form.price}
                    onChangeText={v => setForm(f => ({ ...f, price: v.replace(/[^0-9,\.]/g, '') }))}
                    placeholder="150,00"
                    placeholderTextColor="#625d6766"
                    keyboardType="decimal-pad"
                    className="bg-[#f9f1fa] rounded-2xl px-4 py-4 text-[#35313a]"
                  />
                </View>
              </View>

              {/* Actions */}
              <View className="flex-row gap-3">
                <TouchableOpacity
                  onPress={cancelForm}
                  className="flex-1 py-4 rounded-full border border-[#68597a4d] items-center"
                >
                  <Text className="text-[#68597a] font-bold">Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSave}
                  disabled={saving}
                  className={`flex-1 py-4 rounded-full items-center shadow-lg shadow-[#68597a4d] ${saving ? 'bg-[#68597a80]' : 'bg-[#68597a]'}`}
                >
                  <Text className="text-white font-bold">{saving ? 'Salvando…' : 'Salvar'}</Text>
                </TouchableOpacity>
              </View>
            </MotiView>
          )}

          {/* ── Categories list ─────────────────────────────────────────── */}
          <View className="mb-8">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="font-serif text-xl text-[#68597a] italic">
                {categories.length === 0 ? 'Nenhuma categoria' : `${categories.length} ${categories.length === 1 ? 'categoria' : 'categorias'}`}
              </Text>
              {categories.filter(c => c.status === 'active').length > 0 && (
                <View className="bg-[#d0fcfe] px-3 py-1 rounded-full">
                  <Text className="text-[11px] font-bold text-[#3a6264]">
                    {categories.filter(c => c.status === 'active').length} ativas
                  </Text>
                </View>
              )}
            </View>

            {loading && (
              <Text className="text-[#625d67] text-sm text-center py-8">Carregando…</Text>
            )}

            {!loading && categories.length === 0 && (
              <View className="items-center py-12">
                <View className="w-16 h-16 bg-[#e8e0ec] rounded-full items-center justify-center mb-4">
                  <Tag size={28} color="#68597a" />
                </View>
                <Text className="text-[#625d67] font-serif italic text-center">
                  Ainda sem categorias cadastradas.{'\n'}Adicione a primeira acima!
                </Text>
              </View>
            )}

            {categories.map(cat => (
              <CategoryCard
                key={cat.id}
                item={cat}
                onToggle={() => handleToggle(cat)}
                onDelete={() => handleDelete(cat)}
                onEdit={() => openEdit(cat)}
              />
            ))}
          </View>

          {/* ── Decorative footer ────────────────────────────────────────── */}
          <View className="p-10 border border-[#b7afbb26] rounded-[32px] items-center justify-center mb-20">
            <View className="w-16 h-16 bg-[#e8e0ec] rounded-full items-center justify-center mb-4">
              <Flower2 size={32} color="#68597a" />
            </View>
            <Text className="font-serif italic text-[#625d67] text-center">
              Cada serviço é uma obra de arte.
            </Text>
          </View>
        </MotiView>
      </ScrollView>
    </View>
  );
};
