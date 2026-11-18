import React, { useState } from 'react';
import { maskPhone, isValidPhone, PHONE_ERROR, maskCnpj, maskCpf, isValidCnpj, isValidCpf, isValidEmail } from '../lib/utils';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { Building2, PlusCircle, Trash2, Verified, Flower2, Package, ChevronDown, ChevronUp } from 'lucide-react-native';
import { MotiView } from 'moti';
import { TopBar } from '../components/TopBar';
import { useSuppliers } from '../lib/hooks/useSuppliers';
import { useSupplierProducts } from '../lib/hooks/useSupplierProducts';
import type { SupplierCategory, SupplierProductCategory } from '../lib/types';

const CATEGORIES: SupplierCategory[] = ['Coloração', 'Cuidados', 'Equipamentos', 'Outros'];
const PRODUCT_CATEGORIES: SupplierProductCategory[] = ['Coloração', 'Cuidados', 'Equipamentos', 'Higiene', 'Outros'];

const LABEL = 'text-[11px] font-bold text-[#625d67] mb-2 ml-1 uppercase tracking-wider';
const INPUT = 'w-full h-14 bg-[#f9f1fa] border border-[#b7afbb66] rounded-2xl px-4 text-base text-[#35313a]';
const INPUT_ERR = 'w-full h-14 bg-[#f9f1fa] border border-[#ba1a1a] rounded-2xl px-4 text-base text-[#35313a]';
const ERR = 'text-xs text-[#ba1a1a] mt-1 ml-1';

function formatDateBR(iso: string) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function SupplierProductsSection({ supplierId }: { supplierId: string }) {
  const { products, loading, addProduct, removeProduct } = useSupplierProducts(supplierId);
  const [showForm, setShowForm] = useState(false);
  const [pName, setPName]           = useState('');
  const [pPrice, setPPrice]         = useState('');
  const [pDate, setPDate]           = useState('');
  const [pCategory, setPCategory]   = useState<SupplierProductCategory>('Coloração');
  const [saving, setSaving]         = useState(false);

  async function handleAdd() {
    if (!pName.trim()) {
      Alert.alert('Campo obrigatório', 'Informe o nome do produto.');
      return;
    }
    setSaving(true);
    try {
      const price = pPrice ? parseFloat(pPrice.replace(',', '.')) : null;
      await addProduct({
        name: pName.trim(),
        price,
        purchase_date: pDate || null,
        category: pCategory,
      });
      setPName(''); setPPrice(''); setPDate(''); setPCategory('Coloração');
      setShowForm(false);
    } catch (err: any) {
      Alert.alert('Erro', err.message ?? 'Erro ao salvar produto.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View className="mt-4 pt-4 border-t border-[#68597a26]">
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center gap-2">
          <Package size={14} color="#68597a" />
          <Text className="text-xs font-bold text-[#68597a] uppercase tracking-wider">Produtos</Text>
        </View>
        <TouchableOpacity
          onPress={() => setShowForm(v => !v)}
          className="flex-row items-center gap-1 px-3 py-1 bg-[#68597a] rounded-full"
        >
          <PlusCircle size={11} color="white" />
          <Text className="text-white text-[11px] font-bold">Adicionar</Text>
        </TouchableOpacity>
      </View>

      {showForm && (
        <View className="bg-[#f9f1fa] rounded-2xl p-4 mb-4">
          <Text className="text-[11px] font-bold text-[#625d67] mb-2 uppercase tracking-wider">Nome do Produto *</Text>
          <TextInput
            value={pName}
            onChangeText={setPName}
            placeholder="Ex: Tintura Louro Escuro"
            placeholderTextColor="#625d6766"
            className="bg-white rounded-xl px-3 py-3 text-[#35313a] text-sm mb-3"
          />

          <View className="flex-row gap-3 mb-3">
            <View className="flex-1">
              <Text className="text-[11px] font-bold text-[#625d67] mb-2 uppercase tracking-wider">Valor (R$)</Text>
              <TextInput
                value={pPrice}
                onChangeText={setPPrice}
                placeholder="0,00"
                placeholderTextColor="#625d6766"
                keyboardType="decimal-pad"
                className="bg-white rounded-xl px-3 py-3 text-[#35313a] text-sm"
              />
            </View>
            <View className="flex-1">
              <Text className="text-[11px] font-bold text-[#625d67] mb-2 uppercase tracking-wider">Data de Compra</Text>
              <input
                type="date"
                value={pDate}
                onChange={(e: any) => setPDate(e.target.value)}
                style={{
                  background: 'white', borderRadius: 12, padding: '12px',
                  color: '#35313a', border: 'none', width: '100%',
                  fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box',
                }}
              />
            </View>
          </View>

          <Text className="text-[11px] font-bold text-[#625d67] mb-2 uppercase tracking-wider">Categoria</Text>
          <View className="flex-row flex-wrap gap-2 mb-4">
            {PRODUCT_CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat}
                onPress={() => setPCategory(cat)}
                className={`px-3 py-2 rounded-xl ${pCategory === cat ? 'bg-[#68597a]' : 'bg-white'}`}
              >
                <Text className={`text-[11px] font-bold ${pCategory === cat ? 'text-white' : 'text-[#625d67]'}`}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={() => setShowForm(false)}
              className="flex-1 py-3 rounded-full border border-[#68597a4d] items-center"
            >
              <Text className="text-[#68597a] text-xs font-bold">Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleAdd}
              disabled={saving}
              className={`flex-1 py-3 rounded-full items-center ${saving ? 'bg-[#68597a80]' : 'bg-[#68597a]'}`}
            >
              <Text className="text-white text-xs font-bold">{saving ? 'Salvando…' : 'Salvar Produto'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {loading && <Text className="text-[11px] text-[#625d67] italic mb-2">Carregando…</Text>}

      {!loading && products.length === 0 && !showForm && (
        <Text className="text-[11px] text-[#625d67] italic mb-2">Nenhum produto cadastrado.</Text>
      )}

      {products.map(p => (
        <View key={p.id} className="flex-row items-center gap-3 mb-3">
          <View className="w-8 h-8 rounded-xl bg-[#e8e0ec] items-center justify-center">
            <Package size={14} color="#68597a" />
          </View>
          <View className="flex-1">
            <Text className="text-sm font-semibold text-[#35313a]">{p.name}</Text>
            <Text className="text-[11px] text-[#625d67]">
              {[
                p.category,
                p.price != null ? `R$ ${p.price.toFixed(2).replace('.', ',')}` : null,
                p.purchase_date ? formatDateBR(p.purchase_date) : null,
              ].filter(Boolean).join(' · ')}
            </Text>
          </View>
          <TouchableOpacity onPress={() => removeProduct(p.id)} className="p-1">
            <Trash2 size={14} color="#ba1a1a66" />
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

export const NewSupplier: React.FC = () => {
  const { suppliers, loading, addSupplier, removeSupplier } = useSuppliers();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [companyName, setCompanyName] = useState('');
  const [docType, setDocType]         = useState<'cnpj' | 'cpf'>('cnpj');
  const [cnpj, setCnpj]               = useState('');
  const [category, setCategory]       = useState<SupplierCategory>('Coloração');
  const [email, setEmail]             = useState('');
  const [phone, setPhone]             = useState('');
  const [saving, setSaving]           = useState(false);

  const [errors, setErrors] = useState<{ name?: string; doc?: string; email?: string; phone?: string }>({});

  async function handleSave() {
    const errs: typeof errors = {};
    if (!companyName.trim()) errs.name = 'Informe o nome da empresa.';
    if (cnpj.trim()) {
      const ok = docType === 'cnpj' ? isValidCnpj(cnpj) : isValidCpf(cnpj);
      if (!ok) errs.doc = docType === 'cnpj' ? 'CNPJ inválido.' : 'CPF inválido.';
    }
    if (email.trim() && !isValidEmail(email)) errs.email = 'E-mail inválido.';
    if (phone.trim() && !isValidPhone(phone)) errs.phone = PHONE_ERROR;
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      await addSupplier({
        company_name: companyName.trim(),
        cnpj: cnpj.trim() || null,
        category,
        email: email.trim() || null,
        phone: phone.trim() || null,
      });
      setCompanyName(''); setCnpj(''); setEmail(''); setPhone(''); setCategory('Coloração');
    } catch (err: any) {
      Alert.alert('Erro', err.message ?? 'Erro ao salvar fornecedor.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View className="flex-1 bg-[#fef7fe]">
      <TopBar title="Fornecedores" />
      <ScrollView className="flex-1 px-6 pt-24 pb-32">
        <MotiView
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ type: 'timing', duration: 700 }}
        >
          <View className="mb-10">
            <Text className="text-[#68597a] font-bold tracking-[0.2em] uppercase text-[11px]">Administração</Text>
            <Text className="text-4xl font-serif mt-2 mb-4 leading-tight text-[#68597a] italic">Novo Fornecedor</Text>
            <Text className="text-[#625d67]">Gerencie suas parcerias com a elegância que seu salão boutique merece.</Text>
          </View>

          {/* ── Form ────────────────────────────────────────────────────── */}
          <View className="bg-[#e8e0ec] rounded-[32px] p-5 md:p-8 mb-8 shadow-sm w-full">
            <View className="flex-row items-center gap-2 mb-5">
              <View className="w-8 h-[1px] bg-[#68597a4d]" />
              <Text className="text-xl font-serif text-[#68597a] italic">Identificação</Text>
            </View>

            <View className="mb-5">
              <Text className={LABEL}>Nome da Empresa *</Text>
              <TextInput
                value={companyName}
                onChangeText={v => { setCompanyName(v); setErrors(e => ({ ...e, name: undefined })); }}
                placeholder="Ex: L'Oréal Professionnel"
                placeholderTextColor="#625d6780"
                className={errors.name ? INPUT_ERR : INPUT}
              />
              {errors.name && <Text className={ERR}>{errors.name}</Text>}
            </View>

            <View className="mb-5">
              <Text className={LABEL}>Documento</Text>
              <View className="flex-row bg-[#f9f1fa] rounded-2xl p-1 mb-3 border border-[#b7afbb66]">
                {(['cnpj', 'cpf'] as const).map(t => (
                  <TouchableOpacity
                    key={t}
                    onPress={() => { setDocType(t); setCnpj(''); setErrors(e => ({ ...e, doc: undefined })); }}
                    className={`flex-1 h-10 rounded-xl items-center justify-center ${docType === t ? 'bg-[#68597a]' : ''}`}
                  >
                    <Text className={`text-xs font-bold uppercase ${docType === t ? 'text-white' : 'text-[#625d67]'}`}>{t.toUpperCase()}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                value={cnpj}
                onChangeText={v => { setCnpj(docType === 'cnpj' ? maskCnpj(v) : maskCpf(v)); setErrors(e => ({ ...e, doc: undefined })); }}
                placeholder={docType === 'cnpj' ? '00.000.000/0000-00' : '000.000.000-00'}
                placeholderTextColor="#625d6780"
                inputMode="numeric"
                className={errors.doc ? INPUT_ERR : INPUT}
              />
              {errors.doc && <Text className={ERR}>{errors.doc}</Text>}
            </View>

            <View className="mb-8">
              <Text className={LABEL}>Categoria</Text>
              <View className="flex-row flex-wrap gap-2">
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => setCategory(cat)}
                    className={`px-4 h-10 rounded-xl items-center justify-center border ${category === cat ? 'bg-[#68597a] border-[#68597a]' : 'bg-[#f9f1fa] border-[#b7afbb66]'}`}
                  >
                    <Text className={`text-xs font-bold ${category === cat ? 'text-white' : 'text-[#625d67]'}`}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View className="flex-row items-center gap-2 mb-5">
              <View className="w-8 h-[1px] bg-[#68597a4d]" />
              <Text className="text-xl font-serif text-[#68597a] italic">Contato Direto</Text>
            </View>

            <View className="mb-5">
              <Text className={LABEL}>E-mail Corporativo</Text>
              <TextInput
                value={email}
                onChangeText={v => { setEmail(v); setErrors(e => ({ ...e, email: undefined })); }}
                placeholder="contato@fornecedor.com.br"
                placeholderTextColor="#625d6780"
                className={errors.email ? INPUT_ERR : INPUT}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              {errors.email && <Text className={ERR}>{errors.email}</Text>}
            </View>

            <View className="mb-8">
              <Text className={LABEL}>Telefone / WhatsApp</Text>
              <TextInput
                value={phone}
                onChangeText={v => { setPhone(maskPhone(v)); setErrors(e => ({ ...e, phone: undefined })); }}
                placeholder="(11) 98765-4321"
                placeholderTextColor="#625d6780"
                className={errors.phone ? INPUT_ERR : INPUT}
                inputMode="tel"
              />
              {errors.phone && <Text className={ERR}>{errors.phone}</Text>}
            </View>

            <TouchableOpacity
              onPress={handleSave}
              disabled={saving}
              className={`h-14 rounded-full items-center justify-center shadow-lg shadow-[#68597a4d] ${saving ? 'bg-[#68597a80]' : 'bg-[#68597a]'}`}
            >
              <Text className="text-white text-center font-bold text-base">
                {saving ? 'Salvando…' : 'Salvar Fornecedor'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* ── Existing suppliers list ────────────────────────────────── */}
          <View className="bg-[#f9f1fa] rounded-[32px] p-8 mb-8">
            <Text className="font-serif text-xl font-bold text-[#68597a] italic mb-6">Fornecedores Cadastrados</Text>
            {loading && <Text className="text-[#625d67] text-sm">Carregando…</Text>}
            {!loading && suppliers.length === 0 && (
              <Text className="text-[#625d67] text-sm">Nenhum fornecedor cadastrado ainda.</Text>
            )}
            {suppliers.map((s) => (
              <View key={s.id} className="mb-4 bg-[#e8e0ec] rounded-2xl p-4">
                <TouchableOpacity
                  onPress={() => setExpandedId(prev => prev === s.id ? null : s.id)}
                  className="flex-row items-center gap-4"
                >
                  <View className="w-12 h-12 rounded-2xl bg-[#f9f1fa] items-center justify-center">
                    <Building2 size={20} color="#68597a" />
                  </View>
                  <View className="flex-1">
                    <Text className="font-bold text-sm text-[#35313a]">{s.company_name}</Text>
                    <Text className="text-[11px] text-[#625d67]">{s.category}{s.email ? ` · ${s.email}` : ''}</Text>
                  </View>
                  {expandedId === s.id
                    ? <ChevronUp size={16} color="#68597a" />
                    : <ChevronDown size={16} color="#68597a" />}
                  <TouchableOpacity onPress={() => removeSupplier(s.id)} className="p-2">
                    <Trash2 size={18} color="#ba1a1a66" />
                  </TouchableOpacity>
                </TouchableOpacity>

                {expandedId === s.id && <SupplierProductsSection supplierId={s.id} />}
              </View>
            ))}
          </View>

          {/* ── Decorative cards ──────────────────────────────────────── */}
          <View className="mb-20">
            <View className="bg-[#ffe088] rounded-[32px] p-8 relative overflow-hidden h-48 mb-6">
              <img
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuBRacs2xlgMlJEODs0DHz870yWz3vtyOIUwFwX66Qa4mKKlMdedF4Y4Ueg_ctfPb1Jj_teB9NsMsr-K8ao0jK_oLhUR4PSsIa-ApvNyMmOMqRxgsUDz-5fYktbLjfnm54r3Z4J4H7mHVxSaNov0i7TiU3KeHDiJe2sB9h4dqBTrLXbrQ1ITethRzHLiyihWTgIDvxhzQWD000h64AX2ZO2V4TEQjoPVQlS3CbjfsfdlIvdALUeTtKQznuxNpY8OgfRxuVH9b87UoP3k"
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.3, objectFit: 'cover' }}
              />
              <View className="relative z-10">
                <Text className="text-[#644f00] font-serif text-2xl font-bold italic mb-2">Curadoria de Excelência</Text>
                <Text className="text-[#644f00cc] text-xs">Seus fornecedores são a base da experiência do seu salão.</Text>
              </View>
            </View>

            <View className="bg-[#d0fcfe] rounded-[32px] p-8 mb-6">
              <View className="flex-row items-center gap-3 mb-4">
                <Verified size={20} color="#3a6264" />
                <Text className="text-[#3a6264] font-bold text-xs tracking-wide uppercase">Dica</Text>
              </View>
              <Text className="text-[#3a6264cc] text-xs leading-relaxed">
                Mantenha os dados de contato sempre atualizados para garantir a agilidade nos pedidos de reposição e evitar rupturas no estoque.
              </Text>
            </View>

            <View className="p-10 border border-[#b7afbb26] rounded-[32px] items-center justify-center">
              <View className="w-16 h-16 bg-[#e8e0ec] rounded-full items-center justify-center mb-4">
                <Flower2 size={32} color="#68597a" />
              </View>
              <Text className="font-serif italic text-[#625d67] text-center">Elevando o padrão da beleza artesanal.</Text>
            </View>
          </View>
        </MotiView>
      </ScrollView>
    </View>
  );
};
