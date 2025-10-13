import { Injectable } from "@angular/core";
import { getStorage, ref, getDownloadURL } from "firebase/storage";
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getDatabase, ref as dbRef, set, get, push, update, onValue, off } from "firebase/database";
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})

export class FirebaseService {
  private storageRef: any;
  private database: any;

  constructor() {
    const firebaseConfig = {
      apiKey: "AIzaSyAg1GWmC7DUNTRtJiIu0yOhrJOFgvQxVOQ",
      authDomain: "cape-ssbu-hub.firebaseapp.com",
      projectId: "cape-ssbu-hub",
      storageBucket: "gs://cape-ssbu-hub.appspot.com",
      messagingSenderId: "646253006930",
      appId: "1:646253006930:web:86c020fb89a87f87634f8b",
      measurementId: "G-KZ9D8XB7J4",
      databaseURL: "https://cape-ssbu-hub-default-rtdb.firebaseio.com/"

    };
    const app = initializeApp(firebaseConfig);
    // Create a storage reference
    const storage = getStorage(app);
    this.storageRef = ref(storage, 'assets/');

    // Get the download URL

    // Initialize Realtime Database and get a reference to the service
    this.database = getDatabase(app);
  }

  getImageUrl(path: string): Promise<string> {
    console.log("Firebase: retrieving from ", path);
    const imageRef = ref(this.storageRef, path);
    return getDownloadURL(imageRef)
      .then((url) => {
        return url;
      })
      .catch((error) => {
        console.error("Error getting download URL: ", error);
        throw error;
      });
  }

  // Poll Database Methods
  async getPoll(pollId: string): Promise<any> {
    try {
      const pollRef = dbRef(this.database, `polls/${pollId}`);
      const snapshot = await get(pollRef);
      return snapshot.exists() ? snapshot.val() : null;
    } catch (error) {
      console.error("Error getting poll: ", error);
      throw error;
    }
  }

  async savePoll(pollId: string, pollData: any): Promise<void> {
    try {
      const pollRef = dbRef(this.database, `polls/${pollId}`);
      await set(pollRef, pollData);
    } catch (error) {
      console.error("Error saving poll: ", error);
      throw error;
    }
  }

  async submitVote(pollId: string, sessionId: string, votes: string[]): Promise<void> {
    try {
      // Record the user's vote
      const voteRef = dbRef(this.database, `pollVotes/${pollId}/${sessionId}`);
      await set(voteRef, {
        votes: votes,
        timestamp: Date.now()
      });

      // Update vote counts atomically
      const updates: { [key: string]: any } = {};
      for (const optionId of votes) {
        updates[`polls/${pollId}/options/${optionId}/votes`] = await this.incrementVoteCount(pollId, optionId);
      }
      
      await update(dbRef(this.database), updates);
    } catch (error) {
      console.error("Error submitting vote: ", error);
      throw error;
    }
  }

  private async incrementVoteCount(pollId: string, optionId: string): Promise<number> {
    const optionRef = dbRef(this.database, `polls/${pollId}/options/${optionId}/votes`);
    const snapshot = await get(optionRef);
    const currentVotes = snapshot.exists() ? snapshot.val() : 0;
    return currentVotes + 1;
  }

  async getUserVotes(pollId: string, sessionId: string): Promise<string[] | null> {
    try {
      const voteRef = dbRef(this.database, `pollVotes/${pollId}/${sessionId}`);
      const snapshot = await get(voteRef);
      return snapshot.exists() ? snapshot.val().votes : null;
    } catch (error) {
      console.error("Error getting user votes: ", error);
      return null;
    }
  }

  // Listen to poll changes in real-time
  listenToPollChanges(pollId: string): Observable<any> {
    return new Observable(observer => {
      const pollRef = dbRef(this.database, `polls/${pollId}`);
      const callback = (snapshot: any) => {
        if (snapshot.exists()) {
          observer.next(snapshot.val());
        } else {
          observer.next(null);
        }
      };

      onValue(pollRef, callback);

      // Return cleanup function
      return () => {
        off(pollRef, 'value', callback);
      };
    });
  }
}