import React, { useState, useEffect } from 'react';
import { Text, View, TextInput, FlatList, TouchableOpacity, StyleSheet, Platform, Button } from 'react-native';
import { db } from './firebaseConfig';
import { collection, getDocs, addDoc, onSnapshot, query, where, Timestamp, deleteDoc, doc } from 'firebase/firestore';
import { unparse } from 'papaparse';
import { PW } from '@env';
import { getAuth, signInAnonymously } from 'firebase/auth';



let FileSystem, Sharing;
if (Platform.OS !== 'web') {
  FileSystem = require('expo-file-system');
  Sharing = require('expo-sharing');
}



export default function App() {
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [checkIns, setCheckIns] = useState([]);
  const [mode, setMode] = useState('user');
  const [selectedUser, setSelectedUser] = useState(null)
  const [addUsers, setAddUsers] = useState('');




  const exportToCSV = async () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-indexed
  
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0, 23, 59, 59);
  
    const q = query(
      collection(db, 'check_ins'),
      where('timestamp', '>=', Timestamp.fromDate(start)),
      where('timestamp', '<=', Timestamp.fromDate(end))
    );
  
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map(doc => doc.data());
  
    if (data.length === 0) {
      alert(`No check-ins found for ${month + 1}/${year}`);
      return;
    }
  
    const csv = unparse(
      data.map(({ name, timestamp }) => ({
        name,
        time: timestamp?.toDate?.().toLocaleString?.() ?? 'N/A'
      }))
    );
  
    const filename = `checkins_${year}_${month + 1}.csv`;
  
    if (Platform.OS === 'web') {
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
    } else {
      const fileUri = FileSystem.documentDirectory + filename;
      await FileSystem.writeAsStringAsync(fileUri, csv, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      await Sharing.shareAsync(fileUri);
    }
  };
  

  const handleCheckIn = async (user) => {
    console.log('Tapped User:', user.name);
    const today = new Date();
    today.setHours(0,0,0,0);
    const q = query(collection(db, 'check_ins'), where('userId', '==', user.id), where('timestamp', '>=', Timestamp.fromDate(today)));
    const snapshot = await getDocs(q);
    if(!snapshot.empty){
      alert('${user.name} has already been checked in today.');
      return;
    }
    await addDoc(collection(db, 'check_ins'), {
      userId: user.id, name: user.name, timestamp: Timestamp.now()
    });
    alert(`${user.name} checked in at ${new Date().toLocaleTimeString()}`);
    setSearchTerm('');
  };

  const handleAddUser = async () => {
    if (!addUsers.trim()) {
      alert("Please enter a valid name");
      return;
    }
  
    try {
      const newUser = await addDoc(collection(db, 'users'), { name: addUsers.trim() });
      setUsers(prev => [...prev, { id: newUser.id, name: addUsers.trim() }]);
      alert(`User '${addUsers.trim()}' added.`);
      setAddUsers('');
    } catch (err) {
      console.error("Failed to add user: ", err);
    }
  };

  useEffect(() => {
    const auth = getAuth();
    signInAnonymously(auth)
      .then(() => console.log('Signed in anonymously'))
      .catch((error) => console.error('Anon sign-in error', error));
  }, []);
  




  useEffect(() => {
    const fetchUsers = async () => {
      const snapshot = await getDocs(collection(db, 'users'));
      const userList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(userList);
    };
    fetchUsers();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'check_ins'), snapshot => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const today = new Date();
      today.setHours(0,0,0,0);
      const todayOnly = data.filter(entry => {
        const time = entry.timestamp?.toDate?.() ?? new Date(entry.timestamp);
        return time >= today;
      })
      setCheckIns(todayOnly.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = searchTerm.toLowerCase();
    setFiltered(users.filter(user => user.name.toLowerCase().includes(q)));
  }, [searchTerm, users]);


useEffect(() => {
  const clearOldCheckIns = async () => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const snapshot = await getDocs(collection(db, 'check_ins'));

    for(const document of snapshot.docs){
      const data = document.data();
      const checkInTime = new Date(data.timestamp);
      if (checkInTime < today){
        await deleteDoc(doc(db, 'check_ins', document.id));
        console.log('Deleted: ${data.name} (before today)');
      }
    }
  };
  clearOldCheckIns();
}, []);


  

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Search & Check In</Text>

      <View style = {{ flexDirection: 'row', marginBottom: 10 }}>
        <Button title= "User Mode" onPress={() => setMode('user')} />
        <Button title="Admin Mode"
        onPress = {() => {
          const adminPassword = PW;
          const input = prompt('Enter admin password: ');

          if(input == adminPassword){
            const auth = getAuth();
            const user = auth.currentUser;
            
            
            if(!user){
              alert('You need to be logged in');
            }
            else{
              setMode('admin');
              alert("Admin Mode Activated");
            }
          }
          else{
            alert("Wrong password")
          }
        }}
      />
      </View>




      <TextInput
        placeholder="Type your name"
        value={searchTerm}
        onChangeText={setSearchTerm}
        style={styles.input}
      />
      {searchTerm.trim() !== '' && (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => setSelectedUser(item)} style = {styles.item}>
              <Text>{item.name}</Text>
            </TouchableOpacity>
          )}
          />
        )}
      {mode == 'user' && selectedUser &&(
        <View style = {{ marginVertical: 10}}>
          <Text>Selected: {selectedUser.name}</Text>
          <Button title="Check In" onPress={() => handleCheckIn(selectedUser)} />
        </View>
      )}

      {mode === 'user' && (
        <>
          <Text style={styles.subheader}>Checked In</Text>
          <FlatList
            data = {checkIns
              ?.slice()
              ?.sort((a,b) => a.timestamp?.toDate?.() - b.timestamp?.toDate?.())}
            keyExtractor={(item) => item.id}
            renderItem = {({ item }) => (
              <Text>
                {item.name} - {item.timestamp?.toDate?.().toLocaleTimeString?.() ?? 'No time'}
              </Text>
            )}
          />
        </>
      )}
      {mode == 'admin' && (
        <>

        <View style ={{marginTop: 20}}>
          <Text style = {{fontWeight: 'bold'}}>  Add New User   </Text>

          <TextInput placeholder='Enter Name' value={addUsers} onChangeText={setAddUsers} style = {styles.input} />
          <Button title = "Add User" onPress = {handleAddUser} />

        </View>






        <Text style={styles.subheader}> Checked In </Text>
        <FlatList 
          data = {checkIns}
          keyExtractor={(item) => item.id}
          renderItem ={({item}) => (
            <Text>{item.name} - {item.timestamp?.toDate?.().toLocaleTimeString?.() ?? 'No time'}</Text>
          )}
        />
        <Button title = "Export to CSV" onPress = {exportToCSV} />
        </>
      )}
     
    </View>
    


  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, marginTop: 40 },
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 10 },
  subheader: { marginTop: 30, fontSize: 20, fontWeight: 'bold' },
  input: { borderWidth: 1, padding: 10, marginBottom: 10 },
  item: { padding: 10, borderBottomWidth: 1 }
});




