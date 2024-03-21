import { Injectable } from "@angular/core";
import { getStorage, ref, getDownloadURL } from "firebase/storage";
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getDatabase } from "firebase/database";

@Injectable({
  providedIn: 'root'
})

export class FirebaseService {
  private storageRef: any;

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
    const database = getDatabase(app);
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



}