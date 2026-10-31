import React, { useEffect, useState } from 'react';
import { Alert, Image, Modal, Platform, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import { analyzeFoodPhoto, getCredits, searchFoods as searchJanuaryFoods } from './services/api';


const HISTORY_KEY = 'jfs-history';
const COLORS = { ink: '#17231f', muted: '#718078', green: '#176b50', pale: '#eaf4ee', line: '#e3e9e5', bg: '#f6f8f6', white: '#fff', red: '#b42318' };

const fmt = (n) => n?.value == null ? '–' : `${Math.round(Number(n.value) * 10) / 10}${n.unit ? ` ${n.unit}` : ''}`;
const mapNutrients = (n) => !n ? {} : Array.isArray(n) ? Object.fromEntries(n.map((v, i) => [v.id || v.key || v.name || i, v])) : n;
const pick = (map, keys) => { for (const k of keys) if (map[k] != null) return typeof map[k] === 'number' ? { value: map[k] } : map[k]; return null; };

function Button({ title, onPress, primary, disabled, secondary }) {
  return <TouchableOpacity activeOpacity={0.8} disabled={disabled} onPress={onPress} style={[styles.button, primary && styles.primary, secondary && styles.secondary, disabled && styles.disabled]}><Text style={[styles.buttonText, primary && styles.primaryText, secondary && styles.secondaryText]}>{title}</Text></TouchableOpacity>;
}
function SectionTitle({ children }) { return <Text style={styles.sectionTitle}>{children}</Text>; }
function Nutrition({ result }) {
  if (!result) return <Text style={styles.muted}>Your meal's calories, macros and detected ingredients will appear here after scanning.</Text>;
  const n = mapNutrients(result.total_nutrients);
  const rows = [['Total fat', ['fat','total_fat']], ['Carbohydrates', ['carbohydrates','carbohydrate','carbs','total_carbohydrate']], ['Protein', ['protein']], ['Fibre', ['fiber','fibre','dietary_fiber']], ['Sugars', ['sugar','sugars','total_sugars']], ['Sodium', ['sodium']]];
  const calories = pick(n, ['calories','energy','kcal']);
  return <View><Text style={styles.mealName}>{result.meal_name || 'Scanned meal'}</Text><View style={styles.calorieBox}><Text style={styles.calorieLabel}>ESTIMATED CALORIES</Text><Text style={styles.calories}>{fmt(calories)}</Text></View>{rows.map(([label, keys]) => <View style={styles.nutrientRow} key={label}><Text style={styles.body}>{label}</Text><Text style={styles.bodyBold}>{fmt(pick(n, keys))}</Text></View>)}
    {!!result.detections?.length && <><SectionTitle>Foods detected</SectionTitle>{result.detections.map((d, i) => { const f = d.food || {}; const m = mapNutrients(f.nutrients); return <View style={styles.foodRow} key={`${f.id || f.name || 'food'}-${i}`}><Text style={styles.bodyBold}>{f.name || 'Food item'}</Text><Text style={styles.muted}>{fmt(pick(m, ['calories','energy','kcal']))} {d.confidence_score != null ? ` · ${typeof d.confidence_score === 'string' ? d.confidence_score : `${Math.round((d.confidence_score <= 1 ? d.confidence_score * 100 : d.confidence_score))}% confidence`}` : ''}</Text></View>; })}</>}
  </View>;
}

export default function App() {
  const [tab, setTab] = useState('scan');
  const [photo, setPhoto] = useState(null);
  const [prepared, setPrepared] = useState(null);
  const [context, setContext] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [history, setHistory] = useState([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [credits, setCredits] = useState(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = React.useRef(null);

  useEffect(() => { AsyncStorage.getItem(HISTORY_KEY).then(v => { if (v) setHistory(JSON.parse(v)); }).catch(() => {}); refreshCredits(); }, []);

  async function refreshCredits() { try { setCredits(await getCredits()); } catch {} }

  async function choosePhoto(camera) {
    setError('');
    try {
      if (camera) {
        // Show a live camera preview on both Expo native and Expo Web.
        const permission = cameraPermission?.granted ? cameraPermission : await requestCameraPermission();
        if (!permission?.granted) {
          const message = 'Allow camera access to take a meal photo.';
          if (Platform.OS === 'web') setError(message); else Alert.alert('Camera permission needed', message);
          return;
        }
        setCameraOpen(true);
        return;
      }
      if (Platform.OS !== 'web') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) { Alert.alert('Permission needed', 'Allow photo library access to choose a meal photo.'); return; }
      }
      const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.9 });
      if (picked.canceled || !picked.assets?.[0]) return;
      await useCapturedPhoto(picked.assets[0].uri);
    } catch (e) { setError(e.message || 'Could not open the camera or photo library.'); }
  }

  async function useCapturedPhoto(uri) {
    const resized = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 1600 } }], { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG, base64: true });
    if (!resized.base64) throw new Error('Could not prepare that image. Please try again.');
    setPhoto(resized.uri);
    setPrepared(`data:image/jpeg;base64,${resized.base64}`);
    setResult(null);
    setError('');
  }

  async function capturePhoto() {
    try {
      const captured = await cameraRef.current?.takePictureAsync({ quality: 0.9 });
      if (!captured?.uri) return;
      setCameraOpen(false);
      await useCapturedPhoto(captured.uri);
    } catch (e) { setError(e.message || 'Could not capture photo.'); setCameraOpen(false); }
  }
  async function scan() {
    if (!prepared || scanning) return;
    setError(''); setScanning(true);
    try {
      const data = await analyzeFoodPhoto(prepared, context);
      setResult(data);
      const next = [{ id: Date.now(), at: new Date().toISOString(), thumb: photo, result: data, context }, ...history].slice(0, 8);
      setHistory(next); await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      refreshCredits();
    } catch (e) { setError(e.message || 'January could not analyze this meal.'); }
    finally { setScanning(false); }
  }
  async function searchFoods() {
    const q = searchQuery.trim(); if (!q || searching) return;
    setSearching(true); setError('');
    try { const foods = await searchJanuaryFoods(q, 15); setSearchResults(foods); }
    catch (e) { setError(e.message || 'Food search failed.'); }
    finally { setSearching(false); }
  }
  const creditText = credits == null ? 'January AI' : `${credits} credits left`;

  return <SafeAreaView style={styles.safe}><StatusBar barStyle="dark-content" backgroundColor={COLORS.bg}/>
    <Modal visible={cameraOpen} animationType="slide" onRequestClose={() => setCameraOpen(false)}>
      <View style={styles.cameraScreen}>
        <CameraView ref={cameraRef} style={styles.liveCamera} facing="back" />
        <View style={styles.cameraControls}>
          <TouchableOpacity onPress={() => setCameraOpen(false)} style={styles.cameraCancel}><Text style={styles.cameraControlText}>Cancel</Text></TouchableOpacity>
          <TouchableOpacity onPress={capturePhoto} style={styles.shutterOuter} accessibilityLabel="Take photo"><View style={styles.shutterInner}/></TouchableOpacity>
          <View style={{width:64}} />
        </View>
      </View>
    </Modal><View style={styles.header}><View><Text style={styles.brand}>january</Text><Text style={styles.tagline}>FOOD SCANNER</Text></View><View style={styles.creditPill}><Text style={styles.creditText}>{creditText}</Text></View></View>
    <View style={styles.tabs}><TouchableOpacity onPress={() => setTab('scan')} style={[styles.tab, tab === 'scan' && styles.tabActive]}><Text style={[styles.tabText, tab === 'scan' && styles.tabTextActive]}>Scan a meal</Text></TouchableOpacity><TouchableOpacity onPress={() => setTab('search')} style={[styles.tab, tab === 'search' && styles.tabActive]}><Text style={[styles.tabText, tab === 'search' && styles.tabTextActive]}>Look up food</Text></TouchableOpacity></View>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {tab === 'scan' ? <>
        <SectionTitle>Your meal</SectionTitle><TouchableOpacity activeOpacity={0.9} onPress={() => choosePhoto(false)} style={styles.photoFrame}>{photo ? <Image source={{ uri: photo }} style={styles.preview} resizeMode="cover"/> : <View style={styles.emptyPhoto}><Text style={styles.cameraIcon}>＋</Text><Text style={styles.photoTitle}>Add a photo of your meal</Text><Text style={styles.muted}>Take a picture or choose one from your gallery</Text></View>}</TouchableOpacity>
        <View style={styles.actionRow}><View style={styles.actionHalf}><Button title="Take photo" primary onPress={() => choosePhoto(true)}/></View><View style={styles.actionHalf}><Button title="Choose photo" secondary onPress={() => choosePhoto(false)}/></View></View>
        <Text style={styles.fieldLabel}>Additional details (optional)</Text><TextInput value={context} onChangeText={setContext} maxLength={500} placeholder="e.g. cooked in ghee, no sugar in the chai" placeholderTextColor="#97a39c" style={styles.input}/>
        <Button title={scanning ? 'Analyzing meal…' : 'Scan meal with January AI'} primary disabled={!prepared || scanning} onPress={scan}/><Text style={styles.hint}>Your photo is securely sent to your January AI proxy for nutrition analysis. Scans count against your January plan usage.</Text>
        {!!error && <Text style={styles.error}>{error}</Text>}
        <View style={styles.card}><SectionTitle>Nutrition facts</SectionTitle><Nutrition result={result}/></View>
        {!!history.length && <View style={styles.history}><SectionTitle>Recent scans</SectionTitle>{history.map(h => <TouchableOpacity key={h.id} style={styles.historyItem} onPress={() => { setPhoto(h.thumb); setPrepared(null); setResult(h.result); setError(''); }}><Image source={{ uri: h.thumb }} style={styles.historyImage}/><View style={{ flex: 1 }}><Text style={styles.bodyBold}>{h.result?.meal_name || 'Scanned meal'}</Text><Text style={styles.muted}>{new Date(h.at).toLocaleDateString()}</Text></View><Text style={styles.greenText}>View</Text></TouchableOpacity>)}<Button title="Clear history" secondary onPress={async () => { setHistory([]); await AsyncStorage.removeItem(HISTORY_KEY); }}/></View>}
      </> : <><SectionTitle>Look up a food</SectionTitle><Text style={styles.muted}>Search January's food database for nutrition information.</Text><View style={styles.searchRow}><TextInput value={searchQuery} onChangeText={setSearchQuery} onSubmitEditing={searchFoods} returnKeyType="search" placeholder="Search foods, brands or meals" placeholderTextColor="#97a39c" style={[styles.input, {flex:1, marginBottom:0}]}/><TouchableOpacity onPress={searchFoods} disabled={searching || !searchQuery.trim()} style={[styles.searchButton, (!searchQuery.trim() || searching) && styles.disabled]}><Text style={styles.primaryText}>{searching ? '…' : 'Search'}</Text></TouchableOpacity></View>{searchResults.map((item, i) => { const food = item.food || item; const nutrients = mapNutrients(food.nutrients || food.total_nutrients); return <View key={String(food.id || i)} style={styles.foodRow}><Text style={styles.bodyBold}>{food.name || food.description || 'Food item'}</Text><Text style={styles.muted}>{fmt(pick(nutrients, ['calories','energy','kcal']))} · {food.brand_name || food.brand || food.category || 'Food'}</Text></View>; })}</>}
      <Text style={styles.disclaimer}>Nutrition values are estimates from a photo. Check portions and consult a health professional before making medical decisions.</Text>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({ cameraScreen:{flex:1,backgroundColor:'#000',justifyContent:'space-between'},liveCamera:{flex:1},cameraControls:{height:118,backgroundColor:'#000',flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:28},cameraCancel:{width:64,paddingVertical:12},cameraControlText:{color:'#fff',fontSize:15,fontWeight:'700'},shutterOuter:{width:76,height:76,borderRadius:38,borderWidth:5,borderColor:'#fff',alignItems:'center',justifyContent:'center'},shutterInner:{width:58,height:58,borderRadius:29,backgroundColor:'#fff'}, safe:{flex:1,backgroundColor:COLORS.bg,paddingTop:Platform.OS==='android'?StatusBar.currentHeight:0}, header:{paddingHorizontal:22,paddingTop:12,paddingBottom:16,flexDirection:'row',alignItems:'center',justifyContent:'space-between'}, brand:{fontSize:30,fontWeight:'800',letterSpacing:-1.5,color:COLORS.green}, tagline:{fontSize:10,fontWeight:'800',letterSpacing:2,color:COLORS.muted,marginTop:-2}, creditPill:{backgroundColor:COLORS.pale,borderRadius:30,paddingHorizontal:13,paddingVertical:9},creditText:{color:COLORS.green,fontWeight:'700',fontSize:12},tabs:{flexDirection:'row',marginHorizontal:20,backgroundColor:'#e9eeea',borderRadius:12,padding:4},tab:{flex:1,paddingVertical:11,alignItems:'center',borderRadius:9},tabActive:{backgroundColor:COLORS.white,elevation:1},tabText:{fontWeight:'600',color:COLORS.muted},tabTextActive:{color:COLORS.ink},content:{padding:20,paddingBottom:50},sectionTitle:{fontSize:19,fontWeight:'800',color:COLORS.ink,marginBottom:12},photoFrame:{height:235,borderRadius:18,overflow:'hidden',borderWidth:1,borderColor:COLORS.line,borderStyle:'dashed',backgroundColor:COLORS.white,marginBottom:13},preview:{width:'100%',height:'100%'},emptyPhoto:{flex:1,alignItems:'center',justifyContent:'center',padding:20},cameraIcon:{fontSize:36,color:COLORS.green,marginBottom:8},photoTitle:{fontSize:16,fontWeight:'700',color:COLORS.ink,marginBottom:5},muted:{fontSize:13,color:COLORS.muted,lineHeight:19},fieldLabel:{fontSize:13,fontWeight:'700',color:COLORS.ink,marginBottom:7,marginTop:10},input:{backgroundColor:COLORS.white,borderWidth:1,borderColor:COLORS.line,borderRadius:12,paddingHorizontal:14,paddingVertical:13,fontSize:14,color:COLORS.ink,marginBottom:10},actionRow:{flexDirection:'row',gap:10,marginBottom:18},actionHalf:{flex:1},button:{paddingVertical:14,paddingHorizontal:12,borderRadius:12,alignItems:'center',justifyContent:'center',backgroundColor:'#e8eee9'},primary:{backgroundColor:COLORS.green},secondary:{backgroundColor:COLORS.pale},disabled:{opacity:0.45},buttonText:{fontSize:14,fontWeight:'800',color:COLORS.ink},primaryText:{color:COLORS.white},secondaryText:{color:COLORS.green},hint:{textAlign:'center',color:COLORS.muted,fontSize:11,marginTop:8,marginBottom:14},error:{color:COLORS.red,backgroundColor:'#fff0ef',padding:12,borderRadius:10,marginVertical:10,fontSize:13},card:{backgroundColor:COLORS.white,borderRadius:16,padding:17,marginTop:15,borderWidth:1,borderColor:COLORS.line},searchRow:{flexDirection:'row', gap:8, marginTop:14, marginBottom:12},searchButton:{backgroundColor:COLORS.green,borderRadius:12,paddingHorizontal:18,alignItems:'center',justifyContent:'center'},mealName:{fontSize:16,fontWeight:'800',color:COLORS.ink,marginBottom:12},calorieBox:{backgroundColor:COLORS.pale,borderRadius:12,padding:15,marginBottom:10},calorieLabel:{fontSize:10,fontWeight:'800',letterSpacing:1,color:COLORS.green},calories:{fontSize:29,fontWeight:'900',color:COLORS.green,marginTop:3},nutrientRow:{paddingVertical:11,borderBottomWidth:1,borderBottomColor:COLORS.line,flexDirection:'row',justifyContent:'space-between'},body:{fontSize:14,color:COLORS.ink},bodyBold:{fontSize:14,fontWeight:'700',color:COLORS.ink},foodRow:{paddingVertical:12,borderBottomWidth:1,borderBottomColor:COLORS.line},history:{marginTop:22},historyItem:{flexDirection:'row',alignItems:'center',gap:12,backgroundColor:COLORS.white,padding:10,borderRadius:12,marginBottom:8},historyImage:{width:48,height:48,borderRadius:9},greenText:{color:COLORS.green,fontWeight:'700'},disclaimer:{fontSize:11,color:COLORS.muted,textAlign:'center',lineHeight:17,marginTop:25}});
