import { useState, useEffect, useCallback } from 'react';
import {
    collection,
    doc,
    getDocs,
    addDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    onSnapshot,
    query,
    orderBy,
    serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Custom hook for Firestore CRUD operations with real-time sync
 */
export function useFirestore(collectionName, options = {}) {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Real-time listener for collection changes
    useEffect(() => {
        if (!collectionName) return;

        setLoading(true);
        const collectionRef = collection(db, collectionName);

        // Sort by order if specified or if it's the 'tasks' collection (backwards compatibility)
        let q;
        if (options.orderBy) {
            q = query(collectionRef, orderBy(options.orderBy, options.direction || 'asc'));
        } else if (collectionName === 'tasks') {
            // Default behavior for tasks
            q = query(collectionRef, orderBy('order', 'asc'));
        } else {
            // Default no sort
            q = query(collectionRef);
        }

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const documents = snapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setData(documents);
                setLoading(false);
                setError(null);
            },
            (err) => {
                console.error('Firestore listener error:', err);
                setError(err);

                // Fallback to unsorted if sort failed
                if (err.message.includes('order')) {
                    console.warn('Fallback to unsorted query');
                    const qFallback = query(collectionRef);
                    onSnapshot(qFallback, (snapshot) => {
                        const documents = snapshot.docs.map((doc) => ({
                            id: doc.id,
                            ...doc.data()
                        }));
                        setData(documents);
                        setLoading(false);
                    });
                }
            }
        );

        return () => unsubscribe();
    }, [collectionName, JSON.stringify(options)]);

    // Add document with auto-id
    const addDocument = useCallback(async (docData) => {
        try {
            const collectionRef = collection(db, collectionName);
            const docRef = await addDoc(collectionRef, {
                ...docData,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            return { id: docRef.id, ...docData };
        } catch (err) {
            console.error('Error adding document:', err);
            throw err;
        }
    }, [collectionName]);

    // Set document with custom id
    const setDocument = useCallback(async (docId, docData) => {
        try {
            const docRef = doc(db, collectionName, docId);
            await setDoc(docRef, {
                ...docData,
                updatedAt: serverTimestamp()
            }, { merge: true });
            return { id: docId, ...docData };
        } catch (err) {
            console.error('Error setting document:', err);
            throw err;
        }
    }, [collectionName]);

    // Update document
    const updateDocument = useCallback(async (docId, docData) => {
        try {
            const docRef = doc(db, collectionName, docId);
            await updateDoc(docRef, {
                ...docData,
                updatedAt: serverTimestamp()
            });
            return { id: docId, ...docData };
        } catch (err) {
            console.error('Error updating document:', err);
            throw err;
        }
    }, [collectionName]);

    // Delete document
    const deleteDocument = useCallback(async (docId) => {
        try {
            const docRef = doc(db, collectionName, docId);
            await deleteDoc(docRef);
            return docId;
        } catch (err) {
            console.error('Error deleting document:', err);
            throw err;
        }
    }, [collectionName]);

    return {
        data,
        loading,
        error,
        addDocument,
        setDocument,
        updateDocument,
        deleteDocument
    };
}

export default useFirestore;
