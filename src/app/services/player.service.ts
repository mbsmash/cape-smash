import { Injectable } from "@angular/core";
import { Player } from "src/models/player";

@Injectable({
    providedIn: 'root'
})

export class PlayerService {

    players: Player[] = [
        {
            id: 1,
            displayName: "MB",
            rank: 0,
            mainCharacter: {
                id: 1, codename: "wario", displayName: "Wario", path: "Wario", alternates: []
            },
            secondaryCharacters: [
                { id: 2, codename: "gaogaen", displayName: "Incineroar", path: "Incineroar", alternates: []},
                { id: 3, codename: "reflet", displayName: "Robin", path: "Robin", alternates: []}
            ]
        },
        {
            id: 2,
            displayName: "Isle",
            rank: 0,
            mainCharacter: {
                id: 1, codename: "donkey", displayName: "Donkey Kong", path: "Donkey Kong", alternates: []
            }, secondaryCharacters: [
                { id: 2, codename: "demon", displayName: "Kazuya Mishima", path: "Kazuya Mishima", alternates: []},
                { id: 3, codename: "koopa", displayName: "Bowser", path: "Bowser", alternates: []}]
        },
        {
            id: 3,
            displayName: "Echo",
            rank: 0,
            mainCharacter: {
                id: 1, codename: "gamewatch", displayName: "Mr Game & Watch", path: "Mr Game & Watch", alternates: []
            },
            secondaryCharacters: [
                { id: 2, codename: "sonic", displayName: "Sonic", path: "Sonic", alternates: []}
            ]
        },
        {
            id: 4,
            displayName: "PK",
            rank: 0,
            mainCharacter: {
                id: 1, codename: "pit", displayName: "Pit", path: "Pit", alternates: []
            }, secondaryCharacters: [
                { id: 2, codename: "falco", displayName: "Falco", path: "Falco", alternates: []},
                { id: 3, codename: "master", displayName: "Byleth", path: "Byleth", alternates: []}]
        },
        {
            id: 5,
            displayName: "JK",
            rank: 0,
            mainCharacter: {
                id: 1, codename: "koopa", displayName: "Bowser", path: "Bowser", alternates: []
            }, secondaryCharacters: [
                { id: 2, codename: "ganon", displayName: "Ganondorf", path: "Ganondorf", alternates: []},
            ]
        },
        {
            id: 6,
            displayName: "Varixah",
            rank: 0,
            mainCharacter: {
                id: 1, codename: "buddy", displayName: "Banjo & Kazooie", path: "Banjo and Kazooie", alternates: []
            }, secondaryCharacters: [
                { id: 2, codename: "younglink", displayName: "Young Link", path: "Young Link", alternates: []},
            ]
        },
        {
            id: 7,
            displayName: "khyizer",
            rank: 0,
            mainCharacter: {
                id: 1, codename: "elight_first", displayName: "Pyra & Mythra", path: "Pyra and Mythra", alternates: []
            },
            secondaryCharacters: []
        },
        {
            id: 8,
            displayName: "Millard",
            rank: 0,
            mainCharacter: {
                id: 1, codename: "sonic", displayName: "Sonic", path: "Sonic", alternates: []
            },
            secondaryCharacters: []
        },
        {
            id: 9,
            displayName: "HeroKing",
            rank: 0,
            mainCharacter: {
                id: 1, codename: "yoshi", displayName: "Yoshi", path: "Yoshi", alternates: []
            },
            secondaryCharacters: []
        },
        {
            id: 10,
            displayName: "Linc.inc",
            rank: 0,
            mainCharacter: {
                id: 1, codename: "younglink", displayName: "Young Link", path: "Young Link", alternates: []
            },
            secondaryCharacters: [
                { id: 2, codename: "roy", displayName: "Roy", path: "Roy", alternates: []},
            ]
        },
        {
            id: 11,
            displayName: "Watr",
            rank: 0,
            mainCharacter: {
                id: 1, codename: "demon", displayName: "Kazuya Mishima", path: "Kazuya Mishima", alternates: []
            },
            secondaryCharacters: [
                { id: 2, codename: "szerosuit", displayName: "Zero Suit Samus", path: "Zero Suit Samus", alternates: []},
                { id: 3, codename: "bayonetta", displayName: "Bayonetta", path: "Bayonetta", alternates: []}
            ]
        },
        { 
            id: 12,
            displayName: "Roger",
            rank: 0,
            mainCharacter: {
                id: 1, codename: "koopa", displayName: "Bowser", path: "Bowser", alternates: []
            },
            secondaryCharacters: []
        }
        

    ];


    constructor() {
    }


    getRandomPlayer(): Player {
        return this.players[Math.floor(Math.random() * this.players.length)];
    }
}