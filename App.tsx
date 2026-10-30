
import React, { useEffect, useMemo, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  StatusBar,
} from 'react-native';

import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
  onSnapshot,
  doc,
  deleteDoc,
  updateDoc,
} from '@react-native-firebase/firestore';

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from '@react-native-firebase/auth';

type Student = {
  id: string;
  name: string;
  rollNumber: string;
  studentClass: string;
};

type FirebaseError = Error & {
  code?: string;
};

const emptyForm = {
  name: '',
  rollNumber: '',
  studentClass: '',
};

const getAuthErrorMessage = (code: string): string => {
  const messages: Record<string, string> = {
    'auth/email-already-in-use':
      'An account with this email address already exists.',
    'auth/invalid-email':
      'Please enter a valid email address.',
    'auth/invalid-credential':
      'Invalid email or password. Please try again.',
    'auth/user-not-found':
      'No account was found with this email address.',
    'auth/wrong-password':
      'Incorrect password. Please try again.',
    'auth/weak-password':
      'Please choose a stronger password with at least 6 characters.',
    'auth/network-request-failed':
      'Network error. Please check your internet connection.',
    'auth/too-many-requests':
      'Too many attempts. Please try again later.',
  };

  return messages[code] ?? 'Authentication failed. Please try again.';
};

const getFirestoreErrorMessage = (code: string): string => {
  const messages: Record<string, string> = {
    'permission-denied':
      'You do not have permission to perform this action.',
    'firestore/permission-denied':
      'You do not have permission to perform this action.',
    unavailable:
      'The service is temporarily unavailable. Please try again.',
    'firestore/unavailable':
      'The service is temporarily unavailable. Please try again.',
    'network-request-failed':
      'Network error. Please check your internet connection.',
  };

  return messages[code] ??
    'Something went wrong while communicating with Firebase. Please try again.';
};

export default function App() {
  const auth = getAuth();

  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);

  const [name, setName] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [studentClass, setStudentClass] = useState('');

  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loadingStudents, setLoadingStudents] = useState(true);

  // Firebase login status
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, currentUser => {
      setUser(currentUser);
      setAuthLoading(false);
    });

    return unsubscribe;
  }, [auth]);

  // Current user's students
  useEffect(() => {
    if (!user) {
      setStudents([]);
      setLoadingStudents(false);
      return;
    }

    setLoadingStudents(true);

    const db = getFirestore();

    const unsubscribe = onSnapshot(
      collection(db, 'users', user.uid, 'students'),
      snapshot => {
        const list: Student[] = snapshot.docs.map(item => {
          const data = item.data();

          return {
            id: item.id,
            name: String(data.name ?? ''),
            rollNumber: String(data.rollNumber ?? ''),
            studentClass: String(data.studentClass ?? ''),
          };
        });

        setStudents(list);
        setLoadingStudents(false);
      },
      error => {
        console.log('Students listener error:', error);
        setLoadingStudents(false);

        Alert.alert(
          'Firebase Error',
          getFirestoreErrorMessage(
            (error as FirebaseError).code ?? '',
          ),
        );
      },
    );

    return unsubscribe;
  }, [user]);

  // Search students
  const filteredStudents = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return students;

    return students.filter(
      student =>
        student.name.toLowerCase().includes(query) ||
        student.rollNumber.toLowerCase().includes(query) ||
        student.studentClass.toLowerCase().includes(query),
    );
  }, [students, search]);

  // Login / Register
  const handleAuth = async () => {
    const cleanEmail = email.trim();

    if (!cleanEmail || !password) {
      Alert.alert(
        'Missing Information',
        'Please enter your email address and password.',
      );
      return;
    }

    if (password.length < 6) {
      Alert.alert(
        'Invalid Password',
        'Password must contain at least 6 characters.',
      );
      return;
    }

    setAuthBusy(true);

    try {
      if (authMode === 'register') {
        await createUserWithEmailAndPassword(auth, cleanEmail, password);

        Alert.alert(
          'Success',
          'Your account has been created successfully!',
        );
      } else {
        await signInWithEmailAndPassword(auth, cleanEmail, password);
      }
    } catch (error: any) {
      console.log('Authentication error:', error);

      Alert.alert(
        'Authentication Error',
        getAuthErrorMessage(error.code ?? ''),
      );
    } finally {
      setAuthBusy(false);
    }
  };

  // Logout
  const handleLogout = async () => {
    try {
      await signOut(auth);
      clearForm();
      setEmail('');
      setPassword('');
      setSearch('');

      Alert.alert('Success', 'You have been logged out successfully.');
    } catch (error: any) {
      console.log('Logout error:', error);

      Alert.alert(
        'Logout Error',
        'Unable to log out. Please try again.',
      );
    }
  };

  // Clear form
  const clearForm = () => {
    setName(emptyForm.name);
    setRollNumber(emptyForm.rollNumber);
    setStudentClass(emptyForm.studentClass);
    setEditingId(null);
  };

  // Add / Update student
  const saveStudent = async () => {
    if (!user) {
      Alert.alert(
        'Login Required',
        'Please log in to manage student records.',
      );
      return;
    }

    if (!name.trim() || !rollNumber.trim() || !studentClass.trim()) {
      Alert.alert(
        'Missing Information',
        'Please fill in all required student fields.',
      );
      return;
    }

    if (saving) return;

    setSaving(true);

    try {
      const db = getFirestore();

      const studentsCollection = collection(
        db,
        'users',
        user.uid,
        'students',
      );

      const studentData = {
        name: name.trim(),
        rollNumber: rollNumber.trim(),
        studentClass: studentClass.trim(),
        updatedAt: serverTimestamp(),
      };

      if (editingId) {
        await updateDoc(
          doc(studentsCollection, editingId),
          studentData,
        );

        Alert.alert(
          'Success',
          'Student record has been updated successfully!',
        );
      } else {
        await addDoc(studentsCollection, {
          ...studentData,
          createdAt: serverTimestamp(),
        });

        Alert.alert(
          'Success',
          'Student has been added successfully!',
        );
      }

      clearForm();
    } catch (error: any) {
      console.log('Save/Edit error:', error);

      Alert.alert(
        'Firebase Error',
        getFirestoreErrorMessage(error.code ?? ''),
      );
    } finally {
      setSaving(false);
    }
  };

  // Edit student
  const startEdit = (student: Student) => {
    setName(student.name);
    setRollNumber(student.rollNumber);
    setStudentClass(student.studentClass);
    setEditingId(student.id);
  };

  // Delete student
  const deleteStudent = async (student: Student) => {
    if (!user || deletingId) return;

    setDeletingId(student.id);

    try {
      const db = getFirestore();

      await deleteDoc(
        doc(
          db,
          'users',
          user.uid,
          'students',
          student.id,
        ),
      );

      if (editingId === student.id) {
        clearForm();
      }

      Alert.alert(
        'Success',
        'Student has been deleted successfully!',
      );
    } catch (error: any) {
      console.log('Delete error:', error);

      Alert.alert(
        'Delete Error',
        getFirestoreErrorMessage(error.code ?? ''),
      );
    } finally {
      setDeletingId(null);
    }
  };

  // Delete confirmation
  const confirmDelete = (student: Student) => {
    Alert.alert(
      'Delete Student',
      `Are you sure you want to delete ${student.name}'s record?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteStudent(student),
        },
      ],
    );
  };

  // Authentication loading
  if (authLoading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#1D4ED8" />
        <Text style={styles.subtitle}>Checking login status...</Text>
      </SafeAreaView>
    );
  }

  // Login / Register screen
  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />

        <ScrollView
          contentContainerStyle={styles.authContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>Student Management</Text>

          <Text style={styles.subtitle}>
            {authMode === 'login'
              ? 'Login to your account'
              : 'Create a new account'}
          </Text>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              {authMode === 'login' ? 'Login' : 'Register'}
            </Text>

            <Text style={styles.label}>Email</Text>

            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              placeholderTextColor="#94A3B8"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={styles.label}>Password</Text>

            <TextInput
              style={styles.input}
              placeholder="At least 6 characters"
              placeholderTextColor="#94A3B8"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />

            <Pressable
              style={[
                styles.primaryButton,
                authBusy && styles.disabled,
              ]}
              onPress={handleAuth}
              disabled={authBusy}
            >
              {authBusy ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>
                  {authMode === 'login'
                    ? 'Login'
                    : 'Create Account'}
                </Text>
              )}
            </Pressable>

            <Pressable
              style={styles.cancelButton}
              onPress={() =>
                setAuthMode(
                  authMode === 'login' ? 'register' : 'login',
                )
              }
            >
              <Text style={styles.cancelText}>
                {authMode === 'login'
                  ? "Don't have an account? Register"
                  : 'Already have an account? Login'}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Student Management screen
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>Student Management</Text>

          <Text style={styles.subtitle}>
            Manage your student records
          </Text>

          <Text style={styles.userEmail}>{user.email}</Text>

          <Pressable
            style={styles.logoutButton}
            onPress={handleLogout}
          >
            <Text style={styles.buttonText}>Logout</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            {editingId ? 'Edit Student' : 'Add New Student'}
          </Text>

          <Text style={styles.label}>Student Name</Text>

          <TextInput
            style={styles.input}
            placeholder="Enter student name"
            placeholderTextColor="#94A3B8"
            value={name}
            onChangeText={setName}
            editable={!saving}
          />

          <Text style={styles.label}>Roll Number</Text>

          <TextInput
            style={styles.input}
            placeholder="Enter roll number"
            placeholderTextColor="#94A3B8"
            value={rollNumber}
            onChangeText={setRollNumber}
            editable={!saving}
          />

          <Text style={styles.label}>Class</Text>

          <TextInput
            style={styles.input}
            placeholder="Enter class"
            placeholderTextColor="#94A3B8"
            value={studentClass}
            onChangeText={setStudentClass}
            editable={!saving}
          />

          <Pressable
            style={[
              styles.primaryButton,
              saving && styles.disabled,
            ]}
            onPress={saveStudent}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>
                {editingId ? 'Update Student' : 'Save Student'}
              </Text>
            )}
          </Pressable>

          {editingId && (
            <Pressable
              style={styles.cancelButton}
              onPress={clearForm}
            >
              <Text style={styles.cancelText}>Cancel Edit</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.listSection}>
          <View style={styles.listHeader}>
            <Text style={styles.sectionTitle}>Students List</Text>

            <Text style={styles.count}>
              Total: {students.length}
            </Text>
          </View>

          <TextInput
            style={styles.searchInput}
            placeholder="Search name, roll number or class..."
            placeholderTextColor="#94A3B8"
            value={search}
            onChangeText={setSearch}
          />

          {loadingStudents ? (
            <ActivityIndicator
              size="large"
              color="#1D4ED8"
              style={styles.loader}
            />
          ) : filteredStudents.length === 0 ? (
            <Text style={styles.emptyText}>
              {students.length === 0
                ? 'No students have been added yet.'
                : 'No students found matching your search.'}
            </Text>
          ) : (
            filteredStudents.map(student => (
              <View key={student.id} style={styles.studentCard}>
                <Text style={styles.studentName}>
                  {student.name}
                </Text>

                <Text style={styles.detail}>
                  Roll Number: {student.rollNumber}
                </Text>

                <Text style={styles.detail}>
                  Class: {student.studentClass}
                </Text>

                <View style={styles.actions}>
                  <Pressable
                    style={[
                      styles.actionButton,
                      styles.editButton,
                    ]}
                    onPress={() => startEdit(student)}
                    disabled={saving || deletingId !== null}
                  >
                    <Text style={styles.buttonText}>Edit</Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.actionButton,
                      styles.deleteButton,
                    ]}
                    onPress={() => confirmDelete(student)}
                    disabled={saving || deletingId !== null}
                  >
                    {deletingId === student.id ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.buttonText}>Delete</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },

  center: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },

  content: {
    padding: 18,
    paddingBottom: 40,
  },

  authContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },

  header: {
    marginBottom: 20,
    marginTop: 8,
  },

  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#1D4ED8',
    textAlign: 'center',
  },

  subtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
  },

  userEmail: {
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
    marginTop: 8,
  },

  card: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 16,
    elevation: 3,
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B',
  },

  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
    marginTop: 14,
  },

  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 16,
    color: '#0F172A',
  },

  primaryButton: {
    backgroundColor: '#1D4ED8',
    padding: 14,
    borderRadius: 9,
    alignItems: 'center',
    marginTop: 22,
  },

  disabled: {
    opacity: 0.6,
  },

  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },

  cancelButton: {
    padding: 12,
    alignItems: 'center',
    marginTop: 4,
  },

  cancelText: {
    color: '#475569',
    fontWeight: '600',
    textAlign: 'center',
  },

  logoutButton: {
    backgroundColor: '#DC2626',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },

  listSection: {
    marginTop: 28,
  },

  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },

  count: {
    color: '#1D4ED8',
    fontWeight: 'bold',
  },

  searchInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0F172A',
    marginBottom: 14,
  },

  studentCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#2563EB',
    elevation: 2,
  },

  studentName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 7,
  },

  detail: {
    fontSize: 14,
    color: '#475569',
    marginTop: 4,
  },

  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 15,
  },

  actionButton: {
    flex: 1,
    padding: 11,
    borderRadius: 8,
    alignItems: 'center',
  },

  editButton: {
    backgroundColor: '#2563EB',
  },

  deleteButton: {
    backgroundColor: '#DC2626',
  },

  emptyText: {
    backgroundColor: '#FFFFFF',
    color: '#64748B',
    textAlign: 'center',
    padding: 20,
    borderRadius: 10,
  },

  loader: {
    marginVertical: 25,
  },
});
