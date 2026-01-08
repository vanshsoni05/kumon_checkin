import React, { useState, useEffect } from 'react';
import { Text, View, TextInput, FlatList, TouchableOpacity, StyleSheet, Platform, Button, ScrollView } from 'react-native';
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
  const [selectedUser, setSelectedUser] = useState(null);
  const [addUsers, setAddUsers] = useState('');

  const exportToCSV = async () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
  
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
      alert(`${user.name} has already been checked in today.`);
      return;
    }
    await addDoc(collection(db, 'check_ins'), {
      userId: user.id, name: user.name, timestamp: Timestamp.now()
    });
    alert(`${user.name} checked in at ${new Date().toLocaleTimeString()}`);
    setSearchTerm('');
    setSelectedUser(null);
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
      });
      setCheckIns(todayOnly.sort((a, b) => b.timestamp?.toDate?.() - a.timestamp?.toDate?.()));
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
        const checkInTime = data.timestamp?.toDate?.() ?? new Date(0);
        if (checkInTime < today){
          await deleteDoc(doc(db, 'check_ins', document.id));
          console.log(`Deleted: ${data.name} (before today)`);
        }
      }
    };
    clearOldCheckIns();
  }, []);

  return (
    <ScrollView style={styles.container}>
      {/* Header with Mode Toggle */}
      <View style={styles.headerContainer}>
        <Text style={styles.mainTitle}>Check-In System</Text>
        <View style={styles.modeToggle}>
          <TouchableOpacity
            style={[styles.modeButton, mode === 'user' && styles.modeButtonActive]}
            onPress={() => setMode('user')}
          >
            <Text style={[styles.modeButtonText, mode === 'user' && styles.modeButtonTextActive]}>
              User Mode
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeButton, mode === 'admin' && styles.modeButtonActive]}
            onPress={() => {
              const adminPassword = PW;
              const input = prompt('Enter admin password: ');
              if(input === adminPassword){
                const auth = getAuth();
                const user = auth.currentUser;
                if(!user){
                  alert('You need to be logged in');
                } else {
                  setMode('admin');
                  alert("Admin Mode Activated");
                }
              } else {
                alert("Wrong password");
              }
            }}
          >
            <Text style={[styles.modeButtonText, mode === 'admin' && styles.modeButtonTextActive]}>
              Admin Mode
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* User Mode */}
      {mode === 'user' && (
        <View style={styles.userModeContainer}>
          {/* Search Section */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Search Your Name</Text>
            <TextInput
              placeholder="Type your name to check in..."
              value={searchTerm}
              onChangeText={setSearchTerm}
              style={styles.searchInput}
            />
            
            {searchTerm.trim() !== '' && filtered.length > 0 && (
              <View style={styles.dropdownContainer}>
                <FlatList
                  data={filtered}
                  keyExtractor={item => item.id}
                  renderItem={({ item }) => (
                    <TouchableOpacity 
                      onPress={() => {
                        setSelectedUser(item);
                        setSearchTerm('');
                      }} 
                      style={styles.dropdownItem}
                    >
                      <Text style={styles.dropdownItemText}>{item.name}</Text>
                    </TouchableOpacity>
                  )}
                  style={styles.dropdown}
                />
              </View>
            )}

            {selectedUser && (
              <View style={styles.selectedUserContainer}>
                <Text style={styles.selectedUserText}>Selected: {selectedUser.name}</Text>
                <TouchableOpacity 
                  style={styles.checkInButton}
                  onPress={() => handleCheckIn(selectedUser)}
                >
                  <Text style={styles.checkInButtonText}>✓ Check In</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Today's Check-ins */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Today's Check-Ins</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{checkIns.length}</Text>
              </View>
            </View>
            
            {checkIns.length === 0 ? (
              <Text style={styles.emptyText}>No check-ins yet today</Text>
            ) : (
              <FlatList
                data={checkIns}
                keyExtractor={(item) => item.id}
                renderItem={({ item, index }) => (
                  <View style={[styles.checkInItem, index % 2 === 0 && styles.checkInItemAlt]}>
                    <Text style={styles.checkInName}>{item.name}</Text>
                    <Text style={styles.checkInTime}>
                      {item.timestamp?.toDate?.().toLocaleTimeString?.() ?? 'No time'}
                    </Text>
                  </View>
                )}
                scrollEnabled={false}
              />
            )}
          </View>
        </View>
      )}

      {/* Admin Mode */}
      {mode === 'admin' && (
        <View style={styles.adminModeContainer}>
          {/* Admin Dashboard Stats */}
          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{checkIns.length}</Text>
              <Text style={styles.statLabel}>Check-Ins Today</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{users.length}</Text>
              <Text style={styles.statLabel}>Total Users</Text>
            </View>
          </View>

          {/* Admin Actions */}
          <View style={styles.adminCard}>
            <Text style={styles.adminCardTitle}>Admin Actions</Text>
            
            {/* Add User Section */}
            <View style={styles.adminSection}>
              <Text style={styles.sectionLabel}>Add New User</Text>
              <TextInput
                placeholder='Enter full name'
                value={addUsers}
                onChangeText={setAddUsers}
                style={styles.adminInput}
              />
              <TouchableOpacity 
                style={styles.adminButton}
                onPress={handleAddUser}
              >
                <Text style={styles.adminButtonText}>+ Add User</Text>
              </TouchableOpacity>
            </View>

            {/* Export Section */}
            <View style={styles.adminSection}>
              <Text style={styles.sectionLabel}>Export Data</Text>
              <TouchableOpacity 
                style={[styles.adminButton, styles.exportButton]}
                onPress={exportToCSV}
              >
                <Text style={styles.adminButtonText}>⬇ Export to CSV</Text>
              </TouchableOpacity>
              <Text style={styles.helperText}>
                Exports current month's check-in data
              </Text>
            </View>
          </View>

          {/* Check-ins List */}
          <View style={styles.adminCard}>
            <Text style={styles.adminCardTitle}>Today's Check-Ins</Text>
            {checkIns.length === 0 ? (
              <Text style={styles.emptyText}>No check-ins yet today</Text>
            ) : (
              <FlatList
                data={checkIns}
                keyExtractor={(item) => item.id}
                renderItem={({ item, index }) => (
                  <View style={[styles.checkInItem, index % 2 === 0 && styles.checkInItemAlt]}>
                    <Text style={styles.checkInName}>{item.name}</Text>
                    <Text style={styles.checkInTime}>
                      {item.timestamp?.toDate?.().toLocaleTimeString?.() ?? 'No time'}
                    </Text>
                  </View>
                )}
                scrollEnabled={false}
              />
            )}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  headerContainer: {
    backgroundColor: '#2563eb',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  mainTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 15,
  },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 10,
    padding: 4,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  modeButtonActive: {
    backgroundColor: '#ffffff',
  },
  modeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  modeButtonTextActive: {
    color: '#2563eb',
  },
  userModeContainer: {
    padding: 20,
  },
  adminModeContainer: {
    padding: 20,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 15,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  badge: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  badgeText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  searchInput: {
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    backgroundColor: '#f9fafb',
  },
  dropdownContainer: {
    marginTop: 10,
  },
  dropdown: {
    maxHeight: 200,
  },
  dropdownItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  dropdownItemText: {
    fontSize: 16,
    color: '#374151',
  },
  selectedUserContainer: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#dbeafe',
    borderRadius: 10,
  },
  selectedUserText: {
    fontSize: 16,
    color: '#1e40af',
    marginBottom: 10,
    fontWeight: '600',
  },
  checkInButton: {
    backgroundColor: '#2563eb',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  checkInButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  checkInItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  checkInItemAlt: {
    backgroundColor: '#f9fafb',
  },
  checkInName: {
    fontSize: 16,
    color: '#1f2937',
    fontWeight: '500',
  },
  checkInTime: {
    fontSize: 14,
    color: '#6b7280',
  },
  emptyText: {
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: 16,
    paddingVertical: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 15,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  statNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2563eb',
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  adminCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  adminCardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 20,
  },
  adminSection: {
    marginBottom: 25,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 10,
  },
  adminInput: {
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    backgroundColor: '#f9fafb',
    marginBottom: 10,
  },
  adminButton: {
    backgroundColor: '#2563eb',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  exportButton: {
    backgroundColor: '#059669',
  },
  adminButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  helperText: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 8,
  },
});


