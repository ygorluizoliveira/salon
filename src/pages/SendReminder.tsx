import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Image } from 'react-native';
import { MessageSquare, Mail, Calendar, Send, Sparkles, Star } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useNavigation } from '@react-navigation/native';
import { TopBar } from '../components/TopBar';

export const SendReminder: React.FC = () => {
  const navigation = useNavigation();

  return (
    <View className="flex-1 bg-[#fef7fe]">
      <TopBar onBack={() => navigation.goBack()} title="Lembrete" />
      <ScrollView className="flex-1 px-6 pt-24 pb-32">
        <MotiView 
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ type: 'timing', duration: 700 }}
        >
          <View className="mb-10">
            <Text className="text-4xl font-serif text-[#68597a] leading-tight mb-2 italic">Enviar Lembrete</Text>
            <Text className="text-[#625d67] font-medium">Personalize e envie a confirmação de agendamento para sua cliente.</Text>
          </View>

        <View className="mb-8">
          <View className="bg-[#e8e0ec] rounded-[32px] p-8 mb-8">
            <Text className="text-[10px] font-bold uppercase tracking-widest text-[#625d67] mb-6">Cliente Selecionada</Text>
            <View className="flex-row items-center gap-4">
              <View className="relative">
                <Image 
                  source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDKWtbZ6qUN-QUH7rhR-eEbx0O-tPzMtB_31m1GOC7UjmhtaITsSIh80vx2gSatGVE8YmRwIUEI_cZqwnJAlPvDRjZDCrQBIBe68LUD4R3TIAsSViNCFWsqNB4KTQtGz_wmMt4DgpYGUlb4io2TwVWu0ACG1X14lDm63Cmxxyfsi-G2Sn9EVgVnm6TW8KgJKk1oksX1SZKbfEFyAR1BHJfnYzWUD8lwl2vA2Q03ogUdxXBd6S_SCzgRhfW0lQNoL6wQrONjAqKlSKwg' }} 
                  className="w-16 h-16 rounded-full"
                />
                <View className="absolute -bottom-1 -right-1 w-6 h-6 bg-[#ffe088] rounded-full items-center justify-center border-2 border-[#e8e0ec]">
                  <Star size={10} color="#644f00" fill="#644f00" />
                </View>
              </View>
              <View>
                <Text className="text-xl font-serif text-[#68597a] italic">Isadora Montgomery</Text>
                <Text className="text-sm text-[#625d67] font-medium">Corte & Coloração Premium</Text>
              </View>
            </View>
          </View>

          <View className="mb-8">
            <Text className="text-[10px] font-bold uppercase tracking-widest text-[#625d67] mb-4">Canal de Envio</Text>
            <View className="flex-row gap-3">
              <TouchableOpacity className="flex-1 items-center justify-center p-6 bg-white rounded-2xl border-2 border-[#68597a]">
                <MessageSquare size={24} color="#68597a" />
                <Text className="text-[10px] font-bold text-[#68597a] mt-2">WhatsApp</Text>
              </TouchableOpacity>
              <TouchableOpacity className="flex-1 items-center justify-center p-6 bg-[#f9f1fa] rounded-2xl">
                <Send size={24} color="#625d67" />
                <Text className="text-[10px] font-medium text-[#625d67] mt-2">SMS</Text>
              </TouchableOpacity>
              <TouchableOpacity className="flex-1 items-center justify-center p-6 bg-[#f9f1fa] rounded-2xl">
                <Mail size={24} color="#625d67" />
                <Text className="text-[10px] font-medium text-[#625d67] mt-2">E-mail</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View className="bg-[#f9f1fa] rounded-[40px] p-10 mb-20">
          <Text className="text-[10px] font-bold uppercase tracking-widest text-[#625d67] mb-8">Mensagem de Lembrete</Text>
          
          <View className="relative mb-10">
            <TextInput 
              multiline
              className="w-full h-48 bg-[#e8e0ec] rounded-3xl p-8 text-[#35313a] font-medium leading-relaxed"
              defaultValue={`Olá Isadora, confirmamos seu horário para amanhã às 15:30! Mal podemos esperar para recebê-la.`}
            />
            <View className="absolute bottom-6 right-6 flex-row items-center gap-2 opacity-60">
              <Sparkles size={14} color="#625d67" />
              <Text className="text-[8px] font-bold uppercase tracking-tighter text-[#625d67]">AI Tone: Elegant</Text>
            </View>
          </View>

          <View className="mb-8 p-6 bg-[#d0fcfe4d] rounded-2xl flex-row justify-between items-center">
            <View className="flex-row items-center gap-4">
              <Calendar size={24} color="#3a6264" />
              <View>
                <Text className="text-[8px] font-bold text-[#625d67] uppercase tracking-widest">Data</Text>
                <Text className="text-sm font-bold text-[#68597a]">Amanhã, 14 Out</Text>
              </View>
            </View>
            <View className="items-end">
              <Text className="text-[8px] font-bold text-[#625d67] uppercase tracking-widest">Horário</Text>
              <Text className="text-sm font-bold text-[#68597a]">15:30</Text>
            </View>
          </View>

          <TouchableOpacity className="bg-[#68597a] py-6 rounded-full shadow-lg shadow-[#68597a4d] flex-row items-center justify-center gap-3">
            <Text className="text-white font-bold">Enviar Lembrete</Text>
            <Send size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </MotiView>
    </ScrollView>
    </View>
  );
};
