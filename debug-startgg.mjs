// Debug script to test start.gg API directly
import fetch from 'node-fetch';

const API_URL = 'https://api.start.gg/gql/alpha';
const API_TOKEN = '032576e80b66070e0b094051d3282789';

async function testTournamentQuery(slug) {
  const query = `
    query TournamentQuery($slug: String!) {
      tournament(slug: $slug) {
        id
        name
        slug
        startAt
        endAt
        numAttendees
        events {
          id
          name
          numEntrants
          startAt
          state
          videogame {
            id
            name
          }
          phases {
            id
            name
            numSeeds
          }
        }
      }
    }
  `;

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query,
        variables: { slug }
      })
    });

    const result = await response.json();
    
    console.log('Response status:', response.status);
    console.log('Response:', JSON.stringify(result, null, 2));
    
    if (result.errors) {
      console.log('GraphQL Errors:', result.errors);
    }
    
    if (result.data?.tournament) {
      console.log('Tournament found:', result.data.tournament.name);
      console.log('Events:', result.data.tournament.events?.length || 0);
      
      // Test event sets query
      if (result.data.tournament.events?.length > 0) {
        const eventId = result.data.tournament.events[0].id;
        await testEventSetsQuery(eventId);
      }
    }
    
  } catch (error) {
    console.error('Network error:', error.message);
  }
}

async function testEventSetsQuery(eventId) {
  const query = `
    query EventSets($eventId: ID!, $page: Int!, $perPage: Int!) {
      event(id: $eventId) {
        id
        name
        sets(page: $page, perPage: $perPage, sortType: STANDARD) {
          pageInfo {
            total
            totalPages
          }
          nodes {
            id
            fullRoundText
            identifier
            round
            winnerId
            displayScore
            completedAt
            slots {
              entrant {
                id
                name
                participants {
                  id
                  gamerTag
                  user {
                    id
                  }
                }
              }
            }
            games {
              orderNum
              entrant1Score
              entrant2Score
              selections {
                entrant {
                  id
                }
                character {
                  id
                  name
                }
              }
            }
          }
        }
      }
    }
  `;

  try {
    console.log('\n=== Testing Event Sets Query ===');
    console.log('Event ID:', eventId);
    
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query,
        variables: { eventId, page: 1, perPage: 10 }
      })
    });

    const result = await response.json();
    
    console.log('Sets Response status:', response.status);
    console.log('Sets Response:', JSON.stringify(result, null, 2));
    
    if (result.data?.event?.sets?.nodes) {
      console.log(`Found ${result.data.event.sets.nodes.length} sets`);
    }
    
  } catch (error) {
    console.error('Sets query error:', error.message);
  }
}

// Test with the tournament from the screenshot
console.log('Testing tournament: raffle-rumble');
testTournamentQuery('raffle-rumble');
