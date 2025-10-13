# Voting System Implementation

## Overview
The Season 6 house name poll now uses Firebase Realtime Database for server-side vote tracking. This ensures that all votes are synchronized across all users in real-time.

## Features Implemented

### ✅ Server-Side Vote Storage
- All votes are now stored in Firebase Realtime Database
- Votes are synchronized in real-time across all users
- Each user's vote is tracked by a unique session ID

### ✅ Real-Time Vote Updates
- Vote counts update immediately when someone votes
- All users see the same vote totals
- Live updates without page refresh

### ✅ Offline Support
- Falls back to localStorage if Firebase is unavailable
- Automatically syncs local votes to Firebase when connection is restored
- Graceful error handling for network issues

### ✅ Duplicate Vote Prevention
- Each user session can only vote once
- Votes are tracked by unique session IDs
- Server-side validation prevents vote manipulation

## Database Structure

```
polls/
  house-names-2025/
    id: "house-names-2025"
    title: "Choose the Three House Names for Season 6!"
    description: "Vote for your top 3 favorite house names..."
    isActive: true
    maxSelections: 3
    endDate: "2025-10-31T23:59:59.000Z"
    options/
      golden-geese/
        name: "Golden Geese"
        votes: 42
        emblem: "🪿"
        color: "#f1c40f"
      crimson-kitties/
        name: "Crimson Kitties"
        votes: 38
        emblem: "🐱"
        color: "#e74c3c"
      ... (other options)

pollVotes/
  house-names-2025/
    session_abc123_1234567890/
      votes: ["golden-geese", "crimson-kitties", "purple-porcupines"]
      timestamp: 1697123456789
```

## Usage Instructions

### For Users
1. Navigate to the Season 6 page (`/season-6`)
2. Scroll down to the house name poll
3. Select up to 3 favorite house names
4. Click "Submit Votes"
5. View real-time results (optional)

### For Admins/Testing
Several methods are available via browser console:

```javascript
// Reset all poll data (clears all votes)
await component.resetPoll()

// Sync local votes to Firebase (if offline votes exist)
await component.syncLocalVotesToFirebase()

// Check current vote status
console.log(component.houseNamePoll)
console.log('Has voted:', component.hasVoted)
console.log('User votes:', component.houseNamePoll?.userVotes)
```

## Technical Details

### Firebase Integration
- Uses Firebase Realtime Database for live data sync
- Atomic vote counting to prevent race conditions
- Proper error handling and fallback mechanisms

### Session Management
- Each user gets a unique session ID stored in localStorage
- Session ID format: `session_{randomString}_{timestamp}`
- Prevents users from voting multiple times

### Data Validation
- Client-side validation for vote limits (max 3 selections)
- Server-side vote counting with proper increment logic
- Graceful handling of network connectivity issues

## Error Handling
- Network errors fall back to localStorage
- Invalid votes are rejected
- Clear user feedback via snackbar messages
- Console logging for debugging

## Future Enhancements
- Admin panel for poll management
- Vote analytics and reporting
- Multiple concurrent polls support
- Vote verification and audit trails
