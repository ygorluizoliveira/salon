import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { TrendingUp, ArrowDown, ArrowUp, Scissors, Package, User, Plus, X } from 'lucide-react-native';
import { MotiView } from 'moti';
import { TopBar } from '../components/TopBar';
import { useTransactions } from '../lib/hooks/useTransactions';
import type { Transaction } from '../lib/types';
import { todayLocalISO } from '../lib/utils';

const CATEGORY_COLORS: string[] = ['#68597a', '#e1cdf4', '#ffe088', '#d0fcfe'];

function formatBRL(value: number) {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function TransactionIcon({ category }: { category: string | null }) {
  if (category === 'Fornecedor') return <Package size={20} color="#68597a" />;
  if (category === 'Serviço')   return <Scissors size={20} color="#68597a" />;
  return <User size={20} color="#68597a" />;
}

export const Finance: React.FC = () => {
  const { transactions, stats, loading, addTransaction } = useTransactions();
  const [formOpen, setFormOpen] = useState(false);
  const [fType, setFType]       = useState<'income' | 'expense'>('income');
  const [fTitle, setFTitle]     = useState('');
  const [fAmount, setFAmount]   = useState('');
  const [fCategory, setFCategory] = useState('');
  const [fDate, setFDate]       = useState(todayLocalISO());
  const [saving, setSaving]     = useState(false);

  function openForm() { setFormOpen(true); }
  function closeForm() { setFormOpen(false); setFTitle(''); setFAmount(''); setFCategory(''); setFType('income'); setFDate(todayLocalISO()); }

  async function handleSave() {
    if (!fTitle.trim()) { Alert.alert('Campo obrigatório', 'Informe o título.'); return; }
    const amount = parseFloat(fAmount.replace(',', '.'));
    if (isNaN(amount) || amount <= 0) { Alert.alert('Valor inválido', 'Informe um valor numérico positivo.'); return; }
    setSaving(true);
    try {
      await addTransaction({
        type: fType,
        title: fTitle.trim(),
        subtitle: null,
        amount,
        category: fCategory.trim() || null,
        occurred_at: new Date(fDate + 'T12:00:00').toISOString(),
      });
      closeForm();
    } catch (err: any) {
      Alert.alert('Erro', err.message ?? 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  // Group income transactions by category for the bar chart
  const categoryTotals = transactions
    .filter((t: Transaction) => t.type === 'income')
    .reduce((acc: Record<string, number>, t: Transaction) => {
      const key = t.category ?? 'Outros';
      acc[key] = (acc[key] ?? 0) + t.amount;
      return acc;
    }, {});

  const maxCategoryTotal = Math.max(...Object.values(categoryTotals), 1);

  const categories = Object.entries(categoryTotals).map(([name, total], idx) => ({
    name,
    total,
    percentage: Math.round((total / maxCategoryTotal) * 100),
    color: CATEGORY_COLORS[idx % CATEGORY_COLORS.length],
  }));

  return (
    <View className="flex-1 bg-[#fef7fe]">
      <TopBar title="Financeiro" />
      <ScrollView className="flex-1 px-6 pt-24 pb-32">
        <MotiView
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ type: 'timing', duration: 700 }}
        >
          {/* ── Monthly revenue card ────────────────────────────────────── */}
          <View className="mb-10">
            <View className="bg-[#68597a] p-8 rounded-[32px] shadow-xl min-h-[220px] justify-between">
              <View>
                <View className="flex-row items-center justify-between">
                  <Text className="text-[10px] opacity-80 uppercase tracking-widest font-bold text-white">
                    Faturamento Mensal
                  </Text>
                  <View className="bg-white/20 px-3 py-1 rounded-full">
                    <Text className="text-white text-[10px] font-bold">
                      {loading ? '…' : `${stats.monthlyGrowthPct >= 0 ? '+' : ''}${stats.monthlyGrowthPct}%`}
                    </Text>
                  </View>
                </View>
                <Text className="font-serif text-4xl mt-6 font-bold tracking-tight italic text-white">
                  {loading ? '—' : `R$ ${formatBRL(stats.monthlyRevenue)}`}
                </Text>
              </View>
              <View className="flex-row items-center gap-2 mt-4 opacity-70">
                <TrendingUp size={14} color="#fff" />
                <Text className="text-white text-xs">vs. mês anterior</Text>
              </View>
            </View>

            {/* Income / Expense mini cards */}
            <View className="flex-row gap-4 mt-6">
              <View className="flex-1 p-6 rounded-3xl bg-[#e8e0ec] flex-row items-center justify-between">
                <View>
                  <Text className="text-[8px] font-bold text-[#625d67] mb-1 uppercase tracking-wider">Entradas</Text>
                  <Text className="text-base font-bold text-[#3a6264]">
                    {loading ? '—' : `R$ ${formatBRL(stats.totalIncome)}`}
                  </Text>
                </View>
                <View className="w-8 h-8 rounded-full bg-[#d0fcfe] items-center justify-center">
                  <ArrowDown size={16} color="#3a6264" />
                </View>
              </View>

              <View className="flex-1 p-6 rounded-3xl bg-[#e8e0ec] flex-row items-center justify-between">
                <View>
                  <Text className="text-[8px] font-bold text-[#625d67] mb-1 uppercase tracking-wider">Saídas</Text>
                  <Text className="text-base font-bold text-[#ba1a1a]">
                    {loading ? '—' : `R$ ${formatBRL(stats.totalExpense)}`}
                  </Text>
                </View>
                <View className="w-8 h-8 rounded-full bg-[#ffdad6] items-center justify-center">
                  <ArrowUp size={16} color="#ba1a1a" />
                </View>
              </View>
            </View>
          </View>

          {/* ── Category breakdown ──────────────────────────────────────── */}
          <View className="mb-10">
            <View className="bg-[#f9f1fa] rounded-[32px] p-8 mb-8">
              <Text className="font-serif text-xl font-bold mb-8 text-[#68597a] italic">Receita por Categoria</Text>
              {loading && <Text className="text-[#625d67] text-sm">Carregando…</Text>}
              {!loading && categories.length === 0 && (
                <Text className="text-[#625d67] text-sm">Nenhuma receita registrada este mês.</Text>
              )}
              {categories.map((cat) => (
                <View key={cat.name} className="mb-6">
                  <View className="flex-row justify-between mb-2">
                    <Text className="text-xs font-bold text-[#625d67]">{cat.name}</Text>
                    <Text className="text-xs font-bold text-[#68597a]">R$ {formatBRL(cat.total)}</Text>
                  </View>
                  <View className="w-full bg-[#b7afbb26] h-2 rounded-full overflow-hidden">
                    <View
                      className="h-full rounded-full"
                      style={{ width: `${cat.percentage}%`, backgroundColor: cat.color }}
                    />
                  </View>
                </View>
              ))}
            </View>

            {/* ── Transactions list ──────────────────────────────────────── */}
            <View className="bg-[#f9f1fa] rounded-[32px] p-8">
              <View className="flex-row justify-between items-center mb-8">
                <Text className="font-serif text-xl font-bold text-[#68597a] italic">Transações</Text>
                <TouchableOpacity>
                  <Text className="text-[#68597a] text-[10px] font-bold uppercase tracking-widest">Ver Tudo</Text>
                </TouchableOpacity>
              </View>
              {loading && <Text className="text-[#625d67] text-sm">Carregando…</Text>}
              {!loading && transactions.length === 0 && (
                <Text className="text-[#625d67] text-sm">Nenhuma transação este mês.</Text>
              )}
              {transactions.map((t: Transaction) => (
                <View key={t.id} className="flex-row items-center gap-4 mb-6">
                  <View className="w-12 h-12 rounded-2xl bg-[#e8e0ec] items-center justify-center">
                    <TransactionIcon category={t.category} />
                  </View>
                  <View className="flex-1">
                    <Text className="font-bold text-sm text-[#35313a]">{t.title}</Text>
                    <Text className="text-[10px] text-[#625d67]">{t.subtitle}</Text>
                  </View>
                  <View className="items-end">
                    <Text className={`font-bold text-sm ${t.type === 'income' ? 'text-[#3a6264]' : 'text-[#ba1a1a]'}`}>
                      {t.type === 'income' ? '+ ' : '- '}R$ {formatBRL(t.amount)}
                    </Text>
                    <Text className="text-[8px] text-[#625d67] uppercase font-bold">
                      {new Date(t.occurred_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          <View className="w-full h-48 rounded-[40px] overflow-hidden relative mb-20">
            <img
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuBHVhhTwCJjSm5wxWu_B0SH8tuE0tFscQMVDLlSXJOJrCssMfJrw5lIc39z5m5goA4_Yboa_qsXo3HDFg-lzFOuMWC_zEkM2xROUlwGWm-ZggyICF77v0XpnXRm7-RKTsJWESgryD3HfqZLA25__vOzLdaiFouzUKTGQEMVe-TrPfJ4q4rowrx6w5gBgdvhjc_V-t74Q1wjaOsZnJWtuI-ZJLamSfYfpc7okJ3RTIO068nnTZeGnt-eqB2k4OlkyUFbQR_P-gdN-8Wx"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <View className="absolute inset-0 bg-black/40 flex-col justify-end p-8">
              <Text className="text-white font-serif text-2xl font-bold italic">Curadoria de Excelência</Text>
              <Text className="text-white/80 text-xs mt-2">Gerencie seu império da beleza com a precisão que sua arte merece.</Text>
            </View>
          </View>
        </MotiView>
      </ScrollView>

      {/* ── Floating action button ─────────────────────────────────────── */}
      <TouchableOpacity
        onPress={openForm}
        className="absolute bottom-10 right-6 w-14 h-14 bg-[#ffe088] rounded-full shadow-lg items-center justify-center"
        style={{ zIndex: 50 }}
      >
        <Plus size={24} color="#644f00" />
      </TouchableOpacity>

      {/* ── Add transaction form ───────────────────────────────────────── */}
      {formOpen && (
        <View style={{ position: 'absolute', inset: 0, zIndex: 100, backgroundColor: 'rgba(53,49,58,0.5)' }}
          className="items-center justify-end"
        >
          <View className="w-full bg-[#fef7fe] rounded-t-[32px] p-8">
            <View className="flex-row items-center justify-between mb-6">
              <Text className="font-serif text-xl text-[#68597a] italic">Nova Transação</Text>
              <TouchableOpacity onPress={closeForm}><X size={20} color="#68597a" /></TouchableOpacity>
            </View>

            {/* Tipo */}
            <View className="flex-row bg-[#e8e0ec] rounded-2xl p-1 mb-5">
              {(['income', 'expense'] as const).map(t => (
                <TouchableOpacity
                  key={t}
                  onPress={() => setFType(t)}
                  className={`flex-1 py-3 rounded-xl items-center ${fType === t ? 'bg-[#68597a]' : ''}`}
                >
                  <Text className={`text-xs font-bold ${fType === t ? 'text-white' : 'text-[#625d67]'}`}>
                    {t === 'income' ? 'Entrada' : 'Saída'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text className="text-[10px] font-bold text-[#625d67] mb-2 uppercase tracking-wider">Título *</Text>
            <TextInput
              value={fTitle}
              onChangeText={setFTitle}
              placeholder="Ex: Coloração - Maria"
              placeholderTextColor="#625d6766"
              className="bg-[#e8e0ec] rounded-2xl px-4 py-4 text-[#35313a] mb-4"
            />

            <View className="flex-row gap-3 mb-4">
              <View className="flex-1">
                <Text className="text-[10px] font-bold text-[#625d67] mb-2 uppercase tracking-wider">Valor (R$) *</Text>
                <TextInput
                  value={fAmount}
                  onChangeText={setFAmount}
                  placeholder="0,00"
                  placeholderTextColor="#625d6766"
                  keyboardType="decimal-pad"
                  className="bg-[#e8e0ec] rounded-2xl px-4 py-4 text-[#35313a]"
                />
              </View>
              <View className="flex-1">
                <Text className="text-[10px] font-bold text-[#625d67] mb-2 uppercase tracking-wider">Data</Text>
                <input
                  type="date"
                  value={fDate}
                  onChange={(e: any) => setFDate(e.target.value)}
                  style={{
                    background: '#e8e0ec', borderRadius: 16, padding: '14px 16px',
                    color: '#35313a', border: 'none', width: '100%',
                    fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box',
                  }}
                />
              </View>
            </View>

            <Text className="text-[10px] font-bold text-[#625d67] mb-2 uppercase tracking-wider">Categoria</Text>
            <TextInput
              value={fCategory}
              onChangeText={setFCategory}
              placeholder="Ex: Serviço, Fornecedor…"
              placeholderTextColor="#625d6766"
              className="bg-[#e8e0ec] rounded-2xl px-4 py-4 text-[#35313a] mb-6"
            />

            <TouchableOpacity
              onPress={handleSave}
              disabled={saving}
              className={`py-5 rounded-full ${saving ? 'bg-[#68597a80]' : 'bg-[#68597a]'}`}
            >
              <Text className="text-white text-center font-bold">{
                saving ? 'Salvando…' : 'Salvar'
              }</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};
